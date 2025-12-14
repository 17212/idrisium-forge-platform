# IDRISIUM IDEAS FORGE – MASTER BLUEPRINT (IDRISIUM_BLUEPRINT.md)

> **Codename:** IDRISIUM IDEAS FORGE  
> **Author:** IDRISIUM Corp – CTO Office  
> **Founder:** Idris Ghamid  
> **Version:** v1.0 – 2025-12-14

---

## 0. VISION & NORTH STAR

IDRISIUM IDEAS FORGE is a cinematic, AI-augmented idea platform where visionaries forge, refine, and battle-test software ideas. It combines:

- **Realtime collaboration** (Firebase Firestore + Auth)
- **Deep AI orchestration** (Gemini 2.5 Pro + Python FastAPI)
- **Sci‑fi cinematic UX** (Next.js 14, Aurora Void, glassmorphism, kinetic motion)
- **Enterprise security & governance** (moderation, rate limiting, config flags)

This blueprint is the **single source of truth** for architecture, database schema, APIs, AI behavior, security, UX patterns, QA, and deployment.

---

## 1. HIGH-LEVEL ARCHITECTURE

### 1.1 Logical Components

- **Web Frontend (Next.js 14 App Router, TypeScript)**  
  Renders the Aurora Void UI, handles auth, idea creation, voting, analytics dashboards, admin panel, and visual effects.

- **AI Backend (Python FastAPI)**  
  Stateless service exposing endpoints for:
  - AI analysis, title fixing, auto-tagging, roasting, success prediction
  - Duplicate detection & semantic search
  - Moderation (toxicity, banned words, spam guard, submission lock)
  - Analytics (heatmap, wordcloud, exports)
  - Voice transcription & idea evolution suggestions

- **Data Layer (Firebase)**
  - **Firestore**: Core persistent store for users, ideas, system config, activity logs, and notifications.
  - **Authentication**: Email/password + OAuth providers (expandable). Frontend uses Firebase Auth, backend validates ID tokens.
  - **Storage**: Voice note files and any future media assets.

- **Background & Scheduled Tasks**
  - FastAPI background tasks and/or Render Cron hitting dedicated endpoints for:
    - `auto_lock_cron` (midnight Cairo time)
    - Periodic data export / analytics precomputation (optional)

- **External AI & Services**
  - **Gemini 2.5 Pro** for all LLM-based reasoning.
  - Optional: OpenAI Whisper / Gemini audio transcription APIs.
  - Email provider (EmailJS or Firebase Functions + mail provider) for user notifications.

### 1.2 Separation of Concerns

- **Frontend**: UI, client-side state, basic validation, optimistic UX, fallback direct-write to Firestore when backend is down.
- **Backend**: AI logic, moderation, analytics, admin-only actions, heavy computation, data export.
- **Firebase**: Identity, primary source-of-truth for domain entities.

---

## 2. TECH STACK DETAILS

### 2.1 Frontend

- **Framework**: Next.js 14+ with App Router (`app/` directory)
- **Language**: TypeScript (strict mode)
- **Styling**:
  - Tailwind CSS
  - shadcn/ui component library
  - Custom Aurora Void theme (black + neon green)
- **Animation & Effects**:
  - Framer Motion (page transitions, modals, cards, buttons)
  - Custom Canvas / CSS animations for Aurora background
  - Matrix Rain overlay (easter egg)
  - Confetti / particle effects for voting, Randomizer, Ban Hammer
- **State & Data**:
  - React hooks + context and/or Zustand
  - React Query (TanStack Query) for backend REST endpoints
  - Firebase client SDK (Auth, Firestore, Storage)

### 2.2 Backend

- **Framework**: FastAPI (async)
- **Runtime**: Python 3.11+
- **Libraries** (core):
  - `fastapi`, `uvicorn[standard]`
  - `httpx` or `requests` (prefer `httpx` async) for calling Gemini / external APIs
  - `pydantic` for schemas
  - `google-cloud-firestore` / `firebase-admin` for server-side Firestore & Auth verification
  - `pandas`, `openpyxl` or `xlsxwriter` (Excel export)
  - `scikit-learn` (TF-IDF, cosine similarity)
  - `python-dotenv` for env loading (local dev)
  - Optional: `apscheduler` or in-process scheduling if needed beyond Render cron

