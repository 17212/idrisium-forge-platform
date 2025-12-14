import csv
import io
import os
import random
from typing import List

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, Response
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
    DuplicateCandidate,
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


class SubmitIdeaRequest(BaseModel):
    title: str
    description: str
    author_uid: str
    author_name: str | None = None


class SubmitIdeaResponse(BaseModel):
    id: str
    title: str
    raw_title: str
    description: str
    author: str
    uid: str
    difficulty: str | None = None
    difficulty_raw: str | None = None
    tags: List[str] = []
    easter_egg: bool = False


class VoteRequest(BaseModel):
    user_id: str
    user_name: str | None = None
    user_email: str | None = None


class VoteResponse(BaseModel):
    ok: bool
    already_voted: bool
    votes: int | None = None


class TrendingIdea(BaseModel):
    id: str
    title: str
    recent_votes: int
    total_votes: int


class TrendingResponse(BaseModel):
    ideas: List[TrendingIdea]


class GrowthBucket(BaseModel):
    date: str
    count: int


class GrowthResponse(BaseModel):
    buckets: List[GrowthBucket]


class RecentVote(BaseModel):
    idea_id: str
    idea_title: str
    user_id: str
    user_name: str | None = None
    created_at_ts: float | None = None


class RecentVotesResponse(BaseModel):
    items: List[RecentVote]


class UserRankingEntry(BaseModel):
    user_id: str
    display_name: str | None = None
    reputation_score: float
    ideas_count: int
    votes_given: int
    votes_received: int
    badges: List[str]


class UserRankingResponse(BaseModel):
    users: List[UserRankingEntry]


class DeletedIdeaSummary(BaseModel):
    id: str
    title: str
    raw_title: str | None = None
    author: str | None = None
    votes: int = 0
    status: str | None = None


class DeletedIdeasResponse(BaseModel):
    ideas: List[DeletedIdeaSummary]


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


def detect_easter_egg_text(title: str, description: str) -> bool:
    secrets: List[str] = []
    env_code = os.getenv("EASTER_EGG_CODE")
    if env_code:
        secrets.append(env_code.lower())
    secrets.extend(["idris", "idrisium", "idris ghamid"])
    combined = f"{title}\n\n{description}".lower()
    return any(code in combined for code in secrets)


def _update_user_reputation(
    db,
    user_id: str,
    *,
    ideas_delta: int = 0,
    votes_given_delta: int = 0,
    votes_received_delta: int = 0,
    implemented_delta: int = 0,
) -> None:
    if not user_id:
        return

    user_ref = db.collection("users").document(user_id)
    snapshot = user_ref.get()
    data = snapshot.to_dict() or {}

    ideas_count = int(data.get("ideas_count") or 0) + ideas_delta
    votes_given = int(data.get("votes_given") or 0) + votes_given_delta
    votes_received = int(data.get("votes_received") or 0) + votes_received_delta
    implemented_count = int(data.get("implemented_ideas_count") or 0) + implemented_delta
    badges = list(data.get("badges") or [])

    if ideas_count >= 5 and "Thinker" not in badges:
        badges.append("Thinker")
    if implemented_count >= 1 and "Co-Founder" not in badges:
        badges.append("Co-Founder")

    reputation_score = (
        ideas_count * 3.0
        + votes_received * 2.0
        + votes_given * 0.5
        + implemented_count * 5.0
    )

    user_ref.set(
        {
            "ideas_count": ideas_count,
            "votes_given": votes_given,
            "votes_received": votes_received,
            "implemented_ideas_count": implemented_count,
            "badges": badges,
            "reputation_score": reputation_score,
        },
        merge=True,
    )


