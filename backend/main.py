import os
from typing import List

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
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


class HealthResponse(BaseModel):
    status: str


# Environment & dependency wiring


def get_gemini_manager() -> GeminiManager:
    keys_env = os.getenv("GEMINI_API_KEYS", "").strip()
    if not keys_env:
        raise RuntimeError("GEMINI_API_KEYS env var is required (comma-separated API keys)")
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


# --- Security & Moderation ---


@app.post("/moderation/filter", response_model=ModerationResponse)
async def api_moderation_filter(
    body: ModerationRequest,
    manager: GeminiManager = Depends(get_gemini_manager),
) -> ModerationResponse:
    return await context_aware_filter_text(manager, body.text)


@app.post("/moderation/spam-guard", response_model=SpamGuardResponse)
async def api_spam_guard(body: SpamGuardRequest) -> SpamGuardResponse:
    # Full implementation will query Firestore for recent ideas.
    # For now, enforce a simple server-side guard using environment-driven limits.
    max_per_minute = int(os.getenv("SPAM_MAX_PER_MINUTE", "5"))
    # This placeholder always allows but documents the contract for the real implementation.
    # Real version will set banned_until_ts and reason appropriately.
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
    # The real implementation will check Cairo time and update Firestore config.
    # Here we only return the decision flag; the frontend/admin tools can call this
    # via a Render cron job to enforce daily submission locks.
    from datetime import datetime
    import zoneinfo

    tz = zoneinfo.ZoneInfo(os.getenv("CAIRO_TZ", "Africa/Cairo"))
    now = datetime.now(tz)
    locked = now.hour == 0 and now.minute == 0
    return AutoLockResponse(locked=locked)


if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", "10000")), reload=True)
