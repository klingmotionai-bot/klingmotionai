# Deploy on Railway

## Root Directory = `backend` (no need to change)

The app now works when Railway’s **Root Directory** is set to **`backend`**:

- **`backend/Dockerfile`** runs `npm install` (no `npm ci`), so the build succeeds.
- **`backend/public/`** contains the frontend (index.html, script.js, styles.css, etc.); the server serves it in production.

You do **not** need to edit any file or clear Root Directory. Just **redeploy** (and clear build cache if Railway offers it).

## If Root Directory is empty (repo root)

Railway will use the root **Dockerfile** and build the whole repo. That also works.

## Variables

In Railway → **Variables**, set: `SESSION_SECRET`, and if you use OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

---

**About “you must be on a branch”:** That message is from **GitHub** when editing a file in the repo (e.g. in the browser). You don’t need to edit any file; the code is already updated. Just push from your machine and redeploy on Railway.
