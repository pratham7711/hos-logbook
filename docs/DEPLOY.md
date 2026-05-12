# Deploy Guide

This app is hosted as a split deploy:

- **Frontend** — Vercel (public)
- **Backend** — Render (Python web service, free tier)
- **DB** — Neon Postgres (free) *or* skip and use Render's ephemeral SQLite

## Current live URLs

| Service | URL |
|---|---|
| Frontend (Vercel, public) | https://frontend-mu-five-51.vercel.app |
| Backend (Render — needs setup) | `https://hos-logbook-backend.onrender.com` *(after step 1 below)* |
| GitHub repo | https://github.com/pratham7711/hos-logbook |

---

## 1. Deploy the backend to Render — 3 minutes

> Render's free tier supports Python web services. The repo already contains a `render.yaml` blueprint so most of this is automatic.

### Quick path (blueprint)

1. Open this link in a browser (signs you in with GitHub if needed):
   **<https://dashboard.render.com/blueprints>**
2. Click **"New Blueprint Instance"**.
3. **Connect** the `pratham7711/hos-logbook` repo.
4. Render auto-detects `render.yaml` and proposes one Web Service called `hos-logbook-backend`. Click **Apply**.
5. Render will ask for two secrets it can't auto-generate:
   - `ORS_API_KEY` — get a free key at <https://openrouteservice.org/dev/#/signup>, paste it here. *(Optional — leave blank and the app will use bundled offline routing fixtures; the demo still works.)*
   - `DATABASE_URL` — leave blank and the app falls back to SQLite (fine for the assessment demo, resets on redeploy). Or paste your Neon connection string for persistent storage (see §2 below).
6. Click **Apply** again. Render builds and deploys — wait ~3 minutes for "Live".

### Manual path (no blueprint)

If you'd rather configure it yourself:

| Field | Value |
|---|---|
| Type | Web Service |
| Repository | `pratham7711/hos-logbook` |
| Branch | `main` |
| Root Directory | `backend` |
| Runtime | Python 3 |
| Build Command | `pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate && python manage.py createcachetable` |
| Start Command | `gunicorn hos_project.wsgi --workers 2 --threads 2 --timeout 60 --bind 0.0.0.0:$PORT` |
| Health Check Path | `/healthz` |
| Plan | Free |

Environment variables (set in dashboard → Environment):

```
DJANGO_SECRET_KEY     <click "Generate">
DJANGO_DEBUG          0
ALLOWED_HOSTS         hos-logbook-backend.onrender.com
CORS_ALLOWED_ORIGINS  https://frontend-mu-five-51.vercel.app
ROUTING_USE_FIXTURES  1
ORS_API_KEY           <optional>
DATABASE_URL          <optional — leave empty for SQLite fallback>
```

---

## 2. Optional — Neon Postgres for persistent storage

1. Open <https://console.neon.tech/signup> → sign in with GitHub.
2. Create project `hos-logbook` (any region).
3. Copy the **pooled** connection string (must end in `?sslmode=require`).
4. Paste it into Render's `DATABASE_URL` env var.
5. Redeploy.

---

## 3. Wire the frontend to the new backend URL

The Vercel project already has `VITE_API_BASE_URL=https://hos-logbook-backend.onrender.com/api/v1` set as a production env var. If Render assigns a different URL:

```bash
cd frontend
vercel env rm VITE_API_BASE_URL production
echo "https://<your-render-url>/api/v1" | vercel env add VITE_API_BASE_URL production
vercel --prod
```

If the URL matches `hos-logbook-backend.onrender.com`, just trigger a redeploy:

```bash
cd frontend
vercel --prod
```

---

## 4. Keep-alive ping (avoid Render's 15-min cold starts)

Render free instances sleep after 15 min idle. Set up a free cron at <https://cron-job.org>:

- URL: `https://hos-logbook-backend.onrender.com/healthz`
- Interval: every 10 minutes
- Method: GET

`/healthz` is a no-DB-hit endpoint specifically for this purpose.

---

## Verification

Once both are deployed, smoke test:

```bash
# Backend liveness
curl https://hos-logbook-backend.onrender.com/healthz
# {"ok": true}

# End-to-end plan (~2s)
curl -X POST https://hos-logbook-backend.onrender.com/api/v1/trips/ \
  -H 'Content-Type: application/json' \
  -d '{"current_location":"Brooklyn, NY","pickup_location":"Chicago, IL","dropoff_location":"Los Angeles, CA","cycle_used_hours":35,"depart_at":"2026-05-12T08:00","timezone":"America/New_York"}' \
  | python3 -m json.tool | head -20
```

Then open <https://frontend-mu-five-51.vercel.app> and click "Try the canonical Brooklyn → LA demo".