### 2.3 Firebase

- **Project**: `idrisium-forge`
- **Firestore**: Native mode, regional (e.g., europe or us-central), rules hardened (see security section).
- **Auth**: Email/password + optionally Google/GitHub.
- **Storage**: Bucket `idrisium-forge.firebasestorage.app` for voice notes and related attachments.

### 2.4 AI Engine

- **Provider**: Gemini 2.5 Pro
- **Key Rotation**: `GeminiManager` with multi-key pool, error-aware rotation, and rate-limit handling.
- **Prompt Engineering**: Centralized prompt templates for each feature (difficulty analysis, roast, debate, evolution, etc.).

---

## 3. DOMAIN MODEL & FIRESTORE SCHEMA

### 3.1 Firestore Collections (Core)

#### 3.1.1 `users`

Required fields (per spec):

- `uid: string` – Firebase Auth UID (also document ID).
- `email: string`
- `reputation_score: number` – aggregate score from votes received.
- `badges: string[]` – e.g., `["Thinker", "Founder", "Visionary"]`.
- `last_submission: Timestamp` – last idea submission time.

Additional recommended fields:

- `display_name: string`
- `avatar_url: string | null`
- `created_at: Timestamp`
- `updated_at: Timestamp`

#### 3.1.2 `ideas`

Required fields (per spec):

- `id: string` – auto; also used as document ID.
- `title: string`
- `description: string`
- `author_uid: string`
- `author_name: string`
- `votes: number`
- `statu: "Pending" | "Approved" | "Development" | "Completed"`  
  (Field name intentionally kept as `statu` to match spec.)
- `tags: string[]` – e.g., `["Productivity", "Islamic"]`.
- `ai_analysis: { difficulty: "Easy" | "Medium" | "Impossible"; success_rate: number }`
- `created_at: Timestamp`

Additional fields:

- `voice_note`: `{ storage_path: string; duration_seconds: number; transcript: string | null } | null`
- `ai_suggestions`: `{ suggested_title?: string; evolution_notes?: string }`
- `roast: string | null`
- `debate_log`: string | null – transcript for debate mode.
- `duplicate_of: string | null` – if detected as near-duplicate of another idea.
- `is_deleted: boolean` – soft delete flag for Trash Can.
- `deleted_at: Timestamp | null`

#### 3.1.3 `config`

- Doc ID: `system_settings`
  - `are_submissions_open: boolean` – global gate; enforced both frontend and backend.
  - `banned_words: string[]` – list of Arabic/English explicit terms.
  - `rate_limit_per_minute: number` – default `5` (ideas per 60 seconds).
  - `cairo_midnight_lock_enabled: boolean` – if true, auto-lock at 00:00 Cairo.

Additional config docs (optional):

- `ai_settings` doc:
  - `debate_personas: string[]` – e.g., `["Steve Jobs", "Elon Musk"]`.
  - `success_prediction_baseline: number`.
- `ui_settings` doc:
  - `matrix_easter_egg_enabled: boolean`.

#### 3.1.4 `activity_log`

Use for News Ticker, notifications, and admin audit trail.

- `type: "vote" | "idea_created" | "status_changed" | "team_up_request" | "ban_applied"`
- `user_uid: string`
- `user_name: string`
- `idea_id: string | null`
- `idea_title: string | null`
- `metadata: object` – free-form event metadata.
- `created_at: Timestamp`

#### 3.1.5 `notifications`

Per-user notifications (for Team Up requests, approvals, etc.).

- `recipient_uid: string`
- `type: "team_up" | "idea_approved" | "idea_completed"`
- `data: object` – includes idea id/title, sender uid/name.
- `read: boolean`
- `created_at: Timestamp`

---

## 4. BACKEND ARCHITECTURE (FASTAPI)

### 4.1 Directory Layout

