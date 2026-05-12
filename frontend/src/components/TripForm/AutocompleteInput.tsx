import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { MapPin, Loader2, Locate } from "lucide-react";
import { cn } from "@/lib/cn";
import { searchPlaces, reverseGeocode, type PlaceSuggestion } from "@/lib/nominatim";
import { toast } from "sonner";

interface AutocompleteInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  id: string;
  label: string;
  /** Current value of the input. */
  value: string;
  /** Called with raw text on each keystroke; also called when a suggestion is picked. */
  onChange: (next: string) => void;
  /** Called when a suggestion is picked or geolocation resolves — gives full place data. */
  onPickPlace?: (place: PlaceSuggestion) => void;
  /** Show a "Use my location" button (geolocation API). */
  enableGeolocation?: boolean;
  error?: string;
  icon?: ReactNode;
}

/**
 * Address input with debounced Nominatim suggestion dropdown + optional
 * "Use my location" geolocation button. Free OSM-based — no API key.
 */
export const AutocompleteInput = forwardRef<HTMLInputElement, AutocompleteInputProps>(
  function AutocompleteInput(
    {
      id,
      label,
      value,
      onChange,
      onPickPlace,
      enableGeolocation = false,
      error,
      icon = <MapPin className="h-4 w-4" />,
      placeholder,
      autoComplete,
      ...rest
    },
    ref,
  ) {
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<PlaceSuggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [hi, setHi] = useState(0); // highlighted index
    const [geoBusy, setGeoBusy] = useState(false);
    const abortRef = useRef<AbortController | null>(null);
    const wrapRef = useRef<HTMLDivElement | null>(null);
    const lastTextRef = useRef(value);

    // Debounced search whenever value changes by user typing.
    useEffect(() => {
      if (value === lastTextRef.current) return; // not a user-typed change
      lastTextRef.current = value;
      if (value.trim().length < 2) {
        setItems([]);
        setOpen(false);
        return;
      }
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      const t = setTimeout(() => {
        searchPlaces(value, ctrl.signal)
          .then((r) => {
            setItems(r);
            setOpen(r.length > 0);
            setHi(0);
          })
          .catch(() => {
            /* aborted or network — ignore */
          })
          .finally(() => setLoading(false));
      }, 280);
      return () => {
        clearTimeout(t);
        ctrl.abort();
      };
    }, [value]);

    // Close dropdown on outside click.
    useEffect(() => {
      const onDoc = (e: MouseEvent) => {
        if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
      };
      document.addEventListener("mousedown", onDoc);
      return () => document.removeEventListener("mousedown", onDoc);
    }, []);

    const pick = useCallback(
      (p: PlaceSuggestion) => {
        lastTextRef.current = p.short;
        onChange(p.short);
        onPickPlace?.(p);
        setOpen(false);
      },
      [onChange, onPickPlace],
    );

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!open || items.length === 0) {
        if (e.key === "ArrowDown" && items.length > 0) setOpen(true);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHi((i) => Math.min(items.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHi((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        pick(items[hi]);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };

    const useMyLocation = useCallback(() => {
      if (!("geolocation" in navigator)) {
        toast.error("This browser doesn't support geolocation.");
        return;
      }
      setGeoBusy(true);
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const { latitude, longitude } = pos.coords;
            const r = await reverseGeocode(latitude, longitude);
            if (r) {
              lastTextRef.current = r.short;
              onChange(r.short);
              onPickPlace?.(r);
              toast.success(`Set to ${r.short}`);
            } else {
              toast.error("Could not resolve your location.");
            }
          } catch {
            toast.error("Reverse-geocoding failed.");
          } finally {
            setGeoBusy(false);
          }
        },
        (err) => {
          setGeoBusy(false);
          toast.error(
            err.code === err.PERMISSION_DENIED
              ? "Location permission denied."
              : "Could not get your location.",
          );
        },
        { enableHighAccuracy: false, maximumAge: 60_000, timeout: 8_000 },
      );
    }, [onChange, onPickPlace]);

    const placeholderText = useMemo(() => placeholder ?? "Type a city, state…", [placeholder]);

    return (
      <div className="flex flex-col gap-1.5" ref={wrapRef}>
        <label htmlFor={id} className="text-sm font-medium text-[var(--fg-muted)]">
          {label}
        </label>
        <div
          className={cn(
            "relative flex items-center h-12 rounded-xl",
            "bg-[var(--bg-sunken)] border border-[var(--border)]",
            "focus-within:border-[var(--accent)]",
            "focus-within:shadow-[0_0_0_4px_rgba(91,108,255,0.15)]",
            "transition-[box-shadow,border-color] duration-150",
            error && "border-[var(--danger)]",
          )}
        >
          <span
            className="pl-4 pr-2 text-[var(--fg-faint)] flex items-center"
            aria-hidden="true"
          >
            {icon}
          </span>
          <input
            ref={ref}
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => items.length > 0 && setOpen(true)}
            placeholder={placeholderText}
            autoComplete={autoComplete ?? "off"}
            className={cn(
              "flex-1 h-full bg-transparent outline-none pr-2 text-base",
              "text-[var(--fg)] placeholder:text-[var(--fg-faint)]",
            )}
            aria-invalid={!!error}
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={`${id}-listbox`}
            {...rest}
          />
          {loading && (
            <Loader2 className="h-4 w-4 animate-spin text-[var(--fg-faint)] mr-3" aria-hidden="true" />
          )}
          {enableGeolocation && (
            <button
              type="button"
              onClick={useMyLocation}
              disabled={geoBusy}
              className={cn(
                "mr-2 h-8 px-2.5 inline-flex items-center gap-1.5 rounded-lg",
                "text-xs font-medium text-[var(--fg-muted)] hover:text-[var(--fg)]",
                "border border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--bg-elev)]",
                "disabled:opacity-60 disabled:cursor-not-allowed",
                "transition-colors duration-150",
              )}
              title="Use my current location"
              aria-label="Use my current location"
            >
              {geoBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Locate className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">Use my location</span>
            </button>
          )}
        </div>

        {open && items.length > 0 && (
          <ul
            id={`${id}-listbox`}
            role="listbox"
            className={cn(
              "z-20 mt-1 rounded-xl border border-[var(--border)]",
              "bg-[var(--bg-elev)] shadow-soft overflow-hidden",
              "max-h-64 overflow-y-auto",
            )}
          >
            {items.map((p, i) => (
              <li
                key={`${p.lat},${p.lng}`}
                role="option"
                aria-selected={i === hi}
                onMouseEnter={() => setHi(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(p);
                }}
                className={cn(
                  "px-4 py-2.5 cursor-pointer flex items-start gap-3",
                  "border-b border-[var(--border)] last:border-b-0",
                  i === hi
                    ? "bg-[var(--bg-sunken)]"
                    : "hover:bg-[var(--bg-sunken)]",
                )}
              >
                <MapPin
                  className={cn(
                    "h-4 w-4 mt-0.5 shrink-0",
                    i === hi ? "text-[var(--accent)]" : "text-[var(--fg-faint)]",
                  )}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-[var(--fg)] truncate font-medium text-sm">
                    {p.short}
                  </p>
                  <p className="text-xs text-[var(--fg-faint)] truncate">{p.label}</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p
            id={`${id}-error`}
            className="text-[var(--danger)] text-xs mt-1"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    );
  },
);
