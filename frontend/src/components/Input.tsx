// ---------------------------------------------------------------------------
// External dependencies
// ---------------------------------------------------------------------------
import React from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Props for the Input component.
 * Extends native `<input>` attributes so consumers can pass standard HTML
 * props such as `type`, `placeholder`, `value`, `onChange`, etc.
 */
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /**
   * Optional label rendered above the input.
   * When the input is marked `required`, a red asterisk is automatically
   * appended to the label text.
   */
  label?: string;

  /**
   * Error message displayed below the input in red.
   * When present, the input border and focus ring also turn red to
   * provide a strong visual cue.
   *
   * Takes precedence over `hint` — if both are provided, only `error`
   * is shown.
   */
  error?: string;

  /**
   * Helpful hint text displayed below the input in muted slate.
   * Only visible when no `error` message is present.
   */
  hint?: string;

  /**
   * Optional decorative icon rendered inside the input on the left side.
   * When provided, the input text gains extra left padding (`pl-10`) so
   * it doesn't overlap the icon.
   */
  icon?: React.ReactNode;
}

// ===========================================================================
// Input Component
// ===========================================================================

/**
 * A controlled or uncontrolled text input with built-in label, error, hint,
 * and leading-icon support.
 *
 * Uses `React.forwardRef` so parent components can obtain a reference to
 * the underlying `<input>` element (useful for focus management or
 * integrating with form libraries).
 *
 * @example
 * ```tsx
 * <Input
 *   label="Email Address"
 *   type="email"
 *   required
 *   placeholder="you@example.com"
 *   icon={<Mail className="h-5 w-5" />}
 *   error={touched && !email ? "Email is required" : ""}
 *   hint="We'll never share your email"
 * />
 * ```
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, className = "", ...props }, ref) => {
    return (
      <div className="w-full">
        {/* ---- Label (optional) ---- */}
        {label && (
          <label className="mb-2 block text-sm font-medium text-slate-700">
            {label}
            {/* Red asterisk for required fields */}
            {props.required && <span className="ml-1 text-red-500">*</span>}
          </label>
        )}

        {/* ---- Input wrapper (relative for icon positioning) ---- */}
        <div className="relative">
          {/* Leading icon (optional) */}
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              {icon}
            </div>
          )}

          <input
            ref={ref}
            className={[
              // Base styles
              "w-full rounded-xl px-4 py-3 text-base",
              "bg-white",
              "border",
              "text-slate-900 placeholder:text-slate-400",
              "shadow-sm",
              "transition-all duration-300 ease-out",
              // Focus styles
              "focus:outline-none focus:border-[#4f7df3] focus:ring-2 focus:ring-blue-200/50",
              // Disabled state
              "disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed",
              // Error state (overrides border & ring colours)
              error
                ? "border-red-400 focus:border-red-400 focus:ring-red-100"
                : "border-slate-200",
              // Extra left padding when an icon is present
              icon ? "pl-10" : "",
              // Consumer-supplied overrides
              className,
            ]
              .filter(Boolean)
              .join(" ")}
            {...props}
          />
        </div>

        {/* ---- Error message (takes precedence over hint) ---- */}
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}

        {/* ---- Hint text (only visible when there's no error) ---- */}
        {hint && !error && (
          <p className="mt-1 text-sm text-slate-500">{hint}</p>
        )}
      </div>
    );
  }
);

// ---------------------------------------------------------------------------
// Display name (improves debugging in React DevTools)
// ---------------------------------------------------------------------------
Input.displayName = "Input";