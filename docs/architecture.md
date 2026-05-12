# Architecture

A one-page technical brief on how a `POST /api/v1/trips/` becomes a route, a set of stops, and a set of daily ELD log sheets.

## Data flow

```
TripForm (React)
     |
     | POST /api/v1/trips/
     v
TripsViewSet.create (DRF)
     |
     v
plan_trip_service.plan(payload)
     |
     +--> routing.ors_client.geocode(x3)        # current / pickup / dropoff
     |
     +--> routing.ors_client.route(coords)      # GeoJSON LineString + duration + distance
     |
     +--> routing.geometry.segmentize(route)    # split route at pickup, dropoff, fuel anchors
     |
     +--> hos.engine.simulate(segments, cycle_used_hours, depart_at)
     |        -> list[Event]   (off / sleeper / driving / on_duty)
     |
     +--> hos.splitter.by_day(events)
     |        -> list[DailyLog]
     |
     +--> persist(Trip, Stop[], DailyLog[])
     |
     v
PlanResponse JSON  (route geojson, stops, daily_logs)
     |
     v
React Query cache
     |
     +--> MapView   (Leaflet + GSAP draw-on)
     +--> LogSheet  (DaySwitcher + LogGrid SVG)
     +--> PDFLinks  (server-side ReportLab)
```

Three external dependencies: ORS for geocode and routing, Neon Postgres for persistence, and the browser for everything else. ReportLab runs in-process on Render.

## HOS state machine

`apps/hos/engine.py` is a pure function: segments in, events out. No Django, no clock, no network. The simulator iterates over route segments in order. At each step it asks, in this fixed priority order, whether a rule forces a non-driving event before the next driving minute can be consumed:

1. **30-minute break** — if cumulative driving since the last 30+ minute interruption is at or above 8 hours, insert a 30-min off-duty event before any further driving. (Part 395.3(a)(3)(ii).)
2. **10-hour off-duty reset** — if the 11-hour driving limit or the 14-hour driving window would be breached by the next minute of driving, insert a 10-hour off-duty event, then reset both clocks. (Part 395.3(a)(1) and (a)(2).)
3. **34-hour restart** — if the rolling 8-day on-duty total would exceed 70 hours, insert a 34-hour off-duty block, then reset the 8-day window. (Part 395.3(c).)
4. **Drive** — otherwise, advance driving time by the next available minute of the current route segment.

This priority order is the compliance contract. Reordering it produces logs that look plausible but violate Part 395 in subtle ways — for example, a driver who hits the 11-hour cap and the 8-hour break trigger on the same minute must take the 30-min break first, because the 10-hour reset is only required once the cap is actually breached.

Pickup and dropoff are modeled as 1-hour on-duty-not-driving events at the relevant route waypoints. Fuel stops are 15-minute on-duty events anchored every 1,000 miles of cumulative odometer; they consume the 14-hour window but not the 11-hour driving cap.

The engine returns a flat array:

```python
@dataclass(frozen=True)
class Event:
    status: Literal["off", "sleeper", "driving", "on_duty"]
    start: datetime         # tz-aware, driver-local
    end:   datetime
    location: str | None    # human label, e.g. "Joliet, IL (fuel)"
    remark:   str | None    # carries rule code on auto-inserted events
```

Events are contiguous and non-overlapping. The sum of their durations always equals the trip duration.

## Per-day splitting

`apps/hos/splitter.py` consumes the flat event array and emits one `DailyLog` per service day. The splitter:

- Walks events in order, partitioned by the driver-local calendar date of `event.start`.
- When an event crosses midnight, the splitter clones it into two events with adjusted `start`/`end` and marks the second with a `carry_over=True` flag for the remarks column.
- Computes totals per status per day (off, sleeper, driving, on-duty), in hours rounded to the nearest 15 minutes — the granularity FMCSA log sheets are graded on.
- Records a `cycle_used_at_end_of_day` value, which the frontend uses to show the 70/8 budget remaining at a glance.

The output is what both the SVG grid and the PDF renderer consume. They do not call the engine independently.

## SVG-PDF mirroring guarantee

Two render paths exist — the React `LogGrid` SVG component and the ReportLab PDF — but both accept the same `events: Event[]` array for a given day. Concretely:

- `frontend/src/components/LogGrid/LogGrid.tsx` takes `{ events, date }` props and emits one SVG `<path>` per status row, plus status-flag tick marks at every transition.
- `backend/apps/logs/services/pdf.py:render_day(events, date)` calls into the same grid geometry constants (cell width in points, row heights, midnight anchors) ported to ReportLab coordinates.

Both implementations share a small TypeScript-and-Python parallel constants file containing only the grid dimensions and the four status row offsets. Anything that affects how a status is drawn — start time, end time, status, label, remark — comes from the event array. There is no second source of truth.

Practical consequence: when a driver downloads the PDF for a day, what they see on paper is what they saw on screen, down to the position of every flag. The reviewer should be able to open the SVG in dev tools, count flags, open the PDF, count flags, and get the same number.

## Persistence model

```
Trip (id, driver_name, carrier_name, truck_number, depart_at, summary)
  └── DailyLog (date, totals, cycle_used_at_end_of_day, events JSON)
  └── Stop     (kind, location, lat, lng, scheduled_at, duration_min)
```

Events are denormalized as JSON on `DailyLog` rather than rows on a separate table. That keeps reads to one query per day and avoids a brittle N+1 when rendering the LogsPage. Stops are normalized because the map needs to query them spatially.

## Testing strategy

- `apps/hos/tests/test_engine.py` — unit tests per rule. Each test feeds a hand-constructed segment list and asserts the exact event sequence.
- `apps/hos/tests/test_engine_canonical.py` — the Brooklyn → LA scenario from the README, asserting six daily logs, one 34-hour restart, and zero violations.
- `apps/hos/tests/test_splitter.py` — midnight-cross splitting, totals rounding, cycle-used carry-forward.
- `apps/trips/tests/test_plan_trip_service.py` — integration test with mocked ORS responses.
- Frontend tests focus on the LogGrid rendering pure event arrays; they snapshot the SVG path output.

No HOS rule is enforced in two places. If the engine says a 34-hour restart belongs at hour 47 of the trip, the splitter places it on the correct day, the grid draws it on the correct row, and the PDF prints it at the correct pixel — all from one decision made in `engine.py`.
