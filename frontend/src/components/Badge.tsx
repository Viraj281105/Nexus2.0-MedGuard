import React from "react";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "info";
  size?: "sm" | "md" | "lg";
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = "default", size = "md", className = "", ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-semibold shadow-sm transition-all duration-200";

    const variants = {
      default: "border-slate-200 bg-white text-slate-700",
      success: "border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50 text-emerald-700",
      warning: "border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 text-amber-700",
      danger: "border-red-200 bg-gradient-to-br from-red-50 to-rose-50 text-red-700",
      info: "border-blue-200 bg-gradient-to-br from-blue-50 to-emerald-50 text-blue-700",
    };

    const sizes = {
      sm: "px-2.5 py-1 text-xs",
      md: "px-3 py-1.5 text-sm",
      lg: "px-4 py-2 text-base",
    };

    return (
      <span ref={ref} className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`} {...props} />
    );
  }
);

Badge.displayName = "Badge";  