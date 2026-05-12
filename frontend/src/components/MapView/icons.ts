import L from "leaflet";
import type { StopKind } from "@/types/api";

// Color palette per StopKind. These are the marker fill colors — they
// stay distinct against both light and dark map tiles. Officer-view
// inverts to high contrast separately via CSS, so we don't reference
// design tokens here (markers must remain legible over OSM tiles).
export const STOP_COLORS: Record<StopKind, string> = {
  start: "#16a34a", // green
  pickup: "#4f46e5", // indigo
  dropoff: "#dc2626", // red
  fuel: "#d97706", // amber
  break_30: "#06b6d4", // cyan
  rest_10: "#7c3aed", // violet
  restart_34: "#e11d48", // rose
};

export const STOP_LABELS: Record<StopKind, string> = {
  start: "Start",
  pickup: "Pickup",
  dropoff: "Dropoff",
  fuel: "Fuel",
  break_30: "30-min Break",
  rest_10: "10-hr Rest",
  restart_34: "34-hr Restart",
};

// Inline SVG strings for each lucide-react icon used in markers.
// Hand-rolled so we don't have to React-render into a divIcon.
// stroke-width 2, 14×14 viewport, white stroke for max contrast.
const SVG_TRUCK =
  '<path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5"/><path d="M14 17h1"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>';
const SVG_PACKAGE =
  '<path d="M16.5 9.4 7.55 4.24"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96 12 12.01l8.73-5.05"/><path d="M12 22.08V12"/>';
const SVG_FLAG =
  '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>';
const SVG_FUEL =
  '<line x1="3" x2="15" y1="22" y2="22"/><line x1="4" x2="14" y1="9" y2="9"/><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"/><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"/>';
const SVG_COFFEE =
  '<path d="M17 8h1a4 4 0 0 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" x2="6" y1="2" y2="4"/><line x1="10" x2="10" y1="2" y2="4"/><line x1="14" x2="14" y1="2" y2="4"/>';
const SVG_MOON = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
const SVG_ROTATE =
  '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>';

export const STOP_SVG: Record<StopKind, string> = {
  start: SVG_TRUCK,
  pickup: SVG_PACKAGE,
  dropoff: SVG_FLAG,
  fuel: SVG_FUEL,
  break_30: SVG_COFFEE,
  rest_10: SVG_MOON,
  restart_34: SVG_ROTATE,
};

const SIZE = 28;

const markerHtml = (kind: StopKind): string => {
  const color = STOP_COLORS[kind];
  const svg = STOP_SVG[kind];
  return `
    <div style="
      width:${SIZE}px;height:${SIZE}px;border-radius:9999px;
      background:${color};color:#fff;
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 2px 6px rgba(0,0,0,0.35), 0 0 0 2px #fff;
      transform: translate(-50%, -50%);
      position: relative; top: 50%; left: 50%;
    ">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14"
        viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
        aria-hidden="true">${svg}</svg>
    </div>
  `;
};

export const iconFor = (kind: StopKind): L.DivIcon =>
  L.divIcon({
    html: markerHtml(kind),
    className: "hos-stop-marker",
    iconSize: [SIZE, SIZE],
    iconAnchor: [SIZE / 2, SIZE / 2],
    popupAnchor: [0, -SIZE / 2],
  });
