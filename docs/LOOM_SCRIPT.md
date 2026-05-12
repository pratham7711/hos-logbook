# Loom Script — 4 minutes

A tight 4-minute walkthrough. Each beat has on-screen direction and the lines to say verbatim. Pace ~120 wpm.

**Links to keep open in tabs before recording:**
1. `https://frontend-mu-five-51.vercel.app/plan`
2. `https://github.com/pratham7711/hos-logbook` → `backend/apps/hos/engine.py`
3. `https://github.com/pratham7711/hos-logbook` → `backend/apps/trips/services/plan_trip_service.py`
4. `https://github.com/pratham7711/hos-logbook` → `frontend/src/components/LogGrid/LogGrid.tsx`
5. `https://hos-logbook-backend.onrender.com/healthz` (proves backend is live)

Render and microphone — go.

---

## Beat 1 · Cold open (0:00 → 0:25)

**Show:** the live `/plan` hero, full-screen.

> "This is HOS Logbook — a full-stack trip planner and electronic logbook for property-carrying truck drivers. You enter four trip details, and it returns an FMCSA Part 395-compliant route with stops, plus daily log sheets that mirror the paper format drivers use today. Live on Vercel and Render, source on GitHub. Let me show you."

---

## Beat 2 · The demo trip (0:25 → 1:15)

**Show:** click "Use my location" → it fills the field. Then click the demo button — pre-fills Brooklyn → Chicago → LA, cycle 35 hours. Click "Plan trip". Trip page loads.

> "Current location can use the browser's geolocation — reverse-geocoded via Nominatim, the free OpenStreetMap endpoint. Pickup and Dropoff have typeahead suggestions from the same API — no key, no signup. I'll skip ahead with the canonical demo trip: Brooklyn to Chicago to LA, with the driver already at 35 hours used on their 70-hour cycle."

**Show:** the trip page rendering — map polyline draws on, markers appear staggered, HOS clocks fill in.

> "On submit, the Django backend planned the trip in about a second. The polyline animates in with GSAP, every stop kind gets its own marker — pickup, dropoff, fuel every thousand miles, thirty-minute breaks, ten-hour resets, and one 34-hour restart that the engine inserted automatically when the seventy-hour cycle would otherwise have been exceeded."

---

## Beat 3 · The daily log sheet (1:15 → 2:00)

**Show:** scroll to day switcher, click Wed 13 May. The paper-faithful log sheet renders.

> "Six daily logs, one for each service day. The grid mirrors the FMCSA paper format — driver's signature in cursive, name of co-driver, total driving miles, end-date boxes, home operating center, vehicle numbers, pre-trip and post-trip inspection checkboxes per §396.13, and the BOL shipping document number. Twenty-four hours along the top and bottom, light blue grid, red-dot vertices at every status transition, leader lines down to remarks — exactly what an inspector expects to see."

**Show:** highlight the totals column on the right reading 24.00, then scroll to the recap.

> "Every day's grid sums to exactly twenty-four hours. The seven-day recap at the bottom — required by §395.8(j) — shows rolling on-duty hours and how many hours the driver has available tomorrow."

**Show:** click "Day PDF". A 1-page PDF opens.

> "And every day exports as a PDF with the same layout. The on-screen SVG and the ReportLab PDF read from the same event array, so they're identical by construction."

---

## Beat 4 · Polish (2:00 → 2:30)

**Show:** toggle Officer View. Page flips to high-contrast black/white. Toggle Night mode.

> "Officer View is one click — a high-contrast read-only mode for roadside inspections. Night mode for in-cab visibility, with WCAG AAA contrast. Every component is token-driven, so it adapts automatically."

---

## Beat 5 · Code tour: the engine (2:30 → 3:30)

**Show:** open `backend/apps/hos/engine.py`. Scroll to `plan_trip`.

> "Behind it, the load-bearing piece is a pure-Python state machine. `plan_trip` walks until the driver reaches the dropoff. At each iteration it picks exactly one action by priority — thirty-minute break when eight cumulative driving hours are reached, ten-hour off-duty when the eleven or fourteen-hour limits hit, thirty-four-hour restart only when the seventy-hour cycle would otherwise be exceeded, then drive toward the next waypoint."

**Show:** scroll to the `_drive_until` function.

> "Inside `_drive_until`, the simulator caps the drive to the soonest of those constraints and emits a partial driving segment. The outer loop's next iteration fires the right reset. No magic — just rules in priority order."

**Show:** open `frontend/src/components/LogGrid/LogGrid.tsx`. Scroll to where transitions and red dots are emitted.

> "On the front end, the LogGrid is a single SVG component — quarter-hour ticks, dual hour labels, status polyline, red dots at every transition, leader-line remarks — all driven by the same event array. The ReportLab PDF on the backend mirrors this geometry exactly, so the digital and paper outputs are guaranteed to match."

**Show:** briefly open `plan_trip_service.py`.

> "The orchestrator is one function — geocode the three locations, get the route from OpenRouteService with the truck profile, run the HOS engine, persist the schedule. One transaction, no jobs queue — the trip plans in under a second."

---

## Beat 6 · Architecture + close (3:30 → 4:00)

**Show:** README architecture diagram (or just say it).

> "Frontend on Vercel, backend on Render's free tier, Postgres on Neon, routing through OpenRouteService — all free, no credit card anywhere. Six unit tests cover the canonical trip and pin the expected violation. End-to-end tested via Playwright, both local and production. Source is on GitHub, ready to fork. Thanks for watching."

---

## Final timing check (target: 4:00 ± 10s)

| Beat | End time | Cum. words |
|---|---|---|
| 1 — Cold open | 0:25 | ~55 |
| 2 — Demo trip | 1:15 | ~165 |
| 3 — Log sheet | 2:00 | ~265 |
| 4 — Polish | 2:30 | ~315 |
| 5 — Code tour | 3:30 | ~420 |
| 6 — Architecture | 4:00 | ~485 |

If you run long, drop the "no credit card anywhere" line in Beat 6 and the "no jobs queue" sentence in Beat 5 — buys 5 seconds each.

## Recording tips
- Open all 5 tabs in advance (URLs above). Use Command-1 through 5 to jump between them.
- Disable browser notifications.
- Use Loom's "Auto-frame" off for code tabs so the file path stays readable.
- Hover the map markers briefly during Beat 2 to show popups — don't click them (popups break flow).
- For Beat 5, have the engine state-machine `while` loop visible top-of-viewport so the priority order reads naturally.
