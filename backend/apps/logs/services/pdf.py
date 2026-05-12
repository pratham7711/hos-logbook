"""ReportLab renderer for the FMCSA-style daily log sheet.

Mirrors the on-screen LogSheet (frontend/src/components/LogSheet/LogSheet.tsx)
1:1 so the PDF and SVG can be compared side-by-side.
"""

from __future__ import annotations

import io
import math
from dataclasses import dataclass

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas

from apps.logs.models import DailyLog
from apps.trips.models import Trip

STATUS_ROWS = ["off", "sleeper", "driving", "onduty"]
STATUS_LABELS = {
    "off": "1: OFF DUTY",
    "sleeper": "2: SLEEPER BERTH",
    "driving": "3: DRIVING",
    "onduty": "4: ON DUTY (NOT DRIVING)",
}
STOP_KIND_REMARK = {
    "pickup": "Pickup",
    "dropoff": "Dropoff",
    "fuel": "Fuel",
    "break_30": "30-min break",
    "rest_10": "10-hr off-duty",
    "restart_34": "34-hr restart",
}

# Colors (paper-log palette)
GRID_BLUE = colors.HexColor("#9eb1da")
GRID_BLUE_BOLD = colors.HexColor("#4f6dad")
LABEL_INK = colors.HexColor("#3a4f86")
HEADING_INK = colors.HexColor("#1f2d52")
DOT_RED = colors.HexColor("#e11d48")
INK = colors.HexColor("#0f1320")
FAINT = colors.HexColor("#7d8aa0")


def render_daily_log_pdf(daily_log: DailyLog, trip: Trip) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=landscape(letter))
    _draw_one_day(c, daily_log, trip)
    c.showPage()
    c.save()
    return buf.getvalue()


def render_trip_pdf(trip: Trip) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=landscape(letter))
    for day in trip.daily_logs.all().prefetch_related("events"):
        _draw_one_day(c, day, trip)
        c.showPage()
    c.save()
    return buf.getvalue()


# --------------------------------------------------------------------------


