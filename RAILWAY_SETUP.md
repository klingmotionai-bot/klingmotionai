# Railway Deployment Setup

1. **Create a new Railway project** and connect your GitHub repo.

2. **Set Root Directory** to `backend`:
   - Service → Settings → Source → Root Directory = `backend`

3. **Add environment variables** in Railway dashboard:
   - `PORT` (Railway sets this automatically)
   - `SESSION_SECRET` (required for production)
   - `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (for OAuth)
   - `FRONTEND_URL` (your Railway app URL, e.g. `https://your-app.up.railway.app`)
   - `NODE_ENV=production`

4. Railway will use `backend/Dockerfile` or `backend/nixpacks.toml` for the build.
