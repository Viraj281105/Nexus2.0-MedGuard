import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "glass" | "outlined";
  hover?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ variant = "default", hover = false, className = "", ...props }, ref) => {
    const baseStyles =
      "rounded-2xl border border-slate-200/60 bg-white/70 backdrop-blur-sm shadow-sm transition-all duration-300 ease-out";

    const variants = {
      default: "",
      glass:
        "bg-white/70 backdrop-blur-sm border-slate-200/60 shadow-md",
      outlined:
        "bg-gradient-to-br from-blue-50/80 to-emerald-50/80 border-blue-200/60 shadow-md",
    };

    const hoverStyles = hover
      ? "hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-100/50 hover:border-blue-200"
      : "";

    return (
      <div
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${hoverStyles} ${className}`}
        {...props}
      />
    );
  }
);

Card.displayName = "Card";

/* ✅ FIX: use type instead of empty interface */
type CardHeaderProps = React.HTMLAttributes<HTMLDivElement>;

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

type CardTitleProps = React.HTMLAttributes<HTMLHeadingElement>;

export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  CardTitleProps
>(({ className = "", ...props }, ref) => (
  <h3
    ref={ref}
    className={`text-2xl font-bold tracking-tight text-slate-900 ${className}`}
    {...props}
  />
));

CardTitle.displayName = "CardTitle";

type CardContentProps = React.HTMLAttributes<HTMLDivElement>;

export const CardContent = React.forwardRef<
  HTMLDivElement,
  CardContentProps
>(({ className = "", ...props }, ref) => (
  <div ref={ref} className={`px-6 py-5 ${className}`} {...props} />
));

CardContent.displayName = "CardContent";

type CardFooterProps = React.HTMLAttributes<HTMLDivElement>;

export const CardFooter = React.forwardRef<
  HTMLDivElement,
  CardFooterProps
>(({ className = "", ...props }, ref) => (
  <div
    ref={ref}
    className={`flex gap-3 border-t border-slate-200/60 px-6 py-5 ${className}`}
    {...props}
  />
));

CardFooter.displayName = "CardFooter";