```text
backend/
  main.py
  config.py
  dependencies.py
  firebase_client.py
  ai/
    __init__.py
    gemini_manager.py
    ideas_ai.py
    semantic_search.py
  moderation/
    __init__.py
    moderation_service.py
    rate_limiter.py
  analytics/
    __init__.py
    analytics_service.py
  models/
    __init__.py
    schemas.py
  workers/
    __init__.py
    scheduler.py
  utils/
    __init__.py
    text_cleaning.py
    time_utils.py
  requirements.txt
```

### 4.2 Core Modules

#### 4.2.1 `config.py`

- Loads environment variables:
  - `GEMINI_API_KEYS` – comma-separated list of keys.
  - `FIREBASE_CREDENTIALS` – path or JSON for service account.
  - `ADMIN_EMAIL` – admin email (e.g., `idris.ghamid@gmail.com`).
  - `CAIRO_TZ` – e.g., `Africa/Cairo`.
- Exposes a configuration object used across the app.

#### 4.2.2 `firebase_client.py`

- Initializes Firebase Admin SDK once (Singleton pattern):
  - Firestore client
  - Auth verification
- Functions:
  - `verify_id_token(token) -> dict`
  - `get_user(uid) -> dict`
  - `get_firestore_client()`

#### 4.2.3 `dependencies.py`

- FastAPI dependencies:
  - `get_current_user` – verifies Firebase ID token from `Authorization: Bearer` header.
  - `get_admin_user` – ensures `user.email == ADMIN_EMAIL`.

---

## 5. GEMINI ORCHESTRATOR – `GeminiManager`

### 5.1 Responsibilities

- Manage a pool of Gemini API keys with:
  - Round-robin selection.
  - Automatic failover on rate limit / quota errors.
  - Circuit-breaker behavior for temporarily disabled keys.
- Wrap Gemini 2.5 Pro calls with:
  - Unified error handling
  - Timeouts
  - Structured prompt templates and response parsing

### 5.2 Key Rotation Algorithm

- Load `GEMINI_API_KEYS` from env and split into array.
- Maintain in-memory state:
  - `current_index`
  - `key_status: { key: { disabled_until?: datetime } }`
- For each request:
  1. Pick next active key in round-robin skipping keys with `disabled_until > now`.
  2. On rate-limit/quota error:
     - Mark the key as disabled for a cooldown window (e.g., 60s).
     - Retry once with the next key.
  3. On generic server error, retry configurable times with exponential backoff.

### 5.3 Public Methods

All methods are async wrappers around Gemin API calls.

1. **`analyze_difficulty(idea_text: str) -> { level, reason }`**

   - Prompt: Explain technical complexity in context of current dev ecosystems.
   - Output JSON schema:
     ```json
     { "level": "Easy" | "Medium" | "Impossible", "reason": "..." }
     ```
   - Stored in `ai_analysis.difficulty` and optional `ai_suggestions.evolution_notes`.

2. **`fix_title(bad_title: str, description: str) -> { suggested_title }`**

   - Logic:
     - If `len(title.split()) < 5` or matches generic patterns ("good app", "my idea"), propose a new one.
     - Never overwrite original; return `suggested_title` only.

3. **`detect_duplicate(new_idea: str, existing_ideas_vector_db) -> { is_duplicate, similarity, duplicate_id }`**

   - Use `scikit-learn` `TfidfVectorizer` + cosine similarity on `title + description`.
   - If similarity > 0.85 with any existing idea:
     - `is_duplicate = true`
     - `duplicate_id = best_match_id`
   - The vector DB can be in-memory TF-IDF built from Firestore snapshot or a persisted model snapshot.

4. **`auto_tagger(description: str) -> { tags: string[] }`**

   - Prompt instructs Gemini to choose from:
     - `Productivity`, `Game`, `Utility`, `Health`, `Dark Web`, `Islamic`.
   - May return multiple tags; dedupe and store in `tags` array.

5. **`roast_mode(idea_text: str) -> { roast: string }`**

   - Prompt: "You are a harsh Silicon Valley investor. Roast this idea brutally but hilariously. Avoid slurs and protected-class attacks."
   - Frontend displays in "🔥 Roast My Idea" modal.

6. **`success_prediction(idea_text: str) -> { success_rate: number, explanation: string }`**

   - Output success probability as percentage [0, 100].
   - Stored in `ai_analysis.success_rate`.