def _draw_one_day(c: canvas.Canvas, day: DailyLog, trip: Trip) -> None:
    width, height = landscape(letter)
    margin = 0.45 * inch

    # ---- HEADER --------------------------------------------------------
    c.setFillColor(FAINT)
    c.setFont("Helvetica", 6.5)
    c.drawString(margin, height - margin, "DRIVER'S DAILY LOG")
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(margin, height - margin - 16, _format_date(day.log_date))

    c.setFillColor(FAINT)
    c.setFont("Helvetica", 6.5)
    c.drawRightString(
        width - margin,
        height - margin,
        "ORIGINAL — DRIVER RETAINS IN POSSESSION FOR 8 DAYS",
    )
    c.setFont("Helvetica", 8)
    c.drawRightString(
        width - margin,
        height - margin - 12,
        "24 hr / period · 70 hr / 8 day cycle · Property-carrying",
    )

    # signature row
    sig_y = height - margin - 36
    c.setFillColor(INK)
    c.setFont("Times-Italic", 16)
    c.drawString(margin, sig_y, (trip.driver_name or "Driver"))
    c.setStrokeColor(GRID_BLUE_BOLD)
    c.setLineWidth(0.6)
    c.line(margin, sig_y - 4, margin + 3.6 * inch, sig_y - 4)
    c.setFillColor(FAINT)
    c.setFont("Helvetica", 6.5)
    c.drawString(
        margin,
        sig_y - 14,
        "(DRIVER'S SIGNATURE IN FULL) I CERTIFY THESE ENTRIES ARE TRUE AND CORRECT",
    )

    # co-driver
    co_x = margin + 3.8 * inch
    c.setFillColor(INK)
    c.setFont("Helvetica", 10)
    c.drawString(co_x, sig_y, "—")
    c.line(co_x, sig_y - 4, co_x + 1.6 * inch, sig_y - 4)
    c.setFillColor(FAINT)
    c.setFont("Helvetica", 6.5)
    c.drawString(co_x, sig_y - 14, "(NAME OF CO-DRIVER)")

    # total miles
    tm_x = co_x + 1.8 * inch
    c.setFillColor(INK)
    c.setFont("Courier-Bold", 11)
    c.drawString(tm_x, sig_y, f"{int(round(day.total_miles or 0)):d}")
    c.setStrokeColor(GRID_BLUE_BOLD)
    c.line(tm_x, sig_y - 4, tm_x + 0.9 * inch, sig_y - 4)
    c.setFillColor(FAINT)
    c.setFont("Helvetica", 6.5)
    c.drawString(tm_x, sig_y - 14, "(TOTAL DRIVING MILES TODAY)")

    # end date boxes
    ed_x = tm_x + 1.0 * inch
    parts = _date_parts(day.log_date)  # (month_short, day, year_short)
    box_w = 0.34 * inch
    for i, p in enumerate(parts):
        bx = ed_x + i * (box_w + 4)
        c.setStrokeColor(GRID_BLUE_BOLD)
        c.setFillColor(colors.white)
        c.rect(bx, sig_y - 8, box_w, 18, fill=1, stroke=1)
        c.setFillColor(INK)
        c.setFont("Courier-Bold", 9)
        c.drawCentredString(bx + box_w / 2, sig_y - 2, p)
    c.setFillColor(FAINT)
    c.setFont("Helvetica", 6.5)
    c.drawString(ed_x, sig_y - 18, "(END DATE)")

    # second row: home operating center | vehicle numbers | total truck mileage
    row2_y = sig_y - 38
    home = (trip.pickup_location or {}).get("label") or (trip.current_location or {}).get("label") or "—"
    c.setFillColor(INK)
    c.setFont("Helvetica", 10)
    c.drawString(margin, row2_y, home[:50])
    c.setStrokeColor(GRID_BLUE_BOLD)
    c.line(margin, row2_y - 4, margin + 3.6 * inch, row2_y - 4)
    c.setFillColor(FAINT)
    c.setFont("Helvetica", 6.5)
    c.drawString(margin, row2_y - 14, "(HOME OPERATING CENTER AND ADDRESS)")

    veh_x = margin + 3.8 * inch
    c.setFillColor(INK)
    c.setFont("Helvetica", 10)
    truck = trip.truck_number or "—"
    c.drawString(veh_x, row2_y, f"T {truck}   T —   T —")
    c.line(veh_x, row2_y - 4, veh_x + 1.6 * inch, row2_y - 4)
    c.setFillColor(FAINT)
    c.setFont("Helvetica", 6.5)
    c.drawString(veh_x, row2_y - 14, "VEHICLE NUMBERS (SHOW EACH UNIT)")

    tt_x = veh_x + 1.8 * inch
    c.setFillColor(INK)
    c.setFont("Courier-Bold", 11)
    c.drawString(tt_x, row2_y, f"{int(round(day.total_miles or 0)):d}")
    c.setStrokeColor(GRID_BLUE_BOLD)
    c.line(tt_x, row2_y - 4, tt_x + 0.9 * inch, row2_y - 4)
    c.setFillColor(FAINT)
    c.setFont("Helvetica", 6.5)
    c.drawString(tt_x, row2_y - 14, "(TOTAL TRUCK MILEAGE TODAY)")

    # carrier line
    c.setFillColor(HEADING_INK)
    c.setFont("Helvetica-Bold", 10)
    carrier = trip.carrier_name or "Acme Trucking Co."
    c.drawString(margin, row2_y - 28, carrier)
    c.setFillColor(FAINT)
    c.setFont("Helvetica", 8)
    c.drawString(
        margin + c.stringWidth(carrier, "Helvetica-Bold", 10) + 6,
        row2_y - 28,
        f"· Safety records maintained at {home[:30]}",
    )

    # ---- GRID ----------------------------------------------------------
    gx0 = margin + 1.1 * inch
    gw = width - 2 * margin - 1.9 * inch  # leaves room for left labels + right HOURS column
    gh = 1.85 * inch
    gy0 = row2_y - 50  # top of grid (rows drawn DOWN from here)
    row_h = gh / 4

    # background row separators
    c.setLineWidth(0.7)
    c.setStrokeColor(GRID_BLUE_BOLD)
    for r in range(5):
        y = gy0 - r * row_h
        c.line(gx0, y, gx0 + gw, y)

    # vertical hour lines + thick at 6/N/18
    for h in range(25):
        x = gx0 + (h / 24.0) * gw
        if h in (0, 6, 12, 18, 24):
            c.setStrokeColor(GRID_BLUE_BOLD)
            c.setLineWidth(0.9)
        else:
            c.setStrokeColor(GRID_BLUE)
            c.setLineWidth(0.45)
        c.line(x, gy0, x, gy0 - gh)

    # quarter-hour ticks (top + bottom stubs in each row)
    c.setStrokeColor(GRID_BLUE)
    c.setLineWidth(0.3)
    for q in range(97):
        x = gx0 + (q / 96.0) * gw
        if q % 4 == 0:
            continue
        for r in range(4):
            y_top = gy0 - r * row_h
            y_bot = y_top - row_h
            c.line(x, y_top, x, y_top - 3)
            c.line(x, y_bot + 3, x, y_bot)

    # row labels (left of grid)
    c.setFillColor(HEADING_INK)
    c.setFont("Helvetica-Bold", 8)
    for i, status in enumerate(STATUS_ROWS):
        y = gy0 - i * row_h - row_h / 2 + 3
        c.drawRightString(gx0 - 6, y, STATUS_LABELS[status])

    # hour labels (TOP)
    c.setFillColor(LABEL_INK)
    c.setFont("Helvetica", 7)
    labels = ["Midnight"] + [str(i) for i in range(1, 12)] + ["noon"] + [str(i) for i in range(1, 12)]
    for i, lab in enumerate(labels):
        x = gx0 + (i / 24.0) * gw
        c.drawCentredString(x, gy0 + 4, lab)

    # hour labels (BOTTOM, mirror of top)
    for i, lab in enumerate(labels):
        x = gx0 + (i / 24.0) * gw
        c.drawCentredString(x, gy0 - gh - 10, lab)

    # ---- STATUS POLYLINE + RED DOTS ------------------------------------
    events = list(day.events.all())
    c.setStrokeColor(INK)
    c.setLineWidth(2.0)
    transitions: list[tuple[float, float]] = []  # (x, y) for red dots
    prev_y = None
    for e in events:
        row = STATUS_ROWS.index(e.status)
        x1 = gx0 + (e.start_minute / 1440.0) * gw
        x2 = gx0 + (e.end_minute / 1440.0) * gw
        y = gy0 - row * row_h - row_h / 2
        if prev_y is not None:
            c.line(x1, prev_y, x1, y)
            transitions.append((x1, prev_y))
            transitions.append((x1, y))
        else:
            transitions.append((x1, y))
        c.line(x1, y, x2, y)
        prev_y = y
    if prev_y is not None and events:
        last = events[-1]
        x_end = gx0 + (last.end_minute / 1440.0) * gw
        transitions.append((x_end, prev_y))

    # red dots
    c.setFillColor(DOT_RED)
    c.setStrokeColor(DOT_RED)
    for (x, y) in transitions:
        c.circle(x, y, 2.3, stroke=0, fill=1)

    # ---- HOURS column on right ----------------------------------------
    hr_x = gx0 + gw + 8
    c.setFillColor(HEADING_INK)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(hr_x, gy0 + 4, "HOURS")
    totals = {
        "off": day.hours_off,
        "sleeper": day.hours_sleeper,
        "driving": day.hours_driving,
        "onduty": day.hours_onduty,
    }
    c.setFillColor(INK)
    c.setFont("Courier", 10)
    for i, status in enumerate(STATUS_ROWS):
        y = gy0 - i * row_h - row_h / 2 + 3
        c.drawString(hr_x, y, f"{totals[status]:5.2f}")
    total_sum = sum(totals.values())
    c.setStrokeColor(GRID_BLUE_BOLD)
    c.setLineWidth(0.6)
    c.line(hr_x, gy0 - gh - 4, hr_x + 0.9 * inch, gy0 - gh - 4)
    c.setFillColor(HEADING_INK)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(hr_x, gy0 - gh - 14, "TOTAL")
    c.setFillColor(INK)
    c.setFont("Courier-Bold", 11)
    c.drawString(hr_x, gy0 - gh - 26, f"{total_sum:5.2f}")

    # ---- REMARKS (leader lines + rotated labels) ------------------------
    c.setFillColor(HEADING_INK)
    c.setFont("Helvetica-Bold", 9)
    c.drawRightString(gx0 - 6, gy0 - gh - 24, "REMARKS")

    # Build remarks list (notable stop kinds only); stagger with lanes.
    remarks = _build_remarks(events)
    lane_end_x: list[float] = []
    for r in remarks:
        x = gx0 + (r["minute"] / 1440.0) * gw
        lane = 0
        while lane < len(lane_end_x) and x < lane_end_x[lane] + 76:
            lane += 1
        if lane == len(lane_end_x):
            lane_end_x.append(x)
        else:
            lane_end_x[lane] = x

        start_y = gy0 - gh
        shelf_y = start_y - 24 - lane * 6
        c.setStrokeColor(INK)
        c.setLineWidth(0.9)
        c.line(x, start_y, x, shelf_y)
        c.line(x, shelf_y, x + 8, shelf_y)

        # rotated text (-40 deg / down-right)
        c.saveState()
        c.translate(x + 10, shelf_y - 2)
        c.rotate(-40)
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 7.5)
        c.drawString(0, 0, r["line1"][:30])
        c.setFillColor(LABEL_INK)
        c.setFont("Helvetica-Oblique", 7)
        c.drawString(0, -9, r["line2"][:30])
        c.restoreState()

    # ---- 7-day Recap (§395.8(j)) --------------------------------------
    recap_y = margin + 78
    _draw_recap(c, day, trip, x0=margin, y0=recap_y, width=width - 2 * margin)

    # ---- FOOTER (shipper / commodity / BOL / load #) -------------------
    fy = margin + 12
    c.setStrokeColor(GRID_BLUE_BOLD)
    c.setLineWidth(0.5)
    cols_x = [margin, margin + 2.4 * inch, margin + 4.5 * inch, margin + 6.4 * inch, margin + 8.2 * inch]
    headers = ["SHIPPER", "COMMODITY", "BOL / SHIPPING DOC", "LOAD NO.", "TOTALS · 24.00 HR"]
    values = [
        (trip.pickup_location or {}).get("label", "—")[:28],
        "General freight",
        f"BOL-{str(trip.id)[:8].upper()}",
        str(trip.id)[:8].upper(),
        f"OFF {day.hours_off:.1f}  SB {day.hours_sleeper:.1f}  D {day.hours_driving:.1f}  ON {day.hours_onduty:.1f}",
    ]
    for x, h, v in zip(cols_x, headers, values):
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 8.5)
        c.drawString(x, fy + 6, v)
        c.line(x, fy + 2, x + 1.9 * inch, fy + 2)
        c.setFillColor(FAINT)
        c.setFont("Helvetica", 6)
        c.drawString(x, fy - 6, h)


