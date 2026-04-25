import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  as?: React.ElementType;
}

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
    const baseStyles =
      "relative inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-200 ease-out hover:-translate-y-1 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300";

    const variants = {
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

    const sizes = {
      sm: "px-3 py-1.5 text-sm gap-2",
      md: "px-4 py-2.5 text-base gap-2",
      lg: "px-6 py-3.5 text-lg gap-3",
    };

    const widthClass = fullWidth ? "w-full" : "";

    return (
      <Component
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${widthClass} ${className}`}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}

        {!isLoading && icon && icon}

        <span>{children}</span>
      </Component>
    );
  }
);

Button.displayName = "Button";