7. **`debate_mode(idea_1: Idea, idea_2: Idea) -> { transcript: string }`**

   - Prompt: Simulated debate between Steve Jobs and Elon Musk deciding which idea is more promising, with back-and-forth dialogue.
   - Returned transcript rendered in chat-style UI.

---

## 6. SECURITY & MODERATION MODULE (THE SHIELD)

### 6.1 `context_aware_filter(text)`

- Combines:
  - AI toxicity classifier (Gemini) with explicit guidance on context.
  - Hardcoded banned word list (Arabic & English explicit/sexual/violent terms).
- Pipeline:
  1. **Pre-clean** text (strip HTML/script tags, normalize spaces).
  2. **Blocklist check**: if any banned word appears in obviously abusive context, flag.
  3. **AI scoring**: Ask Gemini to return `{ "toxicity_score": 0–1, "reason": "..." }` with context-awareness.
  4. If `toxicity_score > 0.8`, block submission.
- Backend returns structured error with message for UX.

### 6.2 `spam_guard(user_id)`

- Objective: Max 5 ideas per 60 seconds; excessive spam => 10-minute ban.
- Implementation:
  - Maintain a `spam_control` document or reuse `users.last_submission` + extra metadata:
    - `spam_state: { banned_until?: Timestamp }`.
  - On each idea submission:
    - Check if `banned_until` > now → block with remaining time.
    - Query recent ideas by user: `where(author_uid == user_id).orderBy(created_at desc).limit(5)` and ensure earliest within last 60s.
    - If exceeded, set `banned_until = now + 10m` and log event in `activity_log` with type `ban_applied`.

### 6.3 `auto_lock_cron()`

- Runs as background job (Render Cron hitting `/cron/auto-lock` endpoint).
- Steps:
  1. Convert current UTC to Cairo time.
  2. If time is `00:00` Cairo and `cairo_midnight_lock_enabled` is true:
     - Update `config/system_settings.are_submissions_open = false`.
  3. Log action in `activity_log`.

---

## 7. ANALYTICS & DATA SCIENCE MODULE

### 7.1 `generate_heatmap()`

- Goal: Provide data for GitHub-style activity grid (Day-of-week vs Hour-of-day).
- Implementation:
  - Query all ideas (or last N months) from Firestore.
  - For each `created_at`, map to `(dayOfWeek, hour)` bucket.
  - Return JSON:
    ```json
    {
      "buckets": [
        { "day": 0, "hour": 13, "count": 4 },
        ...
      ]
    }
    ```
  - Frontend maps to 7×24 grid with color intensity.

### 7.2 `generate_wordcloud()`

- Steps:
  1. Fetch idea titles + descriptions.
  2. Clean & tokenize text; remove stopwords ("the", "app", "idea", etc.).
  3. Count frequencies; sort top N tokens.
  4. Return JSON like:
     ```json
     [ { "text": "AI", "weight": 34 }, ... ]
     ```
  - Frontend feeds this into 3D TagCanvas-style sphere.

### 7.3 `export_data(admin_key)`

- Endpoint restricted by `ADMIN_EMAIL` + shared secret.
- Implementation:
  - Verify `admin_key` (env) and admin user.
  - Fetch all ideas and users from Firestore.
  - Convert to `pandas.DataFrame`.
  - Write to `.xlsx` using `openpyxl` or `xlsxwriter`.
  - Store file in temporary storage (or stream directly as `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`).
  - Return signed download URL or direct file response.

---

## 8. FRONTEND ARCHITECTURE (NEXT.JS 14)

### 8.1 Directory Layout

```text
frontend/
  app/
    layout.tsx
    page.tsx                # Main ideas feed + forge panel
    idea/
      [id]/page.tsx         # Idea detail page
    admin/
      dashboard/page.tsx    # God Mode
  components/
    AuroraBackground.tsx
    MatrixRainOverlay.tsx
    DoomsdayTimer.tsx
    NewsTicker.tsx
    IdeaCard.tsx
    ForgeButton.tsx
    VoiceRecorder.tsx
    HeatmapGrid.tsx
    WordCloudSphere.tsx
    AdminDashboard.tsx
    RandomizerButton.tsx
    BanHammerCard.tsx
    TeamUpButton.tsx
    ErrorBoundary.tsx
  lib/
    firebaseClient.ts
    apiClient.ts
    auth.ts
    seo.ts
  hooks/
    useMatrixEasterEgg.ts
    useRealtimeIdeas.ts
    useTrendingIdeas.ts
    useBackendHealth.ts
  styles/
    globals.css
    aurora.css
```

