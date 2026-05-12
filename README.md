# HOS Logbook

> A trip planner and electronic logbook for property-carrying commercial drivers, built to FMCSA Part 395 Hours-of-Service rules.

[![Live Demo](https://img.shields.io/badge/Live-Demo-5b6cff?style=for-the-badge)](#demo)
[![Stack](https://img.shields.io/badge/Stack-Django%20%2B%20React-0f1320?style=for-the-badge)](#tech-stack)
[![Compliance](https://img.shields.io/badge/Compliance-FMCSA%20Part%20395-success?style=for-the-badge)](#the-hos-rules)

## What it does

Enter your current location, pickup, dropoff, and current cycle hours. The app plans a compliant route, schedules every rest, break, and fuel stop required by Part 395, and renders the daily ELD log sheets you would otherwise draw by hand. Multi-day trips paginate cleanly; a 34-hour restart is auto-inserted when the 70/8 cycle would otherwise be exceeded.

![hero](./docs/hero.png)

## Features

- Route planning with real road geometry (OpenStreetMap + OpenRouteService), pickup/dropoff/fuel/rest markers, and a smooth GSAP draw-on animation.
- FMCSA-compliant HOS engine implemented as a pure-Python state machine; the same event array drives both the on-screen grid and the PDF.
- Interactive 24-hour SVG grid per day with the four duty statuses, status flags, mileage column, and violation badges.
- Multi-day auto-pagination — one log sheet per service day, with carry-over remarks and per-day totals.
- PDF export for any single day and for the full trip, rendered server-side with ReportLab so the printed grid is pixel-identical to the SVG.
- Officer View: high-contrast, read-only, optimized for a roadside inspector glancing at a phone.
- Day / Night theme toggle that persists per device.
- Offline-mode dev fixtures so the frontend works without the live ORS key during development.

## The HOS rules

| Rule | Limit | Trigger |
|------|-------|---------|
| Driving limit | 11 hours | After 10 consecutive hours off-duty |
| Driving window | 14 hours | From first on-duty event after a 10-hr reset |
| 30-minute break | 30 min off-duty or sleeper | After 8 cumulative hours of driving without a 30-min interruption |
| Daily reset | 10 hours off-duty | Resets the 11-hr and 14-hr clocks |
| Weekly cycle | 70 hours in 8 days | Sum of all on-duty time over a rolling 8-day window |
| 34-hour restart | 34 consecutive hours off-duty | Auto-inserted when the next planned segment would breach the 70/8 cycle |

Assumptions baked into the planner: property-carrying driver, no adverse conditions, fuel at least every 1,000 mi, 1 hour on-duty for pickup, 1 hour on-duty for dropoff.

## Architecture

```
                    +-----------------+
                    |   TripForm.tsx  |
                    +--------+--------+
                             |
                             | POST /api/v1/trips/
                             v
                    +-----------------+
                    | plan_trip_      |
                    | service.py      |
                    +---+---+-----+---+
                        |   |     |
            geocode <---+   |     +---> persist Trip / DailyLog / Stop
                            |
                            v
              +-------------+-------------+
              |  routing.ors_client       |
              |  routing.geometry         |
              +-------------+-------------+
                            |
                            v
                    +-------+-------+
                    |  hos.engine   |   pure state machine
                    +-------+-------+
                            |
                            v
                    +-------+-------+
                    | hos.splitter  |   segments -> per-day events
                    +-------+-------+
                            |
                            v
                  full PlanResponse JSON
                            |
                            v
            +---------------+----------------+
            |        React Query cache       |
            +---+---------------+------------+
                |               |            |
                v               v            v
          MapView.tsx     LogSheet.tsx   PDF (server)
```

## Tech stack

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend | React 18 + Vite + TypeScript + Tailwind | Fast HMR, strict types, utility-first styling that compiles small. |
| Backend | Django 5 + Django REST Framework | Mature ORM, batteries for auth/migrations/admin, DRF keeps the API explicit. |
| Database | Neon Postgres (free tier) | Serverless Postgres with branching; SQLite fallback locally. |
| Map | Leaflet + OpenStreetMap tiles | No API key required for tiles; mature, lightweight. |
| Routing | OpenStreetMap + OpenRouteService | Free key, returns real road geometry and durations. |
| PDF | ReportLab | Deterministic vector output; the grid is drawn from the same event array as the SVG. |
| Hosting | Vercel (frontend) + Render (backend) + Neon (db) | All three have usable free tiers; cron-job.org pings `/healthz` to keep Render warm. |

## Worked example

Canonical demo trip — wired into the **Try the canonical Brooklyn → LA demo** button on `/plan`:

```http
POST /api/v1/trips/
Content-Type: application/json

{
  "current_location": "Brooklyn, NY",
  "pickup_location":  "Chicago, IL",
  "dropoff_location": "Los Angeles, CA",
  "cycle_used_hours": 35,
  "depart_at": "2026-05-12T08:00:00-04:00",
  "driver_name": "P. Sharma",
  "carrier_name": "Demo Carrier LLC",
  "truck_number": "T-104"
}
```

Expected output shape:

```json
{
  "id": "trip_…",
  "summary": { "distance_mi": 2789, "duration_hr": 44.2, "days": 6 },
  "route": { "type": "FeatureCollection", "features": [ … ] },
  "stops": [ /* ~14 entries: pickup, fuel x3, rest x4, 34-hr restart, dropoff */ ],
  "daily_logs": [
    { "date": "2026-05-12", "events": [ … ], "totals": { … } },
    { "date": "2026-05-13", "events": [ … ], "totals": { … } },
    /* … 6 total daily logs … */
  ]
}
```

Why six days: a fresh 70-hr cycle with 35 hrs already used leaves 35 hrs of on-duty headroom. The 2,789-mile route takes ~44 driving hours, so the engine inserts one 34-hour restart on day 4 and resumes on day 5. The full trip renders as six log sheets with a violations badge of zero.

## API reference

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/trips/` | Plan a trip; returns route geojson, stops, and daily logs. |
| `GET`  | `/api/v1/trips/{id}/` | Fetch a previously planned trip. |
| `GET`  | `/api/v1/trips/{id}/logs/` | List daily logs for a trip. |
| `GET`  | `/api/v1/trips/{id}/logs/{date}/pdf` | Single-day log PDF. |
| `GET`  | `/api/v1/trips/{id}/logs.pdf` | Full-trip PDF (all days, one file). |
| `POST` | `/api/v1/geocode/` | `{text}` → `{label, lat, lng}` via ORS. |
| `GET`  | `/healthz` | Liveness probe. |

All endpoints return JSON. The 422 body shape on validation failure matches DRF defaults.

## Local development

### Prerequisites

- Python 3.12+
- Node 20+
- Postgres optional — SQLite works locally with no further config.
- An OpenRouteService API key for live routing (or use the offline fixtures).

### Backend

```bash
cd backend
python -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env            # then edit DATABASE_URL, ORS_API_KEY
.venv/bin/python manage.py migrate
.venv/bin/python manage.py runserver
```

API now serves at `http://localhost:8000`.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env            # VITE_API_BASE=http://localhost:8000
npm run dev
```

Open `http://localhost:5173`.

### Tests

```bash
cd backend
.venv/bin/python -m pytest
```

The HOS engine has unit coverage for the 11-hr cap, 14-hr window, 30-min break trigger, 10-hr reset, 70/8 cycle, and 34-hr restart insertion.

## Deployment

### Frontend — Vercel

- Root Directory: `frontend`
- Build command: `npm run build`
- Output directory: `dist`
- Env: `VITE_API_BASE=https://<render-service>.onrender.com`

### Backend — Render (free Web Service)

- Root: `backend/`
- Build: `pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate`
- Start: `gunicorn config.wsgi:application --bind 0.0.0.0:$PORT`
- Env: `DATABASE_URL`, `ORS_API_KEY`, `DJANGO_SECRET_KEY`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`

### Database — Neon

Create a free project, copy the pooled connection string into `DATABASE_URL`.

### Routing — ORS

Free key from `openrouteservice.org/dev`. 2,000 requests/day is well above demo load.

### Keep-alive

Render's free tier sleeps after ~15 minutes idle. Point cron-job.org (free) at `https://<service>.onrender.com/healthz` every 10 minutes.

## Project structure

<details>
<summary><code>hos-logbook/</code></summary>

```
hos-logbook/
├── README.md
├── LICENSE
├── docs/
│   ├── LOOM_SCRIPT.md
│   ├── architecture.md
│   └── hero.png
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── config/                  # Django project (settings, urls, wsgi)
│   └── apps/
│       ├── hos/
│       │   ├── engine.py        # Pure-Python HOS state machine
│       │   ├── splitter.py      # segments -> per-day events
│       │   └── tests/
│       ├── routing/
│       │   ├── ors_client.py
│       │   └── geometry.py
│       ├── trips/
│       │   ├── models.py
│       │   ├── views.py         # DRF viewset
│       │   └── services/plan_trip_service.py   # orchestrator
│       └── logs/
│           ├── models.py
│           ├── views.py
│           └── services/pdf.py  # ReportLab renderer
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.ts
    └── src/
        ├── pages/
        │   ├── PlanPage.tsx
        │   ├── TripPage.tsx
        │   ├── LogsPage.tsx
        │   ├── OfficerViewPage.tsx
        │   └── TripsListPage.tsx
        ├── components/
        │   ├── TripForm/
        │   ├── MapView/
        │   ├── LogGrid/         # the 24-hr SVG grid
        │   ├── LogSheet/        # header + grid + totals + remarks
        │   └── DaySwitcher/
        ├── lib/api.ts
        └── styles/
```

</details>

## License

MIT — see [`LICENSE`](./LICENSE).

## Acknowledgements

- **FMCSA Part 395** — Hours of Service of Drivers, the regulatory source for every rule the engine enforces.
- **OpenStreetMap** contributors — base map tiles.
- **OpenRouteService** — routing API and isochrones.
- **ReportLab** — server-side PDF generation.