app = FastAPI(title="IDRISIUM IDEAS FORGE – AI Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # During development allow all; restrict in production
    allow_credentials=False,
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


@app.post("/submit_idea", response_model=SubmitIdeaResponse)
async def api_submit_idea(
    body: SubmitIdeaRequest,
    manager: GeminiManager = Depends(get_gemini_manager),
) -> SubmitIdeaResponse:
    db = get_firestore_client()

    system_doc = db.collection("config").document("system_settings").get()
    if system_doc.exists:
        system_data = system_doc.to_dict() or {}
        if not system_data.get("are_submissions_open", True):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Submissions are currently closed.",
            )

    spam_state = await api_spam_guard(SpamGuardRequest(user_id=body.author_uid))
    if not spam_state.allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=spam_state.reason or "Rate limit exceeded.",
        )

    combined_text = f"{body.title}\n\n{body.description}"
    moderation = await context_aware_filter_text(manager, combined_text)
    if not moderation.allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Content rejected: {moderation.reason}",
        )

    existing_ref = (
        db.collection("ideas")
        .where("is_deleted", "==", False)
        .order_by("created_at", direction=gcf.Query.DESCENDING)
        .limit(200)
    )
    candidates: List[DuplicateCandidate] = []
    for doc in existing_ref.stream():
        data = doc.to_dict() or {}
        base_title = data.get("raw_title") or data.get("title") or ""
        base_desc = data.get("description") or ""
        text = f"{base_title}\n\n{base_desc}".strip()
        if not text:
            continue
        candidates.append(DuplicateCandidate(id=doc.id, text=text))

    if candidates:
        duplicate_result = manager.detect_duplicate(combined_text, candidates)
        if duplicate_result.is_duplicate and duplicate_result.duplicate_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "message": "Duplicate idea detected. Please vote on the existing idea instead of submitting a new one.",
                    "duplicate_id": duplicate_result.duplicate_id,
                    "similarity": duplicate_result.similarity,
                },
            )

    fixed_title = await manager.fix_title(body.title, body.description)
    difficulty = await manager.analyze_difficulty(body.description)
    tags = await manager.auto_tagger(body.description)

    raw_level = difficulty.level
    display_level = raw_level
    cleaned_title = fixed_title.suggested_title or body.title
    author_name = body.author_name or "Anonymous Forger"
    easter_egg = detect_easter_egg_text(body.title, body.description)

    doc_ref = db.collection("ideas").document()
    doc_ref.set(
        {
            "title": cleaned_title,
            "raw_title": body.title,
            "description": body.description,
            "author": author_name,
            "uid": body.author_uid,
            "author_uid": body.author_uid,
            "votes": 0,
            "difficulty": display_level,
            "difficulty_raw": raw_level,
            "difficulty_reason": difficulty.reason,
            "tags": tags.tags,
            "easter_egg": easter_egg,
            "is_deleted": False,
            "timestamp": gcf.SERVER_TIMESTAMP,
            "created_at": gcf.SERVER_TIMESTAMP,
        },
    )

    _update_user_reputation(db, body.author_uid, ideas_delta=1)

    return SubmitIdeaResponse(
        id=doc_ref.id,
        title=cleaned_title,
        raw_title=body.title,
        description=body.description,
        author=author_name,
        uid=body.author_uid,
        difficulty=display_level,
        difficulty_raw=raw_level,
        tags=tags.tags,
        easter_egg=easter_egg,
    )


@app.post("/ideas/{idea_id}/vote", response_model=VoteResponse)
async def api_vote_idea(idea_id: str, body: VoteRequest) -> VoteResponse:
    db = get_firestore_client()
    idea_ref = db.collection("ideas").document(idea_id)
    idea_doc = idea_ref.get()
    if not idea_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Idea not found.",
        )
    idea_data = idea_doc.to_dict() or {}
    if idea_data.get("is_deleted"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Idea not found.",
        )

    votes_ref = idea_ref.collection("votes")
    existing = list(
        votes_ref.where("user_id", "==", body.user_id).limit(1).stream(),
    )
    if existing:
        current_votes = int(idea_data.get("votes") or 0)
        return VoteResponse(ok=True, already_voted=True, votes=current_votes)

    votes_ref.document().set(
        {
            "user_id": body.user_id,
            "user_name": body.user_name,
            "user_email": body.user_email,
            "created_at": gcf.SERVER_TIMESTAMP,
        },
    )

    idea_doc = idea_ref.get()
    idea_data = idea_doc.to_dict() or {}
    current_votes = int(idea_data.get("votes") or 0)
    new_votes = current_votes + 1
    idea_ref.update({"votes": new_votes})

    author_uid = idea_data.get("author_uid")
    _update_user_reputation(db, body.user_id, votes_given_delta=1)
    if isinstance(author_uid, str) and author_uid:
        _update_user_reputation(db, author_uid, votes_received_delta=1)

    return VoteResponse(ok=True, already_voted=False, votes=new_votes)


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


class WordToken(BaseModel):
    text: str
    weight: int


class StatsResponse(BaseModel):
    total_ideas: int
    wordcloud_tokens: List[WordToken]