### 8.2 Design System – IDRISIUM UI

- **Colors**:
  - Background: `#000000` (Aurora Void base)
  - Accent: Neon Green `#39FF14`
  - Text: near-white `#EDEDED` and muted gray `#888888`
- **Fonts**:
  - Headings: `Space Grotesk`
  - Body: `Inter`
  - Code/Stats: `JetBrains Mono`
- **Components**:
  - **AuroraBackground**: animated gradient waves (green/purple) behind content.
  - **Glass Cards**: `backdrop-filter: blur(12px)`, translucent borders, neon glows.
  - **DoomsdayTimer**: countdown to midnight Cairo; syncs with `are_submissions_open`.
  - **NewsTicker**: real-time marquee using Firestore `activity_log` snapshot.
  - **IdeaCard**: 3D tilt on hover, spotlight effect, badges for difficulty and status, roast & evolution sections.
  - **AdminDashboard**: key manager, trash can, overrides, Randomizer & Ban Hammer.

### 8.3 Admin Dashboard (God Mode)

- Route: `/admin/dashboard`
- Access:
  - Only if authenticated user email == `ADMIN_EMAIL` (from env) and optionally flagged in `users` doc.
- Controls:
  - **Key Manager**: Add/remove Gemini keys.
    - Stored server-side only (never in Firestore). Frontend just posts to backend admin endpoints.
  - **Trash Can**: Lists `ideas` where `is_deleted = true`.
  - **Manual Override**: Toggle `config/system_settings.are_submissions_open`.
  - **Randomizer**: Calls backend endpoint `/admin/random-idea`; returns random active idea -> confetti effect + scrolling highlight.
  - **Ban Hammer**: Delete/ban spam ideas/users with neon hammer animation.

### 8.4 User Experience Features

- **Edit Window**: User can edit own idea; Firestore update with optimistic UI, AI reanalysis optional.
- **Reputation System**:
  - Rank tiers derived from `reputation_score`:
    - `Novice`, `Thinker`, `Visionary`, `Co-Founder`.
  - Display badge near user names.
- **Trending Now Sidebar**:
  - Query: ideas with `votes > 10` and `created_at` within last hour.
  - Live-updated via Firestore listener.
- **Easter Egg – IDRIS Sequence**:
  - Global key listener; if user types sequence `I`, `D`, `R`, `I`, `S` while focused on body:
    - Toggle Matrix Rain overlay and maybe change aurora intensity.

### 8.5 Notifications

- Use EmailJS or Firebase Functions:
  - **Welcome Email** on first login.
  - **Recognition Email** when admin sets `statu = "Approved"`.
  - **Execution Alert** when `statu = "Completed"` – send to all who voted (via `activity_log` or a `votes` subcollection).

---

## 9. FIREBASE CONFIGURATION & CONNECTIVITY

### 9.1 Client-side Initialization (Next.js)

Firebase config (production):

```ts
const firebaseConfig = {
  apiKey: "AIzaSyAtHexNUUuyg2s_27oYuKT6PY1CHxtu3rE",
  authDomain: "idrisium-forge.firebaseapp.com",
  projectId: "idrisium-forge",
  storageBucket: "idrisium-forge.firebasestorage.app",
  messagingSenderId: "977440894610",
  appId: "1:977440894610:web:0238faef72c61c8eb4404b",
  measurementId: "G-MK2Z13YGJD"
};
```

Implementation rules:

- Use `initializeApp` only once; reuse app via singleton in `firebaseClient.ts`.
- Firestore:
  - Use `getDocs` with `limit(50)` for initial loads.
  - Use `onSnapshot` for live feeds (News Ticker, Trending Now, main feed updates).
- Auth:
  - Set persistence to `browserLocalPersistence` to keep users logged in across sessions.
