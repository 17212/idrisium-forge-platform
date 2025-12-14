# IDRISIUM IDEAS FORGE – DEPLOYMENT MANUAL

This manual describes **exact terminal commands** and steps to deploy the platform:

- **Backend** (FastAPI) → **Render Web Service**
- **Frontend** (Next.js 14) → **Vercel**

Use this together with `IDRISIUM_BLUEPRINT.md`.

---

## 1. Backend – FastAPI on Render

### 1.1 Local sanity check (optional but recommended)

From the project root:

```bash
cd backend
python -m venv .venv
# Windows PowerShell
.venv\Scripts\Activate.ps1

pip install --upgrade pip
pip install -r requirements.txt

# Run the API locally on http://localhost:10000
uvicorn main:app --host 0.0.0.0 --port 10000 --reload
```

### 1.2 Prepare repository

Ensure your project is committed and pushed to GitHub (or another Git provider Render supports).

```bash
# From project root
git init
git add .
git commit -m "IDRISIUM IDEAS FORGE – initial backend & frontend"
git branch -M main
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin main
```

### 1.3 Create Render Web Service

1. Go to **https://render.com** and sign in.
2. Click **New → Web Service**.
3. Connect your **GitHub repository**.
4. Select the repo that contains this project.
5. Under **Root Directory**, set: `backend`.
6. Set **Environment** to `Python`.
7. Configure:
   - **Build Command**:
     ```bash
     pip install -r requirements.txt
     ```
   - **Start Command**:
     ```bash
     uvicorn main:app --host 0.0.0.0 --port 10000
     ```

### 1.4 Backend environment variables (Render)

In your Render service **Environment** tab, add:

- `GEMINI_API_KEYS` – comma-separated Gemini 2.5 Pro API keys, e.g.
  - `key1,key2,key3`
- `FIREBASE_CREDENTIALS` – JSON service account **or** a path, depending on how you wire Firebase Admin later.
- `ADMIN_EMAIL` – `idris.ghamid@gmail.com` (or the admin email you choose).
- `CAIRO_TZ` – `Africa/Cairo`.
- Optional safety/ops settings:
  - `SPAM_MAX_PER_MINUTE` – e.g., `5`.

Deploy the service and wait until Render shows **Live**. Copy the public URL, e.g.:

```text
https://idrisium-ideas-forge-backend.onrender.com
```

You will use this value as `NEXT_PUBLIC_BACKEND_URL` in the frontend.

---

## 2. Frontend – Next.js 14 on Vercel

### 2.1 Local sanity check (optional)

From the project root:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000` and verify that:

- Aurora Void background is visible.
- Main feed loads ideas (if any) from Firestore.
- "Doomsday" timer and news ticker render.

Stop the dev server with `Ctrl + C` when done.

### 2.2 Deploy to Vercel

1. Go to **https://vercel.com** and sign in.
2. Click **New Project** and import the same GitHub repo.
3. When prompted for the project root, choose `frontend`.
4. Framework should auto-detect as **Next.js**.

### 2.3 Frontend environment variables (Vercel)

In **Project Settings → Environment Variables**, add:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
  - Value: `AIzaSyAtHexNUUuyg2s_27oYuKT6PY1CHxtu3rE`
- `NEXT_PUBLIC_BACKEND_URL`
  - Value: the Render FastAPI URL, e.g. `https://idrisium-ideas-forge-backend.onrender.com`
- `ADMIN_EMAIL`
  - Value: `idris.ghamid@gmail.com` (for backend consistency; not exposed client-side).
- `NEXT_PUBLIC_ADMIN_EMAIL`
  - Value: same as `ADMIN_EMAIL` so the Admin Dashboard can gate by email in the browser.

Click **Deploy**. Vercel will build and deploy the Next.js app. After it’s live, note the production URL, e.g.:

```text
https://idrisium-ideas-forge.vercel.app
```

This URL is already used in `app/layout.tsx` metadata for OG tags; you can update it there if the final URL differs.

---

## 3. Environment Variable Summary

### 3.1 Backend (Render)

- `GEMINI_API_KEYS` – required. Comma-separated Gemini keys.
- `FIREBASE_CREDENTIALS` – required. Service account JSON or path.
- `ADMIN_EMAIL` – required. Admin email (e.g., `idris.ghamid@gmail.com`).
- `CAIRO_TZ` – recommended. `Africa/Cairo`.
- `SPAM_MAX_PER_MINUTE` – optional. Default `5` if unset.

### 3.2 Frontend (Vercel)

- `NEXT_PUBLIC_FIREBASE_API_KEY` – required. Must match the Firebase config.
- `NEXT_PUBLIC_BACKEND_URL` – required. Public URL of the FastAPI backend (Render).
- `ADMIN_EMAIL` – required for consistency/shared configs, used server-side if needed.
- `NEXT_PUBLIC_ADMIN_EMAIL` – required for client-side gating of `/admin/dashboard`.

---

## 4. Post-deploy checks

After both services are live:

1. **Health check**
   - Open: `https://<RENDER_BACKEND_URL>/health` and confirm `{ "status": "ok" }`.

2. **Frontend connectivity**
   - Open the Vercel URL.
   - Create a test account via Firebase Auth.
   - Submit an idea and confirm it appears in Firestore.
   - Trigger **Roast My Idea** and verify FastAPI + Gemini respond.

3. **Admin dashboard**
   - Sign in using `ADMIN_EMAIL`.
   - Open `/admin/dashboard` and verify God Mode controls render.

Once these pass, IDRISIUM IDEAS FORGE is fully deployed and ready for users.
