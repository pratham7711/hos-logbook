import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface AddressInputProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  icon?: ReactNode;
  suffix?: ReactNode;
}

/**
 * Tall labeled text input with optional leading icon and trailing suffix.
 * Uses design tokens so it adapts to light / dark / officer-view.
 */
export const AddressInput = forwardRef<HTMLInputElement, AddressInputProps>(
  function AddressInput(
    { id, label, hint, error, icon, suffix, className, ...rest },
    ref,
  ) {
    return (
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={id}
          className="text-sm font-medium text-[var(--fg-muted)]"
        >
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
          {icon && (
            <span
              className="pl-4 pr-2 text-[var(--fg-faint)] flex items-center"
              aria-hidden="true"
            >
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={id}
            className={cn(
              "flex-1 h-full bg-transparent outline-none",
              "text-[var(--fg)] placeholder:text-[var(--fg-faint)]",
              "text-base",
              icon ? "pl-0" : "pl-4",
              suffix ? "pr-2" : "pr-4",
              className,
            )}
            aria-invalid={!!error}
            aria-describedby={
              error ? `${id}-error` : hint ? `${id}-hint` : undefined
            }
            {...rest}
          />
          {suffix && (
            <span className="pr-4 text-sm text-[var(--fg-faint)] select-none">
              {suffix}
            </span>
          )}
        </div>
        {error ? (
          <p
            id={`${id}-error`}
            className="text-[var(--danger)] text-xs mt-1"
            role="alert"
          >
            {error}
          </p>
        ) : hint ? (
          <p id={`${id}-hint`} className="text-xs text-[var(--fg-faint)]">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);