- Storage:
  - Store voice notes under `voice_notes/{ideaId}/{uid}/{timestamp}.webm`.

### 9.2 Server-side (FastAPI) Firebase Admin

- Use `firebase-admin` with service account credentials from `FIREBASE_CREDENTIALS` env.
- Backend verifies ID tokens and may perform privileged Firestore operations (e.g., exports, admin config changes).

---

## 10. AI-POWERED FEATURES (DETAILED BEHAVIOR)

### 10.1 Difficulty Badge

- On submission or edit:
  - Call backend `/ai/analyze-difficulty`.
  - Save result in `ai_analysis.difficulty` + explanation stored in `ai_suggestions.evolution_notes` (or separate field).
  - Frontend renders colored badge:
    - Easy: soft green
    - Medium: amber
    - Impossible: neon red/pink

### 10.2 Title Fix Suggestions

- On idea draft or submission:
  - If title short/generic -> call `/ai/fix-title`.
  - Show suggestion inline: `IDRISIUM AI suggests: [New Title]` with 1-click replace.

### 10.3 Duplicate Detection

- On pre-submit:
  - Fetch recent ideas snapshot (IDs + text) from backend or directly from Firestore.
  - Backend `/ai/detect-duplicate` uses TF-IDF similarity.
  - If similarity > 0.85, show modal: "This looks similar to [Idea Title]. Continue or view existing?".

### 10.4 Auto Tagger

- On submission or when user clicks "Auto-tag":
  - Call `/ai/auto-tagger`.
  - Merge AI tags with user tags, dedupe, and cap at e.g., 6 tags.

### 10.5 Roast Mode

- Button on IdeaCard: **"🔥 Roast My Idea"**.
- Calls `/ai/roast` with idea text; displays in animated modal (Framer Motion bottom sheet).

### 10.6 Success Prediction

- Part of analytics drawer for an idea.
- Calls `/ai/success-prediction`.
- Displays radial gauge: "82% Probability of Viral Success", plus explanation text.

### 10.7 Debate Mode

- UI: selection of two ideas; click **"Debate"**.
- Calls `/ai/debate` with both idea IDs; backend fetches texts and runs conversation prompt.
- Frontend renders chat-like script: alternating speakers (Steve Jobs vs Elon Musk).

---

## 11. AUDIO IDEAS (VOICE PITCH)

### 11.1 Frontend Capture

- Use Web Audio API / MediaRecorder to capture up to 30 seconds.
- Display timer and restart controls.
- Upload WAV/WebM to Firebase Storage path `voice_notes/{uid}/{timestamp}.webm`.

### 11.2 Backend Transcription

- After upload:
  - Frontend calls FastAPI `/audio/transcribe` with signed URL or storage path.
  - Backend downloads file, sends to transcription API (Whisper or Gemini audio).
  - Returns text; frontend pre-fills `description` or updates existing idea.

### 11.3 Storage and Linking

- Link voice note metadata into `ideas.voice_note`.

---

## 12. IDEA EVOLUTION TIMELINE

- Under each idea card:
  - Collapsed section: **"✨ IDRISIUM AI suggests: Future Scalability"**.
- On open:
  - Call `/ai/evolution` (additional Gemini prompt) or reuse difficulty context.
  - Show version 2.0 roadmap (phases, features, monetization hints).
- Optionally store in `ai_suggestions.evolution_notes` for caching.

---

## 13. TEAM UP & SMART SEARCH

### 13.1 Team Up Button

- Button **"Team Up"** on IdeaCard.
- On click:
  - Create `notifications` entry for author.
  - Add `activity_log` entry with `type = "team_up"`.
- UI for author:
  - Notification bell showing pending requests.

### 13.2 Smart Semantic Search

- Search bar at top (with filters).
- Frontend sends query to backend `/search/semantic`:
  - Backend combines TF-IDF + optional Gemini re-ranking.
  - Returns ranked idea IDs based on semantic similarity, not just keyword match.

---

## 14. ROBUSTNESS & FALLBACKS (ZERO-BUG PROTOCOL)

### 14.1 Race Conditions on Votes

