import { z } from "zod";

export const tripFormSchema = z.object({
  current_location: z.string().min(2, "Enter a city, state, or address"),
  pickup_location: z.string().min(2, "Enter a city, state, or address"),
  dropoff_location: z.string().min(2, "Enter a city, state, or address"),
  cycle_used_hours: z.coerce
    .number({ invalid_type_error: "Enter a number 0–70" })
    .min(0, "Must be 0 or more")
    .max(70, "Cannot exceed 70 hours"),
  depart_at: z.string().min(10, "Pick a departure date & time"),
  driver_name: z.string().optional(),
  carrier_name: z.string().optional(),
  truck_number: z.string().optional(),
  timezone: z.string().default("America/New_York"),
});

export type TripFormValues = z.infer<typeof tripFormSchema>;

/**
 * Returns "tomorrow at 08:00" in the user's local tz, formatted for
 * the HTML <input type="datetime-local"> control (YYYY-MM-DDTHH:mm).
 */
export const tomorrowAt8 = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(8, 0, 0, 0);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
};

export const blankDefaults = (): TripFormValues => ({
  current_location: "",
  pickup_location: "",
  dropoff_location: "",
  cycle_used_hours: 0,
  depart_at: tomorrowAt8(),
  driver_name: "",
  carrier_name: "",
  truck_number: "",
  timezone: "America/New_York",
});

/** Canonical assessment demo: Brooklyn → Chicago → Los Angeles, cycle 35h. */
export const demoDefaults = (): TripFormValues => ({
  current_location: "Brooklyn, NY",
  pickup_location: "Chicago, IL",
  dropoff_location: "Los Angeles, CA",
  cycle_used_hours: 35,
  depart_at: "2026-05-12T08:00",
  driver_name: "",
  carrier_name: "",
  truck_number: "",
  timezone: "America/New_York",
});

export const TIMEZONES: { value: string; label: string }[] = [
  { value: "America/New_York", label: "Eastern (New York)" },
  { value: "America/Chicago", label: "Central (Chicago)" },
  { value: "America/Denver", label: "Mountain (Denver)" },
  { value: "America/Phoenix", label: "Arizona (Phoenix)" },
  { value: "America/Los_Angeles", label: "Pacific (Los Angeles)" },
  { value: "America/Anchorage", label: "Alaska (Anchorage)" },
  { value: "Pacific/Honolulu", label: "Hawaii (Honolulu)" },
];
