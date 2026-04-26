// ---------------------------------------------------------------------------
// lib/toast.ts — Lightweight toast notification system
// ---------------------------------------------------------------------------

export type ToastType = "success" | "error" | "warning" | "info";

type ToastListener = (message: string, type: ToastType) => void;

let listener: ToastListener | null = null;

export function addToast(message: string, type: ToastType = "info"): void {
  if (listener) {
    listener(message, type);
  } else {
    // Fallback if Toast component isn't mounted yet
    console.warn(`[${type.toUpperCase()}] ${message}`);
  }
}

export function registerToastListener(fn: ToastListener): () => void {
  listener = fn;
  return () => { listener = null; };
}