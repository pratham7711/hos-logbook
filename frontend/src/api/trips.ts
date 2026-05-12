import { api } from "./client";
import type { TripCreatePayload, TripDetail, TripListItem } from "@/types/api";

interface Paged<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export const createTrip = (payload: TripCreatePayload) =>
  api<TripDetail>("/trips/", { method: "POST", body: JSON.stringify(payload) });

export const getTrip = (id: string) => api<TripDetail>(`/trips/${id}/`);

export const listTrips = () => api<Paged<TripListItem>>("/trips/");

export const geocode = (text: string) =>
  api<{ label: string; lat: number; lng: number }>("/geocode/", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
