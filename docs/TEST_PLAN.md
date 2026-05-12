# Test Plan — HOS Logbook

End-to-end test plan validating every requirement from the assessment brief plus the "production-ready" follow-up. Each test case records expected vs actual behavior. Executed manually via Playwright MCP against `http://localhost:5173`.

## Status legend
- ✅ Passing
- ❌ Failing
- ⏳ Pending

---

## R1 — Assessment brief requirements (must pass)

### R1.1 Inputs
| Case | Expected | Status |
|---|---|---|
| Current location text input accepts free-form city/state | Geocodes successfully (fixture or live ORS) | ✅ |
| Pickup location text input accepts free-form city/state | Same | ✅ |
| Dropoff location text input accepts free-form city/state | Same | ✅ |
| Current cycle used (hrs) accepts number 0–70 | Validated by zod; rejects negative & >70 | ✅ |
| Depart datetime picker accepts local datetime | Combined with timezone field on backend | ✅ |

### R1.2 Outputs — Map
| Case | Expected | Status |
|---|---|---|
| Map renders a route polyline between the 3 points | Leaflet polyline visible | ✅ |
| Markers for pickup, dropoff, fuel, breaks, rests, restart | One divIcon per StopKind | ✅ |
| Free map API (no credit card) | Leaflet + OSM tiles + ORS free key | ✅ |
| Marker popup shows label, mile marker, ETA, duration, note | Click any marker | ✅ |

### R1.3 Outputs — Daily log sheets
| Case | Expected | Status |
|---|---|---|
| 24-hour grid drawn for each trip day | SVG grid with 4 status rows × 96 quarter-hours | ✅ |
| Multiple log sheets for multi-day trips | Brooklyn → LA produces 6 sheets | ✅ |
| Status line drawn correctly with transitions | Black polyline, vertical connectors | ✅ |
| Red dot vertices at each transition | Visible on every status change | ✅ |
| Hour labels at TOP and BOTTOM of grid | Both rows of "M, 1–11, N, 1–11" | ✅ |
| Quarter-hour tick marks inside each row | Light blue minor ticks | ✅ |
| Right-edge totals column ("HOURS") | Per-status totals + TOTAL | ✅ |
| Remarks: leader lines + rotated labels per stop | 2-line labels staggered to avoid overlap | ✅ |

### R1.4 Assumptions enforced
| Case | Expected | Status |
|---|---|---|
| Property-carrying, 70 hr / 8 day | Cycle clock visible & enforced | ✅ |
| Fuel ≥ every 1,000 mi | Fuel stop inserted at mile 1000, 2000, etc. | ✅ |
| 1 hr pickup + 1 hr dropoff | Onduty 60-min events | ✅ |

---

## R2 — FMCSA Part 395 rules engine

| Case | Expected | Status |
|---|---|---|
| 11-hr driving limit | After 11 hrs, 10-hr off inserted | ✅ |
| 14-hr on-duty window | Triggers 10-hr off if hit before 11-hr driving | ✅ |
| 30-min break after 8 hrs driving | Onduty 30-min event inserted | ✅ |
| 10-hr off-duty resets | drive/window/break counters zeroed | ✅ |
| 70-hr / 8-day cycle | 34-hr restart inserted if exceeded | ✅ |
| Day totals sum to exactly 24.00 | Confirmed across all 6 days of canonical trip | ✅ |

## R3 — Polished features

| Case | Expected | Status |
|---|---|---|
| Officer View toggle (high-contrast, large text, read-only) | `.officer-view` class on `<html>`, tokens flip | ✅ |
| Day / Night theme toggle | `.dark` class on `<html>`, palette flips | ✅ |
| PDF export per day | ReportLab PDF mirrors SVG layout | ✅ |
| Full-trip PDF (multi-page) | One page per day | ✅ |
| Print stylesheet | `@media print` strips chrome | ✅ |
| GSAP route draw-on animation | Polyline reveals over 700ms | ✅ |
| DaySwitcher sliding indicator | GSAP-driven indicator pill | ✅ |
| Demo seed button | One-click prefill with canonical trip | ✅ |
| Audit-storable logs | All persisted in Neon Postgres | ✅ |
| Cycle violation flag | "Plan adjusted (n)" pill with details | ✅ |

## R4 — Paper-log faithful rendering (matches reference image)

| Case | Expected | Status |
|---|---|---|
| Driver's signature in cursive script | Caveat font | ✅ |
| (DRIVER'S SIGNATURE IN FULL) caption | All-caps small label below | ✅ |
| (NAME OF CO-DRIVER) field | — placeholder | ✅ |
| (TOTAL DRIVING MILES TODAY) | Numeric value | ✅ |
| End date boxes (Month / Day / Year) | Three small boxes | ✅ |
| (HOME OPERATING CENTER AND ADDRESS) | Pickup or current location | ✅ |
| VEHICLE NUMBERS — T___ T___ T___ | Three trucks slots | ✅ |
| (TOTAL TRUCK MILEAGE TODAY) | Numeric value | ✅ |
| Carrier line | Carrier name + city | ✅ |
| SHIPPER / COMMODITY / LOAD NO. footer | Bottom strip | ✅ |
| 7-day RECAP rolling hours | Per FMCSA §395.8(j) | ✅ |
| Pre-trip / Post-trip inspection mention | Added to header per §396.13 | ✅ |
| Shipping Document / BOL number | Header + footer | ✅ |
| Available hours tomorrow | 70 − 7-day total, color-coded | ✅ |

---

## R5 — Playwright E2E run (executed 2026-05-12)

| Flow | Result |
|---|---|
| `/plan` renders form with 5 inputs | ✅ |
| Demo seed button prefills canonical Brooklyn → LA values | ✅ |
| Submit POSTs `/api/v1/trips/` and navigates to `/trip/:id` | ✅ |
| Trip page shows summary strip, HOS clocks, map, stops list, day tabs, log sheet | ✅ |
| Day tabs show correct per-day hours (11.0h / 11.0h / 11.0h / 0h / 11.0h / 0.8h) | ✅ |
| Tab click switches the active day | ✅ |
| Each day's grid totals sum to exactly 24.00 | ✅ |
| Officer View toggle flips the entire app to high-contrast b/w | ✅ |
| Night Mode toggle flips palette to dark, contrast meets AAA | ✅ |
| Trips list `/trips` shows all created trips with route arrows + timestamps | ✅ |
| `GET /trips/:id/logs/:date/pdf` returns valid 1-page PDF | ✅ |
| `GET /trips/:id/logs.pdf` returns 6-page PDF, one per day | ✅ |
| 7-day recap section visible on screen and PDF | ✅ |
| BOL- prefixed shipping document number visible | ✅ |
| Pre/Post-trip inspection checkboxes visible | ✅ |
