// ---------------------------------------------------------------------------
// External dependencies
// ---------------------------------------------------------------------------
import React from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Props for the Badge component.
 * Extends native `<span>` attributes so consumers can pass standard HTML
 * props such as `id`, `aria-label`, `onClick`, etc.
 */
interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /**
   * Visual style variant.
   *
   * - `default` — Neutral grey (used for general labels)
   * - `success` — Green gradient (used for completed / approved status)
   * - `warning` — Amber gradient (used for attention / pending status)
   * - `danger`  — Red gradient (used for errors / rejected status)
   * - `info`    — Blue-to-emerald gradient (used for informational labels)
   *
   * @default "default"
   */
  variant?: "default" | "success" | "warning" | "danger" | "info";

  /**
   * Size preset controlling padding and font size.
   *
   * - `sm` — Compact (ideal for inline use inside tables or lists)
   * - `md` — Standard (good default for most use-cases)
   * - `lg` — Large (for hero sections or prominent call-outs)
   *
   * @default "md"
   */
  size?: "sm" | "md" | "lg";

  /**
   * Optional additional CSS classes appended to the generated class string.
   * Useful for one-off margin/padding overrides without creating a new variant.
   */
  className?: string;
}

// ---------------------------------------------------------------------------
// Style maps (defined outside the component to avoid re-creation)
// ---------------------------------------------------------------------------

/** Shared base styles applied to every badge regardless of variant. */
const BASE_STYLES =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-semibold shadow-sm transition-all duration-200";

/** Map of variant identifiers to their corresponding Tailwind class strings. */
const VARIANT_STYLES: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "border-slate-200 bg-white text-slate-700",
  success:
    "border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50 text-emerald-700",
  warning:
    "border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 text-amber-700",
  danger:
    "border-red-200 bg-gradient-to-br from-red-50 to-rose-50 text-red-700",
  info: "border-blue-200 bg-gradient-to-br from-blue-50 to-emerald-50 text-blue-700",
};

/** Map of size presets to their corresponding Tailwind class strings. */
const SIZE_STYLES: Record<NonNullable<BadgeProps["size"]>, string> = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-3 py-1.5 text-sm",
  lg: "px-4 py-2 text-base",
};

// ===========================================================================
// Badge Component
// ===========================================================================

/**
 * A small, rounded label used to highlight status, categories, or metadata.
 *
 * Supports five colour variants and three sizes. Renders a `<span>` element
 * and forwards a ref so parent components can interact with the underlying
 * DOM node directly (e.g. for measuring or focus management).
 *
 * @example
 * ```tsx
 * <Badge variant="success" size="sm">Completed</Badge>
 * <Badge variant="info">12 findings</Badge>
 * ```
 */
export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = "default", size = "md", className = "", ...props }, ref) => {
    // Resolve the style strings for the selected variant and size, falling
    // back to "default" / "md" if an unexpected value is passed at runtime.
    const variantClass = VARIANT_STYLES[variant] ?? VARIANT_STYLES.default;
    const sizeClass = SIZE_STYLES[size] ?? SIZE_STYLES.md;

    // Build the final class string by concatenating the base, variant,
    // size, and any consumer-supplied override classes.
    const combinedClassName = [
      BASE_STYLES,
      variantClass,
      sizeClass,
      className,
    ]
      .filter(Boolean) // Remove any falsy entries (e.g. empty className)
      .join(" ");

    return <span ref={ref} className={combinedClassName} {...props} />;
  }
);

// ---------------------------------------------------------------------------
// Display name (improves debugging in React DevTools)
// ---------------------------------------------------------------------------
Badge.displayName = "Badge";