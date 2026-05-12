import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ChevronDown,
  Clock,
  Loader2,
  MapPin,
  Sparkles,
  Truck,
} from "lucide-react";

import { createTrip } from "@/api/trips";
import type { TripCreatePayload, TripDetail } from "@/types/api";
import { cn } from "@/lib/cn";

import { AddressInput } from "./AddressInput";
import {
  blankDefaults,
  demoDefaults,
  tripFormSchema,
  type TripFormValues,
  TIMEZONES,
} from "./schema";

/**
 * Lightweight zod -> react-hook-form resolver. Avoids the extra
 * @hookform/resolvers dependency.
 */
const zodResolver =
  (schema: typeof tripFormSchema): Resolver<TripFormValues> =>
  async (values) => {
    const result = schema.safeParse(values);
    if (result.success) {
      return { values: result.data, errors: {} };
    }
    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join(".") || "_root";
      if (!errors[key]) {
        errors[key] = { type: issue.code, message: issue.message };
      }
    }
    return { values: {}, errors: errors as never };
  };

/**
 * Hero form for the /plan page. Submits a TripCreatePayload and routes to
 * /trip/:id on success. Wraps react-hook-form + zod and a react-query mutation.
 */
export function TripForm() {
  const navigate = useNavigate();
  const [optionsOpen, setOptionsOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TripFormValues>({
    resolver: zodResolver(tripFormSchema),
    defaultValues: blankDefaults(),
    mode: "onBlur",
  });

  const mutation = useMutation<TripDetail, Error, TripCreatePayload>({
    mutationFn: createTrip,
    onSuccess: (trip) => {
      toast.success("Trip planned. Routing to your daily logs.");
      navigate(`/trip/${trip.id}`);
    },
    onError: (err) => {
      toast.error(err.message || "Could not plan trip. Please try again.");
    },
  });

  const onSubmit = handleSubmit((values) => {
    const payload: TripCreatePayload = {
      current_location: values.current_location,
      pickup_location: values.pickup_location,
      dropoff_location: values.dropoff_location,
      cycle_used_hours: values.cycle_used_hours,
      // Send the datetime-local string verbatim (no Date() conversion). The
      // backend combines it with `timezone` so "8 AM ET" stays "8 AM ET"
      // regardless of the browser's locale.
      depart_at: values.depart_at,
      timezone: values.timezone,
      driver_name: values.driver_name || undefined,
      carrier_name: values.carrier_name || undefined,
      truck_number: values.truck_number || undefined,
    };
    mutation.mutate(payload);
  });

  const fillDemo = () => {
    reset(demoDefaults());
    setOptionsOpen(false);
    toast.message("Demo trip loaded", {
      description: "Brooklyn, NY -> Chicago, IL -> Los Angeles, CA",
    });
  };

  const submitting = mutation.isPending;

  return (
    <section className="w-full">
      <header className="mb-8 sm:mb-10">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[var(--fg)]">
          Plan a trip
        </h1>
        <p className="mt-2 text-[var(--fg-muted)] text-base sm:text-lg max-w-2xl">
          Enter trip details. We&rsquo;ll plan your stops and generate
          FMCSA-compliant daily logs.
        </p>
      </header>

      <form
        onSubmit={onSubmit}
        noValidate
        className={cn(
          "rounded-3xl bg-[var(--bg-elev)] shadow-soft",
          "border border-[var(--border)]",
          "p-6 sm:p-8 md:p-10",
        )}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
          <div className="md:col-span-2">
            <AddressInput
              id="current_location"
              label="Current location"
              placeholder="e.g. Brooklyn, NY"
              autoComplete="off"
              icon={<MapPin className="h-4 w-4" />}
              error={errors.current_location?.message}
              {...register("current_location")}
            />
          </div>

          <AddressInput
            id="pickup_location"
            label="Pickup location"
            placeholder="e.g. Chicago, IL"
            autoComplete="off"
            icon={<MapPin className="h-4 w-4" />}
            error={errors.pickup_location?.message}
            {...register("pickup_location")}
          />

          <AddressInput
            id="dropoff_location"
            label="Dropoff location"
            placeholder="e.g. Los Angeles, CA"
            autoComplete="off"
            icon={<MapPin className="h-4 w-4" />}
            error={errors.dropoff_location?.message}
            {...register("dropoff_location")}
          />

          <AddressInput
            id="cycle_used_hours"
            label="Current cycle used"
            type="number"
            inputMode="decimal"
            step="0.25"
            min={0}
            max={70}
            placeholder="0"
            icon={<Clock className="h-4 w-4" />}
            suffix="/ 70 hr"
            error={errors.cycle_used_hours?.message}
            {...register("cycle_used_hours")}
          />

          <AddressInput
            id="depart_at"
            label="Depart at"
            type="datetime-local"
            error={errors.depart_at?.message}
            {...register("depart_at")}
          />
        </div>

        {/* Collapsible driver/vehicle details */}
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setOptionsOpen((v) => !v)}
            className={cn(
              "inline-flex items-center gap-2 text-sm font-medium",
              "text-[var(--fg-muted)] hover:text-[var(--fg)]",
              "rounded-lg px-2 py-1 -mx-2",
            )}
            aria-expanded={optionsOpen}
            aria-controls="driver-vehicle-panel"
          >
            <Truck className="h-4 w-4" />
            Driver &amp; vehicle details
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform duration-150",
                optionsOpen && "rotate-180",
              )}
            />
          </button>

          {optionsOpen && (
            <div
              id="driver-vehicle-panel"
              className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-5 animate-fade-up"
            >
              <AddressInput
                id="driver_name"
                label="Driver name"
                placeholder="Jane Doe"
                error={errors.driver_name?.message}
                {...register("driver_name")}
              />
              <AddressInput
                id="carrier_name"
                label="Carrier name"
                placeholder="Acme Transport LLC"
                error={errors.carrier_name?.message}
                {...register("carrier_name")}
              />
              <AddressInput
                id="truck_number"
                label="Truck number"
                placeholder="T-1042"
                error={errors.truck_number?.message}
                {...register("truck_number")}
              />
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="timezone"
                  className="text-sm font-medium text-[var(--fg-muted)]"
                >
                  Timezone
                </label>
                <div
                  className={cn(
                    "relative h-12 rounded-xl",
                    "bg-[var(--bg-sunken)] border border-[var(--border)]",
                    "focus-within:border-[var(--accent)]",
                    "focus-within:shadow-[0_0_0_4px_rgba(91,108,255,0.15)]",
                    "transition-[box-shadow,border-color] duration-150",
                  )}
                >
                  <select
                    id="timezone"
                    className={cn(
                      "h-full w-full bg-transparent outline-none px-4 pr-10",
                      "text-base text-[var(--fg)] appearance-none cursor-pointer",
                    )}
                    {...register("timezone")}
                  >
                    {TIMEZONES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-faint)] pointer-events-none"
                    aria-hidden="true"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <button
            type="submit"
            disabled={submitting}
            className={cn(
              "h-12 rounded-xl font-medium px-6 flex-1",
              "bg-[var(--accent)] text-[var(--accent-fg)]",
              "hover:brightness-110 active:scale-[0.99]",
              "disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100",
              "inline-flex items-center justify-center gap-2",
            )}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Planning trip…
              </>
            ) : (
              "Plan trip"
            )}
          </button>

          <button
            type="button"
            onClick={fillDemo}
            disabled={submitting}
            className={cn(
              "h-12 rounded-xl font-medium px-5",
              "bg-[var(--bg-sunken)] text-[var(--fg)]",
              "border border-[var(--border)] hover:border-[var(--accent)]",
              "inline-flex items-center justify-center gap-2",
              "disabled:opacity-60 disabled:cursor-not-allowed",
            )}
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Try the canonical Brooklyn → LA demo
          </button>
        </div>
      </form>
    </section>
  );
}
