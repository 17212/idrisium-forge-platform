import os
import random
from typing import List

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from google.cloud import firestore as gcf
from pydantic import BaseModel

from ai_engine import (
    AnalyzeDifficultyRequest,
    AnalyzeDifficultyResponse,
    AutoTaggerRequest,
    AutoTaggerResponse,
    DebateRequest,
    DebateResponse,
    DetectDuplicateRequest,
    DetectDuplicateResponse,
    EvolutionRequest,
    EvolutionResponse,
    FixTitleRequest,
    FixTitleResponse,
    GeminiManager,
    ModerationRequest,
    ModerationResponse,
    RoastRequest,
    RoastResponse,
    SpamGuardRequest,
    SpamGuardResponse,
    SuccessPredictionRequest,
    SuccessPredictionResponse,
    context_aware_filter_text,
    generate_wordcloud_tokens,
)
from dependencies import get_admin_user
from firebase_client import get_firestore_client


class HealthResponse(BaseModel):
    status: str


# Environment & dependency wiring


def get_gemini_manager() -> GeminiManager:
    """Return a GeminiManager using keys from Firestore config when available.

    Admins can manage keys via the /admin/gemini-keys endpoint, which stores
    them in the config/ai_settings document. If that document is missing or
    empty, we fall back to GEMINI_API_KEYS from the environment.
    """

    db = get_firestore_client()
    keys: List[str] = []

    try:
        doc = db.collection("config").document("ai_settings").get()
    except Exception:  # noqa: BLE001
        doc = None

    if doc and doc.exists:
        data = doc.to_dict() or {}
        stored = data.get("gemini_api_keys") or []
        keys = [k.strip() for k in stored if isinstance(k, str) and k.strip()]

    if not keys:
        keys_env = os.getenv("GEMINI_API_KEYS", "").strip()
        if not keys_env:
            raise RuntimeError(
                "GEMINI_API_KEYS env var is required (comma-separated API keys) "
                "or config/ai_settings.gemini_api_keys must be set",
            )
        keys = [k.strip() for k in keys_env.split(",") if k.strip()]

    return GeminiManager(api_keys=keys)


app = FastAPI(title="IDRISIUM IDEAS FORGE – AI Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For production, restrict to frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok")


# --- AI Orchestrator endpoints ---


@app.post("/ai/analyze-difficulty", response_model=AnalyzeDifficultyResponse)
async def api_analyze_difficulty(
    body: AnalyzeDifficultyRequest,
    manager: GeminiManager = Depends(get_gemini_manager),
) -> AnalyzeDifficultyResponse:
    return await manager.analyze_difficulty(body.idea_text)


@app.post("/ai/fix-title", response_model=FixTitleResponse)
async def api_fix_title(
    body: FixTitleRequest,
    manager: GeminiManager = Depends(get_gemini_manager),
) -> FixTitleResponse:
    return await manager.fix_title(body.bad_title, body.description)


@app.post("/ai/detect-duplicate", response_model=DetectDuplicateResponse)
async def api_detect_duplicate(
    body: DetectDuplicateRequest,
    manager: GeminiManager = Depends(get_gemini_manager),  # kept for future embedding-based version
) -> DetectDuplicateResponse:
    # current implementation is purely TF-IDF based and does not call Gemini
    return manager.detect_duplicate(body.new_idea, body.existing_ideas)


@app.post("/ai/auto-tagger", response_model=AutoTaggerResponse)
async def api_auto_tagger(
    body: AutoTaggerRequest,
    manager: GeminiManager = Depends(get_gemini_manager),
) -> AutoTaggerResponse:
    return await manager.auto_tagger(body.description)


@app.post("/ai/roast", response_model=RoastResponse)
async def api_roast(
    body: RoastRequest,
    manager: GeminiManager = Depends(get_gemini_manager),
) -> RoastResponse:
    return await manager.roast_mode(body.idea_text)


@app.post("/ai/success-prediction", response_model=SuccessPredictionResponse)
async def api_success_prediction(
    body: SuccessPredictionRequest,
    manager: GeminiManager = Depends(get_gemini_manager),
) -> SuccessPredictionResponse:
    return await manager.success_prediction(body.idea_text)


@app.post("/ai/debate", response_model=DebateResponse)
async def api_debate(
    body: DebateRequest,
    manager: GeminiManager = Depends(get_gemini_manager),
) -> DebateResponse:
    return await manager.debate_mode(body)


@app.post("/ai/evolution", response_model=EvolutionResponse)
async def api_evolution(
    body: EvolutionRequest,
    manager: GeminiManager = Depends(get_gemini_manager),
) -> EvolutionResponse:
    return await manager.idea_evolution(body.idea_text)


# --- Security & Moderation ---


@app.post("/moderation/filter", response_model=ModerationResponse)
async def api_moderation_filter(
    body: ModerationRequest,
    manager: GeminiManager = Depends(get_gemini_manager),
) -> ModerationResponse:
    return await context_aware_filter_text(manager, body.text)


