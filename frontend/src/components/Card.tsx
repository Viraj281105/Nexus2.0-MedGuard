// ---------------------------------------------------------------------------
// External dependencies
// ---------------------------------------------------------------------------
import React from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Props for the Card component.
 * Extends native `<div>` attributes so consumers can pass standard HTML
 * props such as `id`, `onClick`, `aria-label`, etc.
 */
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Visual style variant.
   *
   * - `default`  — Subtle white background with border and shadow
   * - `glass`    — Frosted glass effect with backdrop blur
   * - `outlined` — Blue-to-emerald gradient background with blue border
   *
   * @default "default"
   */
  variant?: "default" | "glass" | "outlined";

  /**
   * When `true`, the card lifts slightly on hover (`translateY(-1)`) and
   * gains a blue-tinted shadow, providing a subtle interactive cue.
   *
   * @default false
   */
  hover?: boolean;
}

/** Props for sub-components — all extend native HTML attributes. */
type CardHeaderProps = React.HTMLAttributes<HTMLDivElement>;
type CardTitleProps = React.HTMLAttributes<HTMLHeadingElement>;
type CardContentProps = React.HTMLAttributes<HTMLDivElement>;
type CardFooterProps = React.HTMLAttributes<HTMLDivElement>;

// ---------------------------------------------------------------------------
// Style maps (defined outside the component to avoid re-creation)
// ---------------------------------------------------------------------------

/** Shared base styles applied to every card regardless of variant. */
const BASE_STYLES =
  "rounded-2xl border border-slate-200/60 bg-white/70 backdrop-blur-sm shadow-sm transition-all duration-300 ease-out";

/** Map of variant identifiers to their additional Tailwind class strings. */
const VARIANT_STYLES: Record<NonNullable<CardProps["variant"]>, string> = {
  default: "",
  glass: "bg-white/70 backdrop-blur-sm border-slate-200/60 shadow-md",
  outlined:
    "bg-gradient-to-br from-blue-50/80 to-emerald-50/80 border-blue-200/60 shadow-md",
};

/**
 * Optional hover classes applied when the `hover` prop is `true`.
 * Lifts the card slightly and intensifies the shadow with a blue tint.
 */
const HOVER_STYLES =
  "hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-100/50 hover:border-blue-200";

// ===========================================================================
// Card Component
// ===========================================================================

/**
 * A versatile card container with three visual variants and an optional
 * hover-lift effect.
 *
 * Serves as the root wrapper for the Card family of components
 * (`CardHeader`, `CardTitle`, `CardContent`, `CardFooter`).
 *
 * @example
 * ```tsx
 * <Card variant="glass" hover>
 *   <CardHeader>
 *     <CardTitle>Pipeline Status</CardTitle>
 *   </CardHeader>
 *   <CardContent>
 *     <p>Agents are processing your case...</p>
 *   </CardContent>
 * </Card>
 * ```
 */
export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ variant = "default", hover = false, className = "", ...props }, ref) => {
    // Resolve the additional variant styles; fall back to empty string if
    // an unrecognised variant is passed at runtime.
    const variantClass = VARIANT_STYLES[variant] ?? VARIANT_STYLES.default;

    // Only apply hover styles when the `hover` prop is explicitly true.
    const hoverClass = hover ? HOVER_STYLES : "";

    // Build the final class string by concatenating all style layers and
    // any consumer-supplied override classes.
    const combinedClassName = [
      BASE_STYLES,
      variantClass,
      hoverClass,
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return <div ref={ref} className={combinedClassName} {...props} />;
  }
);

Card.displayName = "Card";

// ===========================================================================
// CardHeader Component
// ===========================================================================

/**
 * Top section of a card, typically containing a title and optional action
 * buttons. Includes a subtle bottom border to visually separate it from
 * the card body.
 */
export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className = "", ...props }, ref) => (
    <div
      ref={ref}
      className={`border-b border-slate-200/60 px-6 py-5 ${className}`}
      {...props}
    />
  )
);

CardHeader.displayName = "CardHeader";

// ===========================================================================
// CardTitle Component
// ===========================================================================

/**
 * Semantic heading element (`<h3>`) used inside `CardHeader`.
 * Provides consistent typography (bold, tracking-tight) for card titles.
 */
export const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className = "", ...props }, ref) => (
    <h3
      ref={ref}
      className={`text-2xl font-bold tracking-tight text-slate-900 ${className}`}
      {...props}
    />
  )
);

CardTitle.displayName = "CardTitle";

// ===========================================================================
// CardContent Component
// ===========================================================================

/**
 * Main body of the card. Applies standard horizontal padding and vertical
 * spacing so content inside cards has a consistent rhythm.
 */
export const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className = "", ...props }, ref) => (
    <div ref={ref} className={`px-6 py-5 ${className}`} {...props} />
  )
);

CardContent.displayName = "CardContent";

// ===========================================================================
// CardFooter Component
// ===========================================================================

/**
 * Bottom section of a card, typically used for action buttons or summary
 * information. Includes a subtle top border and uses flexbox with a gap
 * for easy button grouping.
 */
export const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className = "", ...props }, ref) => (
    <div
      ref={ref}
      className={`flex gap-3 border-t border-slate-200/60 px-6 py-5 ${className}`}
      {...props}
    />
  )
);

CardFooter.displayName = "CardFooter";