@app.get("/stats", response_model=StatsResponse)
async def api_stats() -> StatsResponse:
    try:
        db = get_firestore_client()
        ideas_ref = db.collection("ideas").where("is_deleted", "==", False)
        docs = list(ideas_ref.stream())
    except Exception:  # noqa: BLE001
        return StatsResponse(total_ideas=0, wordcloud_tokens=[])

    descriptions: List[str] = []
    for doc in docs:
        data = doc.to_dict() or {}
        desc = data.get("description")
        if isinstance(desc, str) and desc.strip():
            descriptions.append(desc)

    tokens: List[WordToken] = []
    if descriptions:
        wc = generate_wordcloud_tokens(descriptions)
        tokens = [WordToken(text=t.text, weight=t.weight) for t in wc.tokens]

    return StatsResponse(total_ideas=len(docs), wordcloud_tokens=tokens)


@app.get("/analytics/growth", response_model=GrowthResponse)
async def api_growth() -> GrowthResponse:
    from datetime import datetime

    db = get_firestore_client()
    ideas_ref = db.collection("ideas").where("is_deleted", "==", False)
    docs = list(ideas_ref.stream())

    buckets: dict[str, int] = {}
    for doc in docs:
        data = doc.to_dict() or {}
        created_at = data.get("created_at") or data.get("timestamp")
        if hasattr(created_at, "timestamp"):
            dt = datetime.utcfromtimestamp(created_at.timestamp())
        else:
            continue
        key = dt.date().isoformat()
        buckets[key] = buckets.get(key, 0) + 1

    items = [
        GrowthBucket(date=date_str, count=count)
        for date_str, count in sorted(buckets.items())
    ]
    return GrowthResponse(buckets=items)


@app.get("/analytics/trending", response_model=TrendingResponse)
async def api_trending() -> TrendingResponse:
    from datetime import datetime, timedelta, timezone

    db = get_firestore_client()
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=1)

    ideas_ref = db.collection("ideas").where("is_deleted", "==", False).limit(200)
    candidates: List[TrendingIdea] = []

    for idea_doc in ideas_ref.stream():
        idea_data = idea_doc.to_dict() or {}
        title = idea_data.get("title") or "Untitled Idea"
        total_votes = int(idea_data.get("votes") or 0)
        votes_ref = idea_doc.reference.collection("votes")
        recent_docs = list(
            votes_ref.where("created_at", ">=", cutoff).stream(),
        )
        recent_count = len(recent_docs)
        if recent_count > 0:
            candidates.append(
                TrendingIdea(
                    id=idea_doc.id,
                    title=title,
                    recent_votes=recent_count,
                    total_votes=total_votes,
                ),
            )

    candidates.sort(key=lambda i: (i.recent_votes, i.total_votes), reverse=True)
    return TrendingResponse(ideas=candidates[:20])


@app.get("/analytics/voting-heatmap", response_model=HeatmapResponse)
async def api_voting_heatmap() -> HeatmapResponse:
    from datetime import datetime, timedelta, timezone

    db = get_firestore_client()
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=7)

    ts_list: List[float] = []
    ideas_ref = db.collection("ideas").where("is_deleted", "==", False).limit(500)
    for idea_doc in ideas_ref.stream():
        votes_ref = idea_doc.reference.collection("votes")
        vote_docs = votes_ref.where("created_at", ">=", cutoff).stream()
        for vote_doc in vote_docs:
            data = vote_doc.to_dict() or {}
            created_at = data.get("created_at")
            if hasattr(created_at, "timestamp"):
                ts_list.append(float(created_at.timestamp()))

    counts: dict[tuple[int, int], int] = {}
    for ts in ts_list:
        dt = datetime.utcfromtimestamp(ts)
        key = (dt.weekday(), dt.hour)
        counts[key] = counts.get(key, 0) + 1

    buckets = [
        HeatmapBucket(day=day, hour=hour, count=count)
        for (day, hour), count in counts.items()
    ]
    return HeatmapResponse(buckets=buckets)


