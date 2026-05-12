# Loom script — HOS Logbook walkthrough

Target runtime: 4 to 5 minutes. Tone: calm, confident, no salesy lift in the voice. Speak as if a senior engineer is watching at 1.5x.

---

## 0:00 – 0:30 — Cold open

**On screen:** `/plan` page, fresh load, hero visible.

> "This is HOS Logbook. The brief was: take a driver's current location, pickup, dropoff, and current cycle hours, and produce a route plus the daily ELD log sheets — compliant with FMCSA Part 395."

> "I built it as a Django plus React app. The HOS engine is a pure Python state machine. The same event array drives both the on-screen grid and the printed PDF. I'll show you the demo first, then walk the code."

---

## 0:30 – 1:30 — Canonical demo

**Action:** click **Try the canonical Brooklyn → LA demo**, then **Plan trip**.

> "I've wired in a one-click demo. Brooklyn to Chicago to Los Angeles, departing today at 8 AM Eastern, with 35 hours already used in the current 70 over 8 cycle."

**As the route draws in:**

> "The route comes back from OpenRouteService — real road geometry, not a great-circle line. The draw-on is GSAP. The markers are the pickup, dropoff, three fuel stops, four 10-hour resets, and one 34-hour restart that the engine inserted automatically — I'll explain that in a moment."

**Pan the map briefly.**

> "Distance is 2,789 miles, planned over six service days."

---

## 1:30 – 2:30 — Daily logs and the 34-hour restart

**Action:** click into Day 1's log sheet.

> "Each day renders as a standard ELD log sheet. The grid is an SVG, drawn from the event array. Off-duty, sleeper berth, driving, on-duty-not-driving — four rows, status flags at every transition, mileage on the right, remarks at the bottom."

**Switch to Day 4 using DaySwitcher.**

> "Day 4 is where it gets interesting. Without intervention, the next driving block would push the rolling 8-day total past 70 hours. The engine detects that, inserts a 34-hour restart, and resumes on Day 5. You can see the restart block here, and the violations badge stays at zero."

**Hover the violations badge.**

> "If the engine could not satisfy the cycle even with a restart, it would surface a specific violation here — the rule code, the time window, and the segment that triggered it. On this trip there are none."

---

## 2:30 – 3:30 — Officer View, Night mode, PDFs

**Action:** toggle Officer View.

> "Officer View is high-contrast, read-only, and optimized for someone glancing at a phone in daylight at the side of a road. No theme toggles, no navigation chrome — just the sheets."

**Toggle back, then flip to Night mode.**

> "Night mode persists per device. Driver-friendly contrast."

**Click Download day PDF, then Download full trip PDF.**

> "PDFs are server-rendered with ReportLab from the same event array as the SVG. Single-day, or all six days in one file. Open it — the grid is pixel-identical to the screen."

---

## 3:30 – 4:30 — Code tour

**Action:** open `apps/hos/engine.py`.

> "The engine is here. It's a pure state machine — no Django, no I/O. Given a list of route segments and the driver's current cycle position, it walks forward and yields events. Priority order is fixed: 30-minute break first, then 10-hour off-duty, then 34-hour restart, then drive. That ordering is the whole compliance contract."

**Open `apps/trips/services/plan_trip_service.py`.**

> "The orchestrator is here. Geocode the three addresses, call ORS for the route, hand the segments to the engine, split by service day, persist, return. One function, easy to test."

**Open `frontend/src/components/LogGrid/`.**

> "On the frontend, the grid is one SVG component. Events in, paths out. It accepts the same array shape the PDF renderer consumes, so the two can never drift."

---

## 4:30 – 5:00 — Architecture and sign-off

**Action:** back to `/plan`.

> "Frontend is on Vercel. Backend on Render free tier. Postgres on Neon. Routing through OpenRouteService. A cron-job.org ping keeps Render warm."

> "Every rule enforced here cites a specific section of FMCSA Part 395. The README has the rule table and the worked example. Source is on GitHub. Thanks for watching."