def _draw_recap(c: canvas.Canvas, day: DailyLog, trip: Trip, x0: float, y0: float, width: float) -> None:
    """Render the 7-day on-duty recap table — FMCSA §395.8(j)."""
    # Pull all the trip's daily logs in date order
    days = list(trip.daily_logs.all().order_by("log_date"))
    # Find this day's position
    try:
        idx = next(i for i, d in enumerate(days) if d.log_date == day.log_date)
    except StopIteration:
        idx = 0

    slots = []
    for i in range(7):
        ref = idx - i
        d = days[ref] if 0 <= ref < len(days) else None
        on_duty = ((d.hours_driving or 0) + (d.hours_onduty or 0)) if d else 0.0
        slots.append({"label": "Today" if i == 0 else f"{i}d ago", "value": on_duty, "present": d is not None})

    total_7day = sum(s["value"] for s in slots)
    available = max(0, 70 - total_7day)

    box_h = 50
    c.setStrokeColor(GRID_BLUE_BOLD)
    c.setLineWidth(0.6)
    c.setFillColor(colors.HexColor("#f5f7fb"))
    c.rect(x0, y0, width, box_h, fill=1, stroke=1)

    c.setFillColor(FAINT)
    c.setFont("Helvetica", 6.5)
    c.drawString(x0 + 6, y0 + box_h - 10, "7-DAY RECAP · FMCSA §395.8(J)")

    c.setFillColor(HEADING_INK)
    c.setFont("Helvetica-Bold", 7.5)
    c.drawString(x0 + 6, y0 + box_h - 22, "Day")

    col_w = (width - 1.7 * inch - 12) / 7
    for i, s in enumerate(slots):
        cx = x0 + 1.0 * inch + i * col_w
        c.setFillColor(FAINT)
        c.setFont("Helvetica", 6.5)
        c.drawString(cx, y0 + box_h - 10, s["label"])
        c.setFillColor(INK if s["present"] else FAINT)
        c.setFont("Courier-Bold" if i == 0 else "Courier", 9)
        c.drawString(cx, y0 + box_h - 24, f"{s['value']:.2f}" if s["present"] else "—")

    # 7-day total
    tx = x0 + width - 1.7 * inch
    c.setFillColor(HEADING_INK)
    c.setFont("Helvetica-Bold", 7.5)
    c.drawString(tx, y0 + box_h - 10, "7-DAY TOTAL")
    c.setFillColor(INK)
    c.setFont("Courier-Bold", 10)
    c.drawString(tx, y0 + box_h - 24, f"{total_7day:.2f} / 70.00")

    # Available tomorrow
    c.setFillColor(HEADING_INK)
    c.setFont("Helvetica-Bold", 7.5)
    c.drawString(tx, y0 + 14, "AVAILABLE TOMORROW")
    if available <= 0:
        c.setFillColor(DOT_RED)
    elif available < 10:
        c.setFillColor(colors.HexColor("#d97706"))
    else:
        c.setFillColor(INK)
    c.setFont("Courier-Bold", 11)
    c.drawString(tx, y0 + 4, f"{available:.2f} hr")


# --------------------------------------------------------------------------


@dataclass
class _RemarkRow:
    minute: int
    line1: str
    line2: str


def _build_remarks(events) -> list[dict]:
    out: list[dict] = []
    for e in events:
        if not e.stop_kind or e.stop_kind in ("start",):
            continue
        kind = STOP_KIND_REMARK.get(e.stop_kind, e.stop_kind.replace("_", " ").title())
        loc = e.location or ""
        out.append({"minute": e.start_minute, "line1": kind, "line2": loc})
    return out


def _format_date(d) -> str:
    return d.strftime("%A, %B %-d, %Y") if hasattr(d, "strftime") else str(d)


def _date_parts(d):
    if hasattr(d, "strftime"):
        return (
            d.strftime("%b"),
            d.strftime("%d"),
            d.strftime("%y"),
        )
    return ("—", "—", "—")