@app.get("/analytics/recent-votes", response_model=RecentVotesResponse)
async def api_recent_votes() -> RecentVotesResponse:
    db = get_firestore_client()
    votes_query = (
        db.collection_group("votes")
        .order_by("created_at", direction=gcf.Query.DESCENDING)
        .limit(30)
    )

    items: List[RecentVote] = []
    for vote_doc in votes_query.stream():
        vote_data = vote_doc.to_dict() or {}
        created_at = vote_data.get("created_at")
        ts = float(created_at.timestamp()) if hasattr(created_at, "timestamp") else None
        idea_ref = vote_doc.reference.parent.parent
        idea_id = ""
        idea_title = ""
        if idea_ref is not None:
            idea_snapshot = idea_ref.get()
            if idea_snapshot.exists:
                idea_id = idea_ref.id
                idea_data = idea_snapshot.to_dict() or {}
                idea_title = idea_data.get("title") or "Untitled Idea"
        items.append(
            RecentVote(
                idea_id=idea_id,
                idea_title=idea_title,
                user_id=str(vote_data.get("user_id") or ""),
                user_name=vote_data.get("user_name"),
                created_at_ts=ts,
            ),
        )

    return RecentVotesResponse(items=items)


@app.get("/analytics/user-ranking", response_model=UserRankingResponse)
async def api_user_ranking() -> UserRankingResponse:
    db = get_firestore_client()
    users_ref = (
        db.collection("users")
        .order_by("reputation_score", direction=gcf.Query.DESCENDING)
        .limit(50)
    )

    users: List[UserRankingEntry] = []
    for doc in users_ref.stream():
        data = doc.to_dict() or {}
        users.append(
            UserRankingEntry(
                user_id=doc.id,
                display_name=data.get("display_name"),
                reputation_score=float(data.get("reputation_score") or 0.0),
                ideas_count=int(data.get("ideas_count") or 0),
                votes_given=int(data.get("votes_given") or 0),
                votes_received=int(data.get("votes_received") or 0),
                badges=list(data.get("badges") or []),
            ),
        )

    return UserRankingResponse(users=users)


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


class GeminiKeysResponse(BaseModel):
    keys: List[str]


class AdminActionResponse(BaseModel):
    ok: bool


class RandomIdeaResponse(BaseModel):
    id: str
    title: str


@app.get("/admin/ideas/deleted", response_model=DeletedIdeasResponse)
async def api_admin_deleted_ideas(
    admin=Depends(get_admin_user),  # noqa: B008
) -> DeletedIdeasResponse:
    db = get_firestore_client()
    ideas_ref = db.collection("ideas").where("is_deleted", "==", True).limit(200)
    items: List[DeletedIdeaSummary] = []
    for doc in ideas_ref.stream():
        data = doc.to_dict() or {}
        items.append(
            DeletedIdeaSummary(
                id=doc.id,
                title=data.get("title") or "Untitled Idea",
                raw_title=data.get("raw_title"),
                author=data.get("author"),
                votes=int(data.get("votes") or 0),
                status=data.get("status"),
            ),
        )
    return DeletedIdeasResponse(ideas=items)


@app.get("/ideas/random", response_model=RandomIdeaResponse)
async def api_random_idea_public() -> RandomIdeaResponse:
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


@app.post("/admin/ideas/{idea_id}/delete", response_model=AdminActionResponse)
async def api_admin_delete_idea(
    idea_id: str,
    admin=Depends(get_admin_user),  # noqa: B008
) -> AdminActionResponse:
    db = get_firestore_client()
    idea_ref = db.collection("ideas").document(idea_id)
    doc = idea_ref.get()
    if not doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Idea not found",
        )
    idea_ref.set({"is_deleted": True}, merge=True)
    return AdminActionResponse(ok=True)


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


@app.get("/admin/gemini-keys", response_model=GeminiKeysResponse)
async def api_get_gemini_keys(
    admin=Depends(get_admin_user),  # noqa: B008
) -> GeminiKeysResponse:
    db = get_firestore_client()
    doc = db.collection("config").document("ai_settings").get()
    keys: List[str] = []
    if doc.exists:
        data = doc.to_dict() or {}
        stored = data.get("gemini_api_keys") or []
        keys = [k.strip() for k in stored if isinstance(k, str) and k.strip()]

    if not keys:
        keys_env = os.getenv("GEMINI_API_KEYS", "").strip()
        if keys_env:
            keys = [k.strip() for k in keys_env.split(",") if k.strip()]

    return GeminiKeysResponse(keys=keys)


@app.post("/admin/ideas/{idea_id}/approve", response_model=AdminActionResponse)
async def api_admin_approve_idea(
    idea_id: str,
    admin=Depends(get_admin_user),  # noqa: B008
) -> AdminActionResponse:
    db = get_firestore_client()
    idea_ref = db.collection("ideas").document(idea_id)
    doc = idea_ref.get()
    if not doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Idea not found",
        )
    idea_ref.set(
        {"status": "approved", "approved_at": gcf.SERVER_TIMESTAMP},
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
