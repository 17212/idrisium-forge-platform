import asyncio
import json
import os
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import httpx
from pydantic import BaseModel, Field
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


GEMINI_API_BASE = os.getenv("GEMINI_API_BASE", "https://generativelanguage.googleapis.com/v1beta")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-pro")


class AnalyzeDifficultyRequest(BaseModel):
    idea_text: str = Field(..., min_length=10)


class AnalyzeDifficultyResponse(BaseModel):
    level: str
    reason: str


class FixTitleRequest(BaseModel):
    bad_title: str = Field(..., min_length=1)
    description: str = Field(..., min_length=10)


class FixTitleResponse(BaseModel):
    suggested_title: str


class DuplicateCandidate(BaseModel):
    id: str
    text: str


class DetectDuplicateRequest(BaseModel):
    new_idea: str
    existing_ideas: List[DuplicateCandidate]


class DetectDuplicateResponse(BaseModel):
    is_duplicate: bool
    similarity: float
    duplicate_id: Optional[str]


class AutoTaggerRequest(BaseModel):
    description: str


class AutoTaggerResponse(BaseModel):
    tags: List[str]


class RoastRequest(BaseModel):
    idea_text: str


class RoastResponse(BaseModel):
    roast: str


class SuccessPredictionRequest(BaseModel):
    idea_text: str


class SuccessPredictionResponse(BaseModel):
    success_rate: float
    explanation: str


class DebateRequest(BaseModel):
    idea_id_1: str
    idea_text_1: str
    idea_id_2: str
    idea_text_2: str


class DebateResponse(BaseModel):
    transcript: str


class EvolutionRequest(BaseModel):
    idea_text: str


class EvolutionResponse(BaseModel):
    evolution: str


class ModerationRequest(BaseModel):
    text: str


class ModerationResponse(BaseModel):
    allowed: bool
    toxicity_score: float
    reason: str


class SpamGuardRequest(BaseModel):
    user_id: str


class SpamGuardResponse(BaseModel):
    allowed: bool
    banned_until_ts: Optional[float]
    reason: Optional[str]


class HeatmapBucket(BaseModel):
    day: int
    hour: int
    count: int


class HeatmapResponse(BaseModel):
    buckets: List[HeatmapBucket]


class WordCloudToken(BaseModel):
    text: str
    weight: int


class WordCloudResponse(BaseModel):
    tokens: List[WordCloudToken]


class ExportDataRequest(BaseModel):
    admin_key: str


@dataclass
class GeminiKeyState:
    key: str
    disabled_until: float = 0.0


