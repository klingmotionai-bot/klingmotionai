# Deploy on Railway

## Important: Root Directory

**Set the service Root Directory to the repo root (leave empty or `.`).**

If Root Directory is set to `backend`, Railway builds only the `backend/` folder and uses Nixpacks with `npm ci`, which can fail. With Root Directory at the repo root, Railway uses the project **Dockerfile**, which runs `npm install` and avoids `npm ci` errors.

## Steps

1. In Railway → your **klingmotionai** service → **Settings**.
2. Under **Build**, set **Root Directory** to empty (or `.`).
3. **Redeploy** (and clear build cache if available).
4. Set variables: `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (if using OAuth).

The `railway.json` in this repo tells Railway to use the Dockerfile; the Root Directory must be the repo root for the Dockerfile to be found.
