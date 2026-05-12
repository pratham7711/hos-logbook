# Loom Script — 4 minutes

A tight 4-minute walkthrough. Each beat has on-screen direction (the **clicks to do**), and the lines to **say verbatim**. Pace ~120 wpm.

## Quick links

| What | URL |
|---|---|
| **Frontend (Vercel, public)** | https://frontend-mu-five-51.vercel.app |
| **Backend (Render, public)** | https://hos-logbook-backend.onrender.com |
| **Backend health check** | https://hos-logbook-backend.onrender.com/healthz |
| **GitHub repo** | https://github.com/pratham7711/hos-logbook |

## Tabs to pre-open before recording

1. https://frontend-mu-five-51.vercel.app/plan (the live app)
2. VS Code window with these files visible in tabs (already opened for you):
   - `backend/apps/hos/engine.py`
   - `backend/apps/hos/state.py`
   - `backend/apps/trips/services/plan_trip_service.py`
   - `backend/apps/logs/services/pdf.py`
   - `frontend/src/components/LogGrid/LogGrid.tsx`
   - `frontend/src/components/LogSheet/LogSheet.tsx`
   - `frontend/src/components/TripForm/AutocompleteInput.tsx`
   - `docs/LOOM_SCRIPT.md` (this file)
3. https://github.com/pratham7711/hos-logbook (for the architecture/closer)

Pre-recording setup:
- Disable browser notifications and Slack/Mail badges
- Close the browser's bookmarks bar so the URL has more vertical room
- Use Loom in `Tab + Camera bubble` mode

---

## Beat 1 · Cold open (0:00 → 0:25)

**On screen:** the live `/plan` hero, full-screen. **Don't interact yet** — let it sit while you talk.

**Say:**
> "This is HOS Logbook — a full-stack trip planner and electronic logbook for property-carrying truck drivers. You enter four trip details, and it returns an FMCSA Part 395-compliant route with stops, plus daily log sheets that mirror the paper format drivers use today. Live on Vercel and Render, source on GitHub. Let me show you."

---

## Beat 2 · The demo trip (0:25 → 1:15)

**Steps to do on screen, in order:**

