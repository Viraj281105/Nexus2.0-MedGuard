"use client";

// ---------------------------------------------------------------------------
// External dependencies
// ---------------------------------------------------------------------------
import React, { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Props for the Header component.
 */
interface HeaderProps {
  /**
   * Controls whether the desktop navigation links are rendered.
   * Set to `false` on focused pages (e.g. login, case detail) where
   * the full nav bar would distract from the primary task.
   *
   * @default true
   */
  showNav?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Shared navigation link definitions used by both the desktop nav bar
 * and the mobile hamburger menu. Defined once to keep the two lists
 * in sync automatically.
 */
const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/submit", label: "Submit" },
  { href: "/results", label: "Results" },
  { href: "/history", label: "History" },
] as const;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * The animated underline that slides in from the left on hover.
 * Used by the desktop navigation links.
 */
const HoverUnderline: React.FC = () => (
  <span className="absolute -bottom-1 left-0 h-[2px] w-0 bg-gradient-to-r from-[#4f7df3] via-[#4fc3a1] to-[#56c271] transition-all duration-300 group-hover:w-full" />
);

// ===========================================================================
// Header Component
// ===========================================================================

/**
 * Sticky top-level header with a gradient glass-morphism background.
 *
 * Features:
 * - Brand logo + "MedGuard" text (text hidden on small screens)
 * - Desktop navigation links with animated underline on hover
 * - Mobile hamburger menu with slide-down overlay
 * - `showNav` prop to hide navigation on focused pages
 */
export const Header: React.FC<HeaderProps> = ({ showNav = true }) => {
  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  /** Tracks whether the mobile hamburger menu is open. */
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/30 bg-gradient-to-r from-[#4f7df3]/15 via-[#4fc3a1]/10 to-[#56c271]/15 shadow-sm shadow-blue-100/30 backdrop-blur-lg">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* =============================================================== */}
        {/* Brand logo + name                                               */}
        {/* =============================================================== */}
        <Link href="/" className="group flex items-center gap-2">
          {/* Logo square with brand gradient */}
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#4f7df3] via-[#4fc3a1] to-[#56c271] shadow-md shadow-blue-300/40 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lg">
            <span className="text-lg font-bold text-white drop-shadow-sm">
              M
            </span>
          </div>

          {/* Brand name — hidden on very small screens to save space */}
          <span className="hidden text-lg font-bold tracking-tight text-slate-900 sm:inline">
            MedGuard
          </span>
        </Link>

        {/* =============================================================== */}
        {/* Desktop navigation links                                       */}
        {/* =============================================================== */}
        {showNav && (
          <div className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group relative font-medium text-slate-700 transition-colors hover:text-blue-600"
              >
                {link.label}
                <HoverUnderline />
              </Link>
            ))}
          </div>
        )}

        {/* =============================================================== */}
        {/* Mobile hamburger toggle button                                 */}
        {/* =============================================================== */}
        <div className="md:hidden">
          <button
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className="rounded-xl border border-slate-200 bg-white/60 p-2 text-slate-600 shadow-sm backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
            aria-label="Toggle menu"
          >
            {isMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </nav>

      {/* =============================================================== */}
      {/* Mobile menu overlay (slide-down)                                */}
      {/* =============================================================== */}
      {isMenuOpen && (
        <div className="border-t border-slate-200/30 bg-gradient-to-r from-[#4f7df3]/15 via-[#4fc3a1]/10 to-[#56c271]/15 backdrop-blur-lg md:hidden">
          <div className="space-y-2 px-4 py-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block rounded-xl px-4 py-2 font-medium text-slate-700 transition-all duration-200 hover:bg-white/50 hover:text-blue-600"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
};