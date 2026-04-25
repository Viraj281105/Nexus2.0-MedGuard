// ---------------------------------------------------------------------------
// External dependencies
// ---------------------------------------------------------------------------
import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ToastContainer } from "@/components/Toast";

// ---------------------------------------------------------------------------
// Font configuration
// ---------------------------------------------------------------------------

/**
 * Primary application font.
 * Plus Jakarta Sans is used for its clean, modern aesthetic and excellent
 * legibility across all weights needed by the design system.
 */
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

// ---------------------------------------------------------------------------
// SEO & metadata
// ---------------------------------------------------------------------------

/**
 * Global metadata applied to every page unless overridden.
 * The `viewport` export has been intentionally kept inside `metadata`
 * for backward compatibility. Newer Next.js versions prefer the separate
 * `generateViewport` / `viewport` export; when you migrate, move it there.
 */
export const metadata: Metadata = {
  title: "MedGuard AI - Medical Billing Auditor",
  description:
    "AI-Powered Medical Billing Auditor & Insurance Appeal Engine. Identify overcharges and maximize your insurance claims.",
  keywords:
    "medical billing, insurance appeals, healthcare auditor, CGHS, billing audit",
  viewport: "width=device-width, initial-scale=1.0",
};

// ---------------------------------------------------------------------------
// Dark-mode initialisation script
// ---------------------------------------------------------------------------

/**
 * Inline script that runs **before** React hydrates.
 *
 * It reads the user's stored preference (`color-scheme`) or falls back to
 * the OS-level `prefers-color-scheme` media query. Adding the `dark` class
 * to `<html>` this early prevents a flash of unstyled content (FOUC).
 */
const DARK_MODE_INIT_SCRIPT = `
  try {
    if (
      localStorage.getItem('color-scheme') === 'dark' ||
      (
        !('color-scheme' in localStorage) &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
      )
    ) {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {
    // Silently ignore environments where localStorage is unavailable
    // (e.g. some privacy-focused browsers or server-side prerendering).
  }
`;

// ---------------------------------------------------------------------------
// Root layout component
// ---------------------------------------------------------------------------

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Inject the dark-mode script before any paint occurs */}
        <script dangerouslySetInnerHTML={{ __html: DARK_MODE_INIT_SCRIPT }} />
      </head>

      <body className={`${plusJakarta.className} antialiased`}>
        {children}

        {/* Global toast notification container — rendered once, shared across pages */}
        <ToastContainer />
      </body>
    </html>
  );
}