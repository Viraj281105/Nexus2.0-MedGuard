// ---------------------------------------------------------------------------
// lib/toast.ts — Lightweight pub/sub toast notification system
// ---------------------------------------------------------------------------
//
// Provides a framework-agnostic toast manager that any part of the
// application can use without prop-drilling or context providers.
//
// Architecture:
// - A single mutable array holds the current list of active toasts.
// - Components subscribe via `subscribe()` and receive a snapshot of the
//   array whenever it changes.
// - `addToast()` creates a toast and auto-dismisses it after 4 seconds.
// - `removeToast()` allows manual dismissal (e.g. close button).
//
// The `ToastContainer` component in `@/components/Toast` is the default
// consumer — it subscribes on mount and renders the current toast list.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The visual style applied to a toast notification. */
type ToastType = "success" | "error" | "info" | "warning";

/** A single toast notification. */
export interface Toast {
  /** Unique identifier (timestamp + random suffix). */
  id: string;
  /** Human-readable message displayed in the toast body. */
  message: string;
  /** Determines the icon and colour scheme. */
  type: ToastType;
}

/**
 * A callback invoked with the current list of toasts whenever the list
 * changes (add or remove). The array is a shallow copy so consumers
 * can safely reference or mutate it without side effects.
 */
type Listener = (toasts: Toast[]) => void;

// ---------------------------------------------------------------------------
// Module-level state (singleton)
// ---------------------------------------------------------------------------

/** Registry of active listener callbacks. */
let listeners: Listener[] = [];

/** The single source of truth for the current toast list. */
let toasts: Toast[] = [];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Notify all registered listeners with a shallow copy of the current
 * toast array. This ensures each listener receives a stable snapshot
 * that won't be mutated by subsequent operations.
 */
function notify(): void {
  const snapshot = [...toasts];
  listeners.forEach((listener) => listener(snapshot));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Add a new toast notification.
 *
 * The toast is automatically removed after 4 seconds. Multiple toasts can
 * coexist — each has a unique ID generated from the current timestamp and
 * a random suffix.
 *
 * @param message - The text displayed inside the toast.
 * @param type    - Visual style (default: `"info"`).
 *
 * @example
 * ```ts
 * addToast("Case submitted successfully", "success");
 * addToast("Network error — using demo data", "warning");
 * ```
 */
export function addToast(
  message: string,
  type: ToastType = "info"
): void {
  // Generate a unique ID that is extremely unlikely to collide.
  const id =
    Date.now().toString() + Math.random().toString(36).slice(2);

  // Append the new toast to the array.
  toasts = [...toasts, { id, message, type }];
  notify();

  // Schedule automatic dismissal after 4 seconds.
  setTimeout(() => removeToast(id), 4_000);
}

/**
 * Remove a toast by its ID.
 *
 * Safe to call even if the ID no longer exists (e.g. already auto-dismissed
 * or manually dismissed twice) — the operation is a no-op in that case.
 *
 * @param id - The unique identifier of the toast to remove.
 */
export function removeToast(id: string): void {
  toasts = toasts.filter((t) => t.id !== id);
  notify();
}

/**
 * Subscribe to toast list changes.
 *
 * The callback is invoked immediately with the current state, and again
 * whenever the list changes. Returns an unsubscribe function that should
 * be called on cleanup (e.g. in a `useEffect` return) to prevent memory
 * leaks.
 *
 * @param listener - A callback that receives the current toast array.
 * @returns A cleanup function that unsubscribes the listener.
 *
 * @example
 * ```ts
 * useEffect(() => {
 *   const unsubscribe = subscribe(setToasts);
 *   return unsubscribe;
 * }, []);
 * ```
 */
export function subscribe(listener: Listener): () => void {
  listeners.push(listener);

  // Immediately notify the new listener with the current state so it
  // doesn't need to perform a separate initial read.
  listener([...toasts]);

  // Return a cleanup function that removes this specific listener.
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}