1. Click the **"Use my location"** button on the Current location field.
2. Wait 1 second — the field fills with your reverse-geocoded city.
3. Click in the **Pickup location** field, type "New York" — let the dropdown appear, point your cursor at one of the suggestions (don't click).
4. Click the **"Try the canonical Brooklyn → LA demo"** button — all three fields prefill, cycle hours become 35.
5. Click **"Plan trip"**.
6. While the trip loads (~1s), the route polyline animates and stop markers stagger in.

**Say (during the steps):**
> "Current location can use the browser's geolocation — reverse-geocoded via Nominatim, the free OpenStreetMap endpoint. Pickup and Dropoff have typeahead suggestions from the same API — no key, no signup. I'll skip ahead with the canonical demo trip: Brooklyn to Chicago to LA, with the driver already at 35 hours used on their 70-hour cycle."

**Say (after the trip page loads):**
> "On submit, the Django backend planned the trip in about a second. The polyline animates in with GSAP, every stop kind gets its own marker — pickup, dropoff, fuel every thousand miles, thirty-minute breaks, ten-hour resets, and one 34-hour restart that the engine inserted automatically when the seventy-hour cycle would otherwise have been exceeded."

---

## Beat 3 · The daily log sheet (1:15 → 2:00)

**Steps to do on screen:**

1. Scroll down to the **Daily logs** section.
2. Click the **Wed 13 May** tab in the day switcher.
3. Slow-zoom or hover over the header to highlight: the **cursive signature**, the **co-driver field**, the **end-date boxes**, **vehicle numbers**, **pre-trip / post-trip checkboxes**, **BOL number**.
4. Hover over the grid so the red dots and the dual hour labels are visible.
5. Point at the **totals column** on the right reading **24.00**.
6. Scroll a bit further to the **7-day Recap** card and point at "Hours available tomorrow".
7. Click the **"Day PDF"** button — a new tab opens with the rendered PDF.

**Say:**
> "Six daily logs, one for each service day. The grid mirrors the FMCSA paper format — driver's signature in cursive, name of co-driver, total driving miles, end-date boxes, home operating center, vehicle numbers, pre-trip and post-trip inspection checkboxes per §396.13, and the BOL shipping document number. Twenty-four hours along the top and bottom, light blue grid, red-dot vertices at every status transition, leader lines down to remarks — exactly what an inspector expects to see."

> "Every day's grid sums to exactly twenty-four hours. The seven-day recap at the bottom — required by §395.8(j) — shows rolling on-duty hours and how many hours the driver has available tomorrow."

> "And every day exports as a PDF with the same layout. The on-screen SVG and the ReportLab PDF read from the same event array, so they're identical by construction."

---

## Beat 4 · Polish (2:00 → 2:30)

**Steps:**

1. Click the **Officer** toggle in the top right of the header.
2. Page flips to high-contrast black/white — narrate while it transitions.
3. Click **Officer** again to toggle off.
4. Click the **moon icon** (theme toggle) — page flips to dark Night mode.
5. (Optional) toggle back to day before moving on.

**Say:**
> "Officer View is one click — a high-contrast read-only mode for roadside inspections. Night mode for in-cab visibility, with WCAG AAA contrast. Every component is token-driven, so it adapts automatically."

---

## Beat 5 · Code tour (2:30 → 3:30)

**Steps:**

1. **Switch to VS Code.** Open the tab `backend/apps/hos/engine.py`.
2. Scroll to the `plan_trip` function header. Hover over the `while state.miles_done < total_miles` loop — point with your cursor at the priority comments (break → 10-hr → 34-hr → drive).
3. Scroll down to `_drive_until` so the constraint cap is visible.
4. Switch to the tab `frontend/src/components/LogGrid/LogGrid.tsx`.
5. Scroll to the JSX section that renders status polyline + red dots — point at the `<circle>` element loop.
6. Switch to `backend/apps/trips/services/plan_trip_service.py`.
7. Scroll to the `create_and_plan_trip` function — point at the four steps (geocode, directions, plan_trip, persist).

**Say:**
> "Behind it, the load-bearing piece is a pure-Python state machine. `plan_trip` walks until the driver reaches the dropoff. At each iteration it picks exactly one action by priority — thirty-minute break when eight cumulative driving hours are reached, ten-hour off-duty when the eleven or fourteen-hour limits hit, thirty-four-hour restart only when the seventy-hour cycle would otherwise be exceeded, then drive toward the next waypoint."

> "Inside `_drive_until`, the simulator caps the drive to the soonest of those constraints and emits a partial driving segment. The outer loop's next iteration fires the right reset."

> "On the front end, the LogGrid is a single SVG component — quarter-hour ticks, dual hour labels, status polyline, red dots at every transition, leader-line remarks — all driven by the same event array. The ReportLab PDF on the backend mirrors this geometry exactly, so the digital and paper outputs are guaranteed to match."

> "The orchestrator is one function — geocode the three locations, get the route from OpenRouteService with the truck profile, run the HOS engine, persist the schedule. One transaction. The trip plans in under a second."

---

## Beat 6 · Architecture + close (3:30 → 4:00)

**Steps:**

1. Switch to the GitHub repo tab — scroll to the architecture section or just to the file tree.
2. Optionally open `backend/apps/hos/tests/test_engine.py` for a glimpse of the assertions (don't read them).
3. End on the live `/plan` page or the GitHub URL.

**Say:**
> "Frontend on Vercel, backend on Render's free tier, Postgres on Neon, routing through OpenRouteService — all free, no credit card anywhere. Six unit tests cover the canonical Brooklyn-to-LA trip and pin the expected violation. End-to-end tested via Playwright, both local and production. Source is on GitHub, ready to fork. Thanks for watching."

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

If you run long, drop "no credit card anywhere" in Beat 6 and "One transaction." in Beat 5 — each buys ~3 seconds.

## Recording tips

- Speak slightly slower than your natural pace — Loom playback at 1.0x feels rushed otherwise.
- Pause between beats for half a second; Loom won't cut them.
- Mouse: always move *to* the thing before talking about it. Reader's eye follows the cursor.
- If you fumble, just keep going — Loom lets you trim trivially after.
