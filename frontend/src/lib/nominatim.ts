/**
 * Nominatim (OpenStreetMap) helpers — free, no key, no signup.
 *
 * Usage policy: 1 req/sec/IP, must include User-Agent (browser handles this),
 * results should be cached. This module debounces in the consuming component,
 * keeps a small in-memory cache, and uses lightweight queries.
 */

export interface PlaceSuggestion {
  /** Canonical display label (e.g., "Brooklyn, Kings County, New York, USA"). */
  label: string;
  /** Short form preferred for our UI: "Brooklyn, NY". */
  short: string;
  lat: number;
  lng: number;
  /** OSM place type — useful for icons (city/town/village/...). */
  type: string;
}

const NOM_BASE = "https://nominatim.openstreetmap.org";
const cache = new Map<string, PlaceSuggestion[]>();

const COUNTRY_TO_CODE: Record<string, string> = {
  // US states full -> 2-letter
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA",
  Colorado: "CO", Connecticut: "CT", Delaware: "DE", Florida: "FL", Georgia: "GA",
  Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA", Kansas: "KS",
  Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD", Massachusetts: "MA",
  Michigan: "MI", Minnesota: "MN", Mississippi: "MS", Missouri: "MO", Montana: "MT",
  Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH", "New Jersey": "NJ",
  "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND",
  Ohio: "OH", Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI",
  "South Carolina": "SC", "South Dakota": "SD", Tennessee: "TN", Texas: "TX",
  Utah: "UT", Vermont: "VT", Virginia: "VA", Washington: "WA",
  "West Virginia": "WV", Wisconsin: "WI", Wyoming: "WY",
};

function shortLabel(addr: Record<string, string>, fallback: string): string {
  const city = addr.city || addr.town || addr.village || addr.hamlet || addr.county;
  const state = addr.state ? COUNTRY_TO_CODE[addr.state] || addr.state : "";
  if (city && state) return `${city}, ${state}`;
  if (city) return city;
  return fallback;
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  if (cache.has(q)) return cache.get(q)!;

  const url = new URL(`${NOM_BASE}/search`);
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "us,ca,mx");

  const r = await fetch(url.toString(), {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!r.ok) throw new Error(`Nominatim ${r.status}`);
  const data = (await r.json()) as Array<{
    display_name: string;
    lat: string;
    lon: string;
    type: string;
    address?: Record<string, string>;
  }>;

  const out: PlaceSuggestion[] = data.map((f) => ({
    label: f.display_name,
    short: shortLabel(f.address ?? {}, f.display_name.split(",")[0]),
    lat: parseFloat(f.lat),
    lng: parseFloat(f.lon),
    type: f.type,
  }));
  cache.set(q, out);
  return out;
}

export async function reverseGeocode(lat: number, lng: number, signal?: AbortSignal): Promise<PlaceSuggestion | null> {
  const url = new URL(`${NOM_BASE}/reverse`);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("zoom", "10");

  const r = await fetch(url.toString(), {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!r.ok) return null;
  const data = (await r.json()) as {
    display_name: string;
    lat: string;
    lon: string;
    type?: string;
    address?: Record<string, string>;
  };
  return {
    label: data.display_name,
    short: shortLabel(data.address ?? {}, data.display_name.split(",")[0]),
    lat: parseFloat(data.lat),
    lng: parseFloat(data.lon),
    type: data.type ?? "place",
  };
}
