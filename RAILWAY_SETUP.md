# Railway Deployment Setup

1. **Create a new Railway project** and connect your GitHub repo.

2. **Set Root Directory** to `backend`:
   - Service → Settings → Source → Root Directory = `backend`

3. **Add environment variables** in Railway dashboard:
   - `PORT` (Railway sets this automatically)
   - `RAILWAY_PUBLIC_DOMAIN` / `RAILWAY_URL` (Railway sets when you generate a domain)
   - `SESSION_SECRET` (required for production - use a random string)
   - `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (for OAuth, optional)
   - `FRONTEND_URL` (optional - defaults to Railway URL if RAILWAY_PUBLIC_DOMAIN is set)
   - `NODE_ENV=production`

4. Railway uses **Nixpacks** by default (backend/nixpacks.toml) or Dockerfile if configured.
