import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ToastContainer } from "@/components/Toast";

const plusJakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: "MedGuard AI - Medical Billing Auditor",
  description: "AI-Powered Medical Billing Auditor & Insurance Appeal Engine. Identify overcharges and maximize your insurance claims.",
  keywords: "medical billing, insurance appeals, healthcare auditor, CGHS, billing audit",
  viewport: "width=device-width, initial-scale=1.0",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.getItem('color-scheme') === 'dark' ||
                    (!('color-scheme' in localStorage) &&
                     window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className={`${plusJakarta.className} antialiased`}>
        {children}
        <ToastContainer />
      </body>
    </html>
  );
}