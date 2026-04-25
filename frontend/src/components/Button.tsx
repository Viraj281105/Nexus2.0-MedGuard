// ---------------------------------------------------------------------------
// External dependencies
// ---------------------------------------------------------------------------
import React from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Props for the Button component.
 * Extends native `<button>` attributes so consumers can pass standard HTML
 * props such as `type`, `onClick`, `aria-label`, etc.
 */
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Visual style variant.
   *
   * - `primary`   — Brand gradient (blue → green), white text, prominent shadow
   * - `secondary` — White background with slate border, subtle hover
   * - `outline`   — Blue border, white background, gradient hover
   * - `danger`    — Solid red, for destructive actions
   * - `ghost`     — Transparent background, slate text, subtle hover
   *
   * @default "primary"
   */
  variant?: "primary" | "secondary" | "outline" | "danger" | "ghost";

  /**
   * Size preset controlling padding, font size, and icon gap.
   *
   * - `sm` — Compact (ideal for inline actions or table rows)
   * - `md` — Standard (good default for most buttons)
   * - `lg` — Large (for hero sections or primary CTAs)
   *
   * @default "md"
   */
  size?: "sm" | "md" | "lg";

  /**
   * When `true`, the button shows a spinning loader and is automatically
   * disabled to prevent double-submission.
   *
   * @default false
   */
  isLoading?: boolean;

  /**
   * Optional icon rendered to the left of the button text.
   * Hidden while `isLoading` is active (the spinner takes its place).
   */
  icon?: React.ReactNode;

  /**
   * When `true`, the button stretches to fill the full width of its
   * parent container.
   *
   * @default false
   */
  fullWidth?: boolean;

  /**
   * Optional polymorphic element type.
   *
   * Allows the button to render as a different element (e.g. `a` for
   * link-styled buttons) while retaining all the button styles and
   * behaviour. Defaults to `"button"`.
   */
  as?: React.ElementType;
}

// ---------------------------------------------------------------------------
// Style maps (defined outside the component to avoid re-creation)
// ---------------------------------------------------------------------------

/** Shared base styles applied to every button regardless of variant or size. */
const BASE_STYLES =
  "relative inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-200 ease-out hover:-translate-y-1 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300";

/** Map of variant identifiers to their corresponding Tailwind class strings. */
const VARIANT_STYLES: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-gradient-to-r from-[#4f7df3] via-[#4fc3a1] to-[#56c271] text-white shadow-md hover:shadow-lg hover:shadow-blue-300/30",
  secondary:
    "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:shadow-md",
  outline:
    "border border-blue-200 bg-white text-blue-700 hover:bg-gradient-to-r hover:from-blue-50 hover:to-emerald-50 hover:shadow-md",
  danger:
    "bg-red-600 text-white shadow-sm hover:bg-red-700 hover:shadow-md",
  ghost:
    "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
};

/** Map of size presets to their corresponding Tailwind class strings. */
const SIZE_STYLES: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "px-3 py-1.5 text-sm gap-2",
  md: "px-4 py-2.5 text-base gap-2",
  lg: "px-6 py-3.5 text-lg gap-3",
};

// ===========================================================================
// Inline spinner sub-component
// ===========================================================================

/**
 * A small, accessible loading spinner rendered inside the button when
 * `isLoading` is `true`. Uses an SVG with two semi-transparent arcs that
 * rotate continuously.
 */
const Spinner: React.FC = () => (
  <svg
    className="h-5 w-5 animate-spin"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    {/* Background track — faint circle */}
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    {/* Animated arc — brighter, spinning */}
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

// ===========================================================================
// Button Component
// ===========================================================================

/**
 * A versatile, polymorphic button component with multiple visual variants,
 * size presets, loading state, and optional icon support.
 *
 * Uses `React.forwardRef` so parent components can obtain a reference to
 * the underlying DOM element (useful for focus management or measuring).
 *
 * @example
 * ```tsx
 * <Button variant="primary" size="lg" isLoading={saving}>
 *   Save Changes
 * </Button>
 *
 * <Button variant="ghost" size="sm" icon={<Trash2 />} onClick={remove}>
 *   Delete
 * </Button>
 *
 * <Button as="a" href="/login" variant="outline" fullWidth>
 *   Sign In
 * </Button>
 * ```
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      isLoading = false,
      icon,
      fullWidth = false,
      className = "",
      disabled,
      as: Component = "button",
      children,
      ...props
    },
    ref
  ) => {
    // Resolve the style strings for the selected variant and size, falling
    // back to "primary" / "md" if an unexpected value is passed at runtime.
    const variantClass =
      VARIANT_STYLES[variant] ?? VARIANT_STYLES.primary;
    const sizeClass = SIZE_STYLES[size] ?? SIZE_STYLES.md;

    /** When `fullWidth` is true the button stretches to 100 % width. */
    const widthClass = fullWidth ? "w-full" : "";

    // Build the final class string by concatenating all style layers and
    // any consumer-supplied override classes.
    const combinedClassName = [
      BASE_STYLES,
      variantClass,
      sizeClass,
      widthClass,
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <Component
        ref={ref}
        // The button is disabled either explicitly or while loading.
        disabled={disabled || isLoading}
        className={combinedClassName}
        {...props}
      >
        {/* Show the spinner when loading; otherwise render the optional icon. */}
        {isLoading ? (
          <Spinner />
        ) : icon ? (
          icon
        ) : null}

        {/* Button text is always rendered, even during loading (allows
            screen readers to announce the action). */}
        <span>{children}</span>
      </Component>
    );
  }
);

// ---------------------------------------------------------------------------
// Display name (improves debugging in React DevTools)
// ---------------------------------------------------------------------------
Button.displayName = "Button";