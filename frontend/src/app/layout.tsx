// ---------------------------------------------------------------------------
// External dependencies
// ---------------------------------------------------------------------------
import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ToastContainer } from "@/components/Toast";

// ---------------------------------------------------------------------------
// Font configuration
// ---------------------------------------------------------------------------

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

// ---------------------------------------------------------------------------
// SEO & metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: "MedGuard AI - Medical Billing Auditor",
  description:
    "AI-Powered Medical Billing Auditor & Insurance Appeal Engine. Identify overcharges and maximize your insurance claims.",
  keywords:
    "medical billing, insurance appeals, healthcare auditor, CGHS, billing audit",
  // FIX: viewport removed from here — must be a separate export in Next.js 13+
};

// FIX: viewport exported separately so Next.js can apply it correctly.
// This eliminates the build warning on every page that was inheriting layout.tsx.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// ---------------------------------------------------------------------------
// Dark-mode initialisation script
// ---------------------------------------------------------------------------

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
  } catch (e) {}
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
        <script dangerouslySetInnerHTML={{ __html: DARK_MODE_INIT_SCRIPT }} />
      </head>
      <body className={`${plusJakarta.className} antialiased`}>
        {children}
        <ToastContainer />
      </body>
    </html>
  );
}