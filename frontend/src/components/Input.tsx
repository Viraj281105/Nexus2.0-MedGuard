import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, className = "", ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="mb-2 block text-sm font-medium text-slate-700">
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</div>}
          <input
            ref={ref}
            className={`
              w-full rounded-xl px-4 py-3 text-base
              bg-white
              border border-slate-200
              text-slate-900 placeholder:text-slate-400
              shadow-sm
              transition-all duration-300 ease-out
              focus:outline-none focus:border-[#4f7df3] focus:ring-2 focus:ring-blue-200/50
              disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed
              ${error ? "border-red-400 focus:border-red-400 focus:ring-red-100" : ""}
              ${icon ? "pl-10" : ""}
              ${className}
            `}
            {...props}
          />
        </div>
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        {hint && !error && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";