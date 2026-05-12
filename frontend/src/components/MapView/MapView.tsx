import { useEffect, useMemo, useRef } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
} from "react-leaflet";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import type { LatLngExpression } from "leaflet";

import type { Stop, StopKind, TripDetail } from "@/types/api";
import { cn } from "@/lib/cn";
import { fmtDate, fmtDuration } from "@/lib/format";
import { useUiStore } from "@/store/uiStore";

import { RouteLayer } from "./RouteLayer";
import { iconFor, STOP_COLORS, STOP_LABELS } from "./icons";

interface MapViewProps {
  trip: TripDetail;
  className?: string;
}

const ALL_KINDS: StopKind[] = [
  "start",
  "pickup",
  "dropoff",
  "fuel",
  "break_30",
  "rest_10",
  "restart_34",
];

const FALLBACK_CENTER: LatLngExpression = [39.8283, -98.5795]; // US centroid

export function MapView({ trip, className }: MapViewProps) {
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRefs = useRef<Map<number, LeafletMarker>>(new Map());
  const focusedStopSeq = useUiStore((s) => s.focusedStopSeq);

  // Convert RouteGeoJSON ([lng, lat]) to Leaflet ([lat, lng]).
  const routePositions = useMemo<LatLngExpression[]>(() => {
    const coords = trip.route_geojson?.coordinates ?? [];
    return coords.map(([lng, lat]) => [lat, lng] as LatLngExpression);
  }, [trip.route_geojson]);

  // Sensible initial center: first stop, or first route coord, or US centroid.
  const initialCenter = useMemo<LatLngExpression>(() => {
    if (trip.stops.length > 0) {
      return [trip.stops[0].lat, trip.stops[0].lng];
    }
    if (routePositions.length > 0) return routePositions[0];
    return FALLBACK_CENTER;
  }, [trip.stops, routePositions]);

  // Fly to focused stop + open its popup when selection changes.
  useEffect(() => {
    if (focusedStopSeq == null) return;
    const map = mapRef.current;
    const stop = trip.stops.find((s) => s.sequence === focusedStopSeq);
    if (!map || !stop) return;
    map.flyTo([stop.lat, stop.lng], 8, { duration: 0.7 });
    const marker = markerRefs.current.get(focusedStopSeq);
    if (marker) marker.openPopup();
  }, [focusedStopSeq, trip.stops]);

  return (
    <div
      className={cn(
        "relative rounded-2xl overflow-hidden border border-[var(--border)]",
        "h-[420px]",
        className
      )}
    >
      <MapContainer
        center={initialCenter}
        zoom={5}
        scrollWheelZoom
        ref={mapRef}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution={'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {routePositions.length > 1 && (
          <RouteLayer positions={routePositions} />
        )}

        {trip.stops.map((stop: Stop) => (
          <Marker
            key={stop.sequence}
            position={[stop.lat, stop.lng]}
            icon={iconFor(stop.kind)}
            ref={(instance) => {
              if (instance) markerRefs.current.set(stop.sequence, instance);
              else markerRefs.current.delete(stop.sequence);
            }}
          >
            <Popup>
              <div className="text-[13px] leading-snug min-w-[180px]">
                <div className="font-semibold text-[var(--fg)]">
                  {stop.label}
                </div>
                <div className="text-[var(--fg-muted)] mt-0.5">
                  {STOP_LABELS[stop.kind]} &middot; Mile {stop.mile_marker}
                </div>
                <div className="mt-1 text-[var(--fg)]">
                  ETA: {fmtDate(stop.arrive_at)},{" "}
                  {new Date(stop.arrive_at).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </div>
                <div className="text-[var(--fg-muted)]">
                  Duration: {fmtDuration(stop.duration_min)}
                </div>
                {stop.note && (
                  <div className="mt-1 italic text-[var(--fg-faint)]">
                    {stop.note}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Legend overlay — absolutely positioned over the map */}
      <div
        className={cn(
          "absolute top-3 right-3 z-[1000]",
          "rounded-xl border border-[var(--border)]",
          "bg-[var(--bg-elev)]/95 backdrop-blur-[2px]",
          "px-3 py-2 shadow-sm",
          "text-[11px] text-[var(--fg)]",
          "max-w-[150px] pointer-events-auto"
        )}
        aria-label="Map legend"
      >
        <div className="font-semibold mb-1.5 text-[var(--fg-muted)] uppercase tracking-wide text-[10px]">
          Stops
        </div>
        <ul className="space-y-1">
          {ALL_KINDS.map((kind) => (
            <li key={kind} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-white/80"
                style={{ background: STOP_COLORS[kind] }}
              />
              <span>{STOP_LABELS[kind]}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