- Use Firestore `FieldValue.increment(1)` for votes.
- Ensure all voting operations are performed through a single `update` call.
- Client-side optimistic update; listen to server snapshot for final state.

### 14.2 Auth State Expiry While Typing

- Auto-save drafts to `localStorage` on interval or on change.
- On login / refresh:
  - Check for stored draft and restore form fields.

### 14.3 Input Sanitization

- On frontend and backend:
  - Strip HTML tags and script content from `title`, `description`, and text inputs.
  - Enforce maximum lengths and safe character sets.

### 14.4 Error Boundaries

- Global React `<ErrorBoundary>` around app root:
  - On error, show cinematic "System Malfunction" screen with Matrix-style glitches instead of blank page.

### 14.5 Backend Health & Direct Mode

- Frontend monitors backend via `/health` endpoint.
- If any AI request exceeds 3 seconds:
  - Show "Waking up the AI..." status indicator.
- If backend completely unreachable:
  - Enable **Direct Mode**: write ideas directly to Firestore, mark them as `ai_pending` for later offline processing.

---

## 15. SEO & VIRALITY

### 15.1 Dynamic OG Images

- Use `@vercel/og` in Next.js for dynamic Open Graph images per idea.
- Generated image contains:
  - Idea title
  - Author avatar or initials
  - IDRISIUM logo and Aurora Void theme.

### 15.2 Structured Data (JSON-LD)

- Inject `Schema.org` JSON-LD for `CreativeWork` / `SoftwareApplication`:
  - `name`, `description`, `author`, `aggregateRating` (derived from votes).

### 15.3 Sitemap Generator

- Next.js route `/sitemap.xml`:
  - Lists root, admin dashboard, and all idea detail URLs `/idea/[id]` using Firestore snapshot via server-side fetch.

---

## 16. SECURITY PROTOCOLS

### 16.1 Authentication & Authorization

- All protected backend endpoints require Firebase ID token in `Authorization: Bearer`.
- Admin-only endpoints additionally verify `email == ADMIN_EMAIL` and/or role flag in `users`.

### 16.2 Firestore Security Rules (High-level)

- Only authenticated users can create ideas and votes.
- Users may edit only their own ideas.
- `config` write access reserved for admin.
- `notifications` readable only by recipient.

### 16.3 API Rate Limiting

- Per-IP and per-user logical rate limit enforced by `spam_guard` and optionally a shared memory or Redis-like layer (future).

### 16.4 Data Protection

- No API keys stored in Firestore.
- Gemini keys kept in server env / secret management only.
- Logging of AI prompts/responses scrubbed of PII where possible.

---

## 17. DEPLOYMENT STRATEGY (OVERVIEW)

### 17.1 Backend – Render

- Create a Render **Web Service** from `backend/` directory.
- Build command: `pip install -r requirements.txt`.
- Start command: `uvicorn main:app --host 0.0.0.0 --port 10000`.
- Configure env vars:
  - `GEMINI_API_KEYS`
  - `FIREBASE_CREDENTIALS`
  - `ADMIN_EMAIL`
  - Any email provider secrets.

### 17.2 Frontend – Vercel

- Deploy `frontend/` via GitHub import.
- Configure env vars:
  - `NEXT_PUBLIC_FIREBASE_API_KEY`
  - `NEXT_PUBLIC_BACKEND_URL` (Render URL)
  - `ADMIN_EMAIL`

### 17.3 Environment Management

- Separate `.env.local` for dev and environment variables in Vercel/Render dashboards for prod.

---

## 18. EXECUTION CHECKLIST

- [x] Document architecture: frontend, backend, Firebase
- [x] Define Firestore schema and auxiliary collections
- [x] Specify FastAPI modules and GeminiManager behavior
- [x] Detail security, moderation, and rate limiting
- [x] Cover analytics, heatmap, wordcloud, data export
- [x] Outline all AI features (roast, debate, evolution, etc.)
- [x] Describe audio pipeline, Team Up, semantic search
- [x] Capture robustness measures (race conditions, drafts, sanitization, error boundaries)
- [x] Include SEO & virality engine
- [x] Provide deployment overview for Render + Vercel

This blueprint is now the reference for all further implementation steps (backend, frontend, deployment, QA).
