"use client";

// ---------------------------------------------------------------------------
// External dependencies
// ---------------------------------------------------------------------------
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  AlertCircle,
  Info,
  AlertTriangle,
  X,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Internal modules
// ---------------------------------------------------------------------------
import { Toast, subscribe, removeToast } from "@/lib/toast";

// ---------------------------------------------------------------------------
// Style maps (defined outside the component to avoid re-creation)
// ---------------------------------------------------------------------------

/** Maps a toast type to its corresponding Lucide icon component. */
const ICON_MAP: Record<Toast["type"], React.FC<{ className?: string }>> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

/** Maps a toast type to its container background + border + text colour classes. */
const COLOR_MAP: Record<Toast["type"], string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-red-200 bg-red-50 text-red-800",
  info: "border-blue-200 bg-blue-50 text-blue-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
};

/** Maps a toast type to its icon colour class. */
const ICON_COLOR_MAP: Record<Toast["type"], string> = {
  success: "text-emerald-500",
  error: "text-red-500",
  info: "text-blue-500",
  warning: "text-amber-500",
};

// ===========================================================================
// ToastContainer Component
// ===========================================================================

/**
 * Global toast notification container.
 *
 * Renders a fixed-position stack of toast notifications in the bottom-right
 * corner of the viewport. New toasts slide up from the bottom; dismissed
 * toasts fade out and slide upward.
 *
 * Subscribes to a shared toast state via the `subscribe` helper from
 * `@/lib/toast`, so any part of the application can trigger a toast by
 * calling `addToast()` without needing to manage local state.
 *
 * This component should be rendered **once** at the root of the application
 * (typically in the root layout).
 */
export function ToastContainer() {
  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  /**
   * The current list of active toasts.
   * Updated automatically by the subscription created in the `useEffect` below.
   */
  const [toasts, setToasts] = useState<Toast[]>([]);

  // -------------------------------------------------------------------------
  // Side effects
  // -------------------------------------------------------------------------

  /**
   * Subscribe to the centralised toast store on mount.
   * The returned cleanup function unsubscribes on unmount, preventing
   * memory leaks and stale state updates.
   */
  useEffect(() => {
    const unsubscribe = subscribe(setToasts);
    return unsubscribe;
  }, []);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[100] flex w-full max-w-sm flex-col-reverse gap-3">
      {/* AnimatePresence handles enter/exit animations for each toast */}
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = ICON_MAP[toast.type];

          return (
            <motion.div
              key={toast.id}
              // ---- Animation variants ----
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              // ---- Style classes ----
              className={`pointer-events-auto rounded-xl border p-4 shadow-lg backdrop-blur-sm ${COLOR_MAP[toast.type]}`}
            >
              <div className="flex items-start gap-3">
                {/* Type-specific icon (success / error / info / warning) */}
                <Icon
                  className={`mt-0.5 h-5 w-5 flex-shrink-0 ${ICON_COLOR_MAP[toast.type]}`}
                />

                {/* Toast message body */}
                <p className="flex-1 text-sm font-medium">{toast.message}</p>

                {/* Manual dismiss button */}
                <button
                  onClick={() => removeToast(toast.id)}
                  className="flex-shrink-0 rounded-lg p-1 transition-colors hover:bg-black/5"
                  aria-label="Dismiss"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}