@app.post("/moderation/spam-guard", response_model=SpamGuardResponse)
async def api_spam_guard(body: SpamGuardRequest) -> SpamGuardResponse:
    from datetime import datetime, timedelta, timezone

    max_per_minute = int(os.getenv("SPAM_MAX_PER_MINUTE", "5"))
    db = get_firestore_client()

    now = datetime.now(timezone.utc)
    now_ts = now.timestamp()

    user_ref = db.collection("users").document(body.user_id)
    user_doc = user_ref.get()
    banned_until_ts = None

    if user_doc.exists:
        user_data = user_doc.to_dict() or {}
        spam_state = user_data.get("spam_state") or {}
        banned_until_ts = spam_state.get("banned_until_ts")

    if isinstance(banned_until_ts, (int, float)) and banned_until_ts > now_ts:
        return SpamGuardResponse(
            allowed=False,
            banned_until_ts=banned_until_ts,
            reason="Temporary ban active due to spam.",
        )

    ideas_ref = db.collection("ideas")
    recent_query = (
        ideas_ref.where("author_uid", "==", body.user_id)
        .order_by("created_at", direction=gcf.Query.DESCENDING)
        .limit(max_per_minute)
    )

    recent_docs = list(recent_query.stream())
    if len(recent_docs) >= max_per_minute:
        oldest = recent_docs[-1]
        data = oldest.to_dict() or {}
        created_at = data.get("created_at")
        if hasattr(created_at, "timestamp"):
            created_ts = float(created_at.timestamp())
        else:
            created_ts = now_ts

        if now_ts - created_ts <= 60:
            banned_until_dt = now + timedelta(minutes=10)
            banned_until_ts = banned_until_dt.timestamp()
            user_ref.set({"spam_state": {"banned_until_ts": banned_until_ts}}, merge=True)
            return SpamGuardResponse(
                allowed=False,
                banned_until_ts=banned_until_ts,
                reason="Rate limit exceeded. Banned for 10 minutes.",
            )

    return SpamGuardResponse(allowed=True, banned_until_ts=None, reason=None)


# --- Analytics endpoints (backend will connect these to Firestore) ---


class HeatmapRequest(BaseModel):
    idea_timestamps: List[float]


class HeatmapBucket(BaseModel):
    day: int
    hour: int
    count: int


class HeatmapResponse(BaseModel):
    buckets: List[HeatmapBucket]


@app.post("/analytics/heatmap", response_model=HeatmapResponse)
async def api_generate_heatmap(body: HeatmapRequest) -> HeatmapResponse:
    from datetime import datetime

    counts: dict[tuple[int, int], int] = {}
    for ts in body.idea_timestamps:
        dt = datetime.utcfromtimestamp(ts)
        key = (dt.weekday(), dt.hour)
        counts[key] = counts.get(key, 0) + 1
    buckets = [
        HeatmapBucket(day=day, hour=hour, count=count)
        for (day, hour), count in counts.items()
    ]
    return HeatmapResponse(buckets=buckets)


class WordCloudRequest(BaseModel):
    texts: List[str]


@app.post("/analytics/wordcloud")
async def api_generate_wordcloud(body: WordCloudRequest):
    return generate_wordcloud_tokens(body.texts)


# --- Cron / system endpoints (auto lock) ---


class AutoLockResponse(BaseModel):
    locked: bool


@app.post("/cron/auto-lock", response_model=AutoLockResponse)
async def api_auto_lock() -> AutoLockResponse:
    # Check Cairo time and, if it is midnight, close submissions in Firestore.
    from datetime import datetime
    import zoneinfo

    tz = zoneinfo.ZoneInfo(os.getenv("CAIRO_TZ", "Africa/Cairo"))
    now = datetime.now(tz)
    locked = now.hour == 0 and now.minute == 0

    if locked:
        db = get_firestore_client()
        db.collection("config").document("system_settings").set(
            {"are_submissions_open": False},
            merge=True,
        )

    return AutoLockResponse(locked=locked)


class UpdateGeminiKeysRequest(BaseModel):
    keys: List[str]


class AdminActionResponse(BaseModel):
    ok: bool


class RandomIdeaResponse(BaseModel):
    id: str
    title: str


@app.post("/admin/gemini-keys", response_model=AdminActionResponse)
async def api_update_gemini_keys(
    body: UpdateGeminiKeysRequest,
    admin=Depends(get_admin_user),  # noqa: B008
) -> AdminActionResponse:
    db = get_firestore_client()
    cleaned = [k.strip() for k in body.keys if k.strip()]
    db.collection("config").document("ai_settings").set(
        {"gemini_api_keys": cleaned},
        merge=True,
    )
    return AdminActionResponse(ok=True)


@app.post("/admin/submissions/open", response_model=AdminActionResponse)
async def api_open_submissions(
    admin=Depends(get_admin_user),  # noqa: B008
) -> AdminActionResponse:
    db = get_firestore_client()
    db.collection("config").document("system_settings").set(
        {"are_submissions_open": True},
        merge=True,
    )
    return AdminActionResponse(ok=True)


@app.post("/admin/submissions/close", response_model=AdminActionResponse)
async def api_close_submissions(
    admin=Depends(get_admin_user),  # noqa: B008
) -> AdminActionResponse:
    db = get_firestore_client()
    db.collection("config").document("system_settings").set(
        {"are_submissions_open": False},
        merge=True,
    )
    return AdminActionResponse(ok=True)


@app.post("/admin/random-idea", response_model=RandomIdeaResponse)
async def api_random_idea(
    admin=Depends(get_admin_user),  # noqa: B008
) -> RandomIdeaResponse:
    db = get_firestore_client()
    ideas_ref = db.collection("ideas").where("is_deleted", "==", False).limit(200)
    docs = list(ideas_ref.stream())
    if not docs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No ideas available for random selection",
        )

    doc = random.choice(docs)
    data = doc.to_dict() or {}
    title = data.get("title") or "Untitled Idea"
    return RandomIdeaResponse(id=doc.id, title=title)


if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", "10000")), reload=True)
