import { useEffect, useRef } from "react";
import { Polyline, useMap } from "react-leaflet";
import type { Polyline as LeafletPolyline, LatLngExpression } from "leaflet";
import gsap from "gsap";

interface RouteLayerProps {
  positions: LatLngExpression[];
  fitOnMount?: boolean;
}

/**
 * Renders the planned route as an animated polyline.
 * On first mount, draws the line on by tweening stroke-dashoffset
 * from the full path length down to 0 (700ms ease-out).
 * Skips animation when prefers-reduced-motion is set.
 */
export function RouteLayer({ positions, fitOnMount = true }: RouteLayerProps) {
  const polyRef = useRef<LeafletPolyline | null>(null);
  const map = useMap();
  const didAnimateRef = useRef(false);

  useEffect(() => {
    const poly = polyRef.current;
    if (!poly) return;

    // Fit map to polyline bounds on first mount.
    if (fitOnMount && positions.length > 1) {
      try {
        map.fitBounds(poly.getBounds(), { padding: [40, 40] });
      } catch {
        // bounds might be invalid for degenerate routes — ignore
      }
    }

    if (didAnimateRef.current) return;
    didAnimateRef.current = true;

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduce) return;

    // Leaflet stores the underlying SVG path on the polyline as _path.
    // It's typed loosely so we cast to access it.
    const pathEl = (poly as unknown as { _path?: SVGPathElement })._path;
    if (!pathEl || typeof pathEl.getTotalLength !== "function") return;

    const length = pathEl.getTotalLength();
    if (!length || !isFinite(length)) return;

    pathEl.style.strokeDasharray = `${length}`;
    pathEl.style.strokeDashoffset = `${length}`;

    const tween = gsap.to(pathEl, {
      strokeDashoffset: 0,
      duration: 0.7,
      ease: "power2.out",
      onComplete: () => {
        // clear inline styles so future redraws aren't dashed
        pathEl.style.strokeDasharray = "";
        pathEl.style.strokeDashoffset = "";
      },
    });

    return () => {
      tween.kill();
    };
    // We intentionally only run this effect once after the polyline mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  return (
    <Polyline
      ref={polyRef}
      positions={positions}
      pathOptions={{
        color: "var(--accent)",
        weight: 4,
        opacity: 0.85,
        lineCap: "round",
        lineJoin: "round",
      }}
    />
  );
}
