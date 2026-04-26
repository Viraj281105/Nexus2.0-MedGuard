"use client";

import { useEffect, useState } from "react";
import { registerToastListener } from "@/lib/toast";
import type { ToastType } from "@/lib/toast";

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

const STYLES: Record<ToastType, string> = {
  success: "bg-green-50  border-green-400  text-green-800",
  error:   "bg-red-50    border-red-400    text-red-800",
  warning: "bg-yellow-50 border-yellow-400 text-yellow-800",
  info:    "bg-blue-50   border-blue-400   text-blue-800",
};

const ICONS: Record<ToastType, string> = {
  success: "✓",
  error:   "✕",
  warning: "⚠",
  info:    "ℹ",
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    return registerToastListener((message, type) => {
      const id = crypto.randomUUID();

      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4_000);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div aria-live="polite" className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="alert"
          className={`flex items-start gap-3 rounded-lg border px-4 py-3 shadow-md ${STYLES[toast.type]}`}
        >
          <span className="mt-0.5 text-sm font-bold shrink-0">{ICONS[toast.type]}</span>
          <p className="flex-1 text-sm leading-snug">{toast.message}</p>
          <button
            onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            aria-label="Dismiss"
            className="shrink-0 text-lg leading-none opacity-50 hover:opacity-100 transition-opacity cursor-pointer"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}