@dataclass
class GeminiManager:
    api_keys: List[str]
    model: str = GEMINI_MODEL
    cooldown_seconds: int = 60
    _index: int = 0
    _states: Dict[str, GeminiKeyState] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not self.api_keys:
            raise ValueError("GEMINI_API_KEYS must not be empty")
        for key in self.api_keys:
            self._states[key] = GeminiKeyState(key=key)

    def _next_key(self) -> str:
        now = time.time()
        for _ in range(len(self.api_keys)):
            key = self.api_keys[self._index]
            self._index = (self._index + 1) % len(self.api_keys)
            state = self._states[key]
            if state.disabled_until <= now:
                return key
        # if all keys disabled, just return the first and let it fail fast
        return self.api_keys[0]

    def _disable_key(self, key: str) -> None:
        self._states[key].disabled_until = time.time() + self.cooldown_seconds

    async def _call_gemini(self, system_instruction: str, user_prompt: str, *,
                           temperature: float = 0.7, max_output_tokens: int = 512) -> str:
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {"text": f"SYSTEM:\n{system_instruction}\n\nUSER:\n{user_prompt}"}
                    ],
                }
            ],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_output_tokens,
            },
        }

        last_error: Optional[Exception] = None
        for _ in range(len(self.api_keys)):
            api_key = self._next_key()
            try:
                async with httpx.AsyncClient(timeout=20.0) as client:
                    resp = await client.post(
                        f"{GEMINI_API_BASE}/models/{self.model}:generateContent",
                        params={"key": api_key},
                        json=payload,
                    )
                if resp.status_code == 200:
                    data = resp.json()
                    candidates = data.get("candidates") or []
                    if not candidates:
                        raise RuntimeError("No candidates returned from Gemini")
                    parts = candidates[0].get("content", {}).get("parts", [])
                    texts = [p.get("text", "") for p in parts]
                    return "\n".join(t for t in texts if t)

                if resp.status_code in (429, 500, 503):
                    # Soft-fail: disable key temporarily and try next
                    self._disable_key(api_key)
                    last_error = RuntimeError(f"Gemini error {resp.status_code}: {resp.text}")
                    continue

                # Hard error
                raise RuntimeError(f"Gemini HTTP {resp.status_code}: {resp.text}")

            except Exception as exc:  # noqa: BLE001
                last_error = exc
                self._disable_key(api_key)
                await asyncio.sleep(0.5)
                continue

        raise RuntimeError(f"All Gemini keys exhausted: {last_error}")

    async def analyze_difficulty(self, idea_text: str) -> AnalyzeDifficultyResponse:
        system_instruction = (
            "You are an expert software architect. "
            "Classify the implementation difficulty of the idea as Easy, Medium, or Impossible. "
            "Return STRICT JSON with keys level and reason."
        )
        user_prompt = (
            "Analyze the following software idea for implementation difficulty. "
            "Consider modern tooling and realistic constraints.\n\n"
            f"IDEA:\n{idea_text}\n\n"
            "Respond as JSON only."
        )
        raw = await self._call_gemini(system_instruction, user_prompt, temperature=0.4)
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            # best-effort fallback: simple heuristic
            lowered = idea_text.lower()
            if any(k in lowered for k in ["quantum", "fusion", "faster than light"]):
                level = "Impossible"
            elif any(k in lowered for k in ["ai", "distributed", "realtime"]):
                level = "Medium"
            else:
                level = "Easy"
            return AnalyzeDifficultyResponse(level=level, reason="Heuristic fallback; Gemini JSON parse failed.")

        level = str(data.get("level", "Medium")).title()
        if level not in {"Easy", "Medium", "Impossible"}:
            level = "Medium"
        reason = str(data.get("reason", "")) or "No explanation provided."
        return AnalyzeDifficultyResponse(level=level, reason=reason)

    async def fix_title(self, bad_title: str, description: str) -> FixTitleResponse:
        system_instruction = (
            "You are a product naming expert. Improve vague or very short titles. "
            "Return STRICT JSON with key suggested_title."
        )
        user_prompt = (
            "User-provided title and description are below. "
            "Propose a more compelling title suitable for a startup pitch.\n\n"
            f"TITLE: {bad_title}\n"
            f"DESCRIPTION: {description}\n\n"
            "Respond as JSON with field suggested_title."
        )
        raw = await self._call_gemini(system_instruction, user_prompt, temperature=0.7)
        try:
            data = json.loads(raw)
            suggested = str(data.get("suggested_title") or bad_title).strip()
        except json.JSONDecodeError:
            suggested = bad_title.strip()
        return FixTitleResponse(suggested_title=suggested)

    def detect_duplicate(self, new_idea: str, existing_ideas: List[DuplicateCandidate]) -> DetectDuplicateResponse:
        if not existing_ideas:
            return DetectDuplicateResponse(is_duplicate=False, similarity=0.0, duplicate_id=None)

        corpus = [new_idea] + [c.text for c in existing_ideas]
        vectorizer = TfidfVectorizer(stop_words="english")
        tfidf = vectorizer.fit_transform(corpus)
        sims = cosine_similarity(tfidf[0:1], tfidf[1:]).flatten()

        best_idx = int(sims.argmax())
        best_score = float(sims[best_idx])
        threshold = 0.85
        if best_score >= threshold:
            return DetectDuplicateResponse(
                is_duplicate=True,
                similarity=best_score,
                duplicate_id=existing_ideas[best_idx].id,
            )
        return DetectDuplicateResponse(is_duplicate=False, similarity=best_score, duplicate_id=None)

    async def auto_tagger(self, description: str) -> AutoTaggerResponse:
        allowed_tags = [
            "Productivity",
            "Game",
            "Utility",
            "Health",
            "Dark Web",
            "Islamic",
        ]
        system_instruction = (
            "Classify the idea description into zero or more of the allowed tags. "
            "Return STRICT JSON with a tags array containing only values from the allowed set."
        )
        user_prompt = (
            f"Allowed tags: {', '.join(allowed_tags)}.\n"
            f"DESCRIPTION: {description}\n\nRespond with JSON."
        )
        raw = await self._call_gemini(system_instruction, user_prompt, temperature=0.2)
        try:
            data = json.loads(raw)
            tags = [t for t in data.get("tags", []) if t in allowed_tags]
        except json.JSONDecodeError:
            tags = []
        # dedupe while preserving order
        seen = set()
        unique_tags: List[str] = []
        for tag in tags:
            if tag not in seen:
                seen.add(tag)
                unique_tags.append(tag)
        return AutoTaggerResponse(tags=unique_tags)

    async def roast_mode(self, idea_text: str) -> RoastResponse:
        system_instruction = (
            "You are a harsh but hilarious Silicon Valley investor. "
            "Roast the idea brutally but without using slurs or attacking protected classes."
        )
        user_prompt = f"Roast this startup idea:\n{idea_text}"
        text = await self._call_gemini(system_instruction, user_prompt, temperature=0.9)
        return RoastResponse(roast=text.strip())

    async def success_prediction(self, idea_text: str) -> SuccessPredictionResponse:
        system_instruction = (
            "Estimate the probability that this idea becomes a viral success in the next 3 years. "
            "Consider market size, competition, differentiation, and execution risk. "
            "Return STRICT JSON with success_rate (0-100) and explanation."
        )
        user_prompt = f"IDEA:\n{idea_text}\n\nRespond as JSON."
        raw = await self._call_gemini(system_instruction, user_prompt, temperature=0.4)
        try:
            data = json.loads(raw)
            rate = float(data.get("success_rate", 50.0))
            explanation = str(data.get("explanation") or "No explanation provided.")
        except json.JSONDecodeError:
            rate = 50.0
            explanation = "Heuristic fallback; Gemini JSON parse failed."
        # clamp
        rate = max(0.0, min(100.0, rate))
        return SuccessPredictionResponse(success_rate=rate, explanation=explanation)

    async def debate_mode(self, req: DebateRequest) -> DebateResponse:
        system_instruction = (
            "Simulate a debate between Steve Jobs and Elon Musk about which of two ideas is better. "
            "Write a back-and-forth transcript, clearly labeling each speaker."
        )
        user_prompt = (
            f"IDEA 1 (ID {req.idea_id_1}):\n{req.idea_text_1}\n\n"
            f"IDEA 2 (ID {req.idea_id_2}):\n{req.idea_text_2}\n\n"
            "Debate which idea is more promising."
        )
        transcript = await self._call_gemini(system_instruction, user_prompt, temperature=0.8)
        return DebateResponse(transcript=transcript.strip())

    async def idea_evolution(self, idea_text: str) -> EvolutionResponse:
        """Generate a phase-2 roadmap for the idea (Idea Evolution feature)."""

        system_instruction = (
            "You are a senior product strategist. "
            "Given a startup idea, outline how this product should evolve in version 2.0. "
            "Focus on scalability, monetization, ecosystem effects, and long-term moat. "
            "Respond with a concise, well-structured markdown section."
        )
        user_prompt = f"IDEA:\n{idea_text}\n\nDescribe the version 2.0 evolution roadmap."
        text = await self._call_gemini(system_instruction, user_prompt, temperature=0.7, max_output_tokens=768)
        return EvolutionResponse(evolution=text.strip())


# --- Moderation & Analytics helpers (backend will wire these to Firestore) ---

BANNED_WORDS: List[str] = [
    # English
    "fuck",
    "shit",
    "bitch",
    "asshole",
    "bastard",
    # Arabic (examples; extend as needed)
    "كس",
    "طيز",
    "زبي",
]


STOP_WORDS: List[str] = [
    "the",
    "a",
    "an",
    "and",
    "or",
    "for",
    "with",
    "to",
    "of",
    "app",
    "idea",
]


async def context_aware_filter_text(manager: GeminiManager, text: str) -> ModerationResponse:
    cleaned = _strip_html(text)
    lowered = cleaned.lower()

    # Hard block if explicit words appear clearly out of context
    if any(word in lowered for word in BANNED_WORDS):
        return ModerationResponse(allowed=False, toxicity_score=1.0, reason="Contains banned terms.")

    system_instruction = (
        "You are a content safety classifier. "
        "Given a piece of text, return STRICT JSON with toxicity_score (0-1) and reason. "
        "Be context aware (e.g., 'suck' about a vacuum cleaner is okay)."
    )
    user_prompt = f"TEXT:\n{cleaned}\n\nRespond as JSON with keys toxicity_score and reason."
    raw = await manager._call_gemini(system_instruction, user_prompt, temperature=0.0)
    try:
        data = json.loads(raw)
        score = float(data.get("toxicity_score", 0.0))
        reason = str(data.get("reason") or "")
    except json.JSONDecodeError:
        score = 0.0
        reason = "Toxicity analysis failed; allowing by default."

    allowed = score <= 0.8
    return ModerationResponse(allowed=allowed, toxicity_score=score, reason=reason)


def _strip_html(text: str) -> str:
    # Very small, dependency-free HTML stripper
    out: List[str] = []
    inside = False
    for ch in text:
        if ch == "<":
            inside = True
            continue
        if ch == ">":
            inside = False
            continue
        if not inside:
            out.append(ch)
    return "".join(out)


def generate_wordcloud_tokens(texts: List[str], max_tokens: int = 100) -> WordCloudResponse:
    from collections import Counter

    tokens: List[str] = []
    for raw in texts:
        cleaned = _strip_html(raw).lower()
        for part in cleaned.replace("\n", " ").split(" "):
            token = part.strip(".,!?;:()[]{}'\" ")
            if not token or token in STOP_WORDS:
                continue
            tokens.append(token)

    counts = Counter(tokens)
    most_common = counts.most_common(max_tokens)
    wc_tokens = [WordCloudToken(text=word, weight=count) for word, count in most_common]
    return WordCloudResponse(tokens=wc_tokens)
