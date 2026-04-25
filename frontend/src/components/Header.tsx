"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

interface HeaderProps {
  showNav?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ showNav = true }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/30 bg-gradient-to-r from-[#4f7df3]/15 via-[#4fc3a1]/10 to-[#56c271]/15 backdrop-blur-lg shadow-sm shadow-blue-100/30">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        
        <Link href="/" className="group flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#4f7df3] via-[#4fc3a1] to-[#56c271] shadow-md shadow-blue-300/40 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lg">
            <span className="text-white font-bold text-lg drop-shadow-sm">M</span>
          </div>
          <span className="hidden text-lg font-bold tracking-tight text-slate-900 sm:inline">
            MedGuard
          </span>
        </Link>

        {showNav && (
          <div className="hidden md:flex items-center gap-8">
            <Link href="/" className="group relative font-medium text-slate-700 transition-colors hover:text-blue-600">
              Home
              <span className="absolute -bottom-1 left-0 h-[2px] w-0 bg-gradient-to-r from-[#4f7df3] via-[#4fc3a1] to-[#56c271] transition-all duration-300 group-hover:w-full" />
            </Link>
            <Link href="/submit" className="group relative font-medium text-slate-700 transition-colors hover:text-blue-600">
              Submit
              <span className="absolute -bottom-1 left-0 h-[2px] w-0 bg-gradient-to-r from-[#4f7df3] via-[#4fc3a1] to-[#56c271] transition-all duration-300 group-hover:w-full" />
            </Link>
            <Link href="/results" className="group relative font-medium text-slate-700 transition-colors hover:text-blue-600">
              Results
              <span className="absolute -bottom-1 left-0 h-[2px] w-0 bg-gradient-to-r from-[#4f7df3] via-[#4fc3a1] to-[#56c271] transition-all duration-300 group-hover:w-full" />
            </Link>
            <Link href="/history" className="group relative font-medium text-slate-700 transition-colors hover:text-blue-600">
              History
              <span className="absolute -bottom-1 left-0 h-[2px] w-0 bg-gradient-to-r from-[#4f7df3] via-[#4fc3a1] to-[#56c271] transition-all duration-300 group-hover:w-full" />
            </Link>
          </div>
        )}

        <div className="md:hidden">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="rounded-xl border border-slate-200 bg-white/60 backdrop-blur-sm p-2 text-slate-600 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {isMenuOpen && (
        <div className="border-t border-slate-200/30 bg-gradient-to-r from-[#4f7df3]/15 via-[#4fc3a1]/10 to-[#56c271]/15 backdrop-blur-lg md:hidden">
          <div className="px-4 py-4 space-y-2">
            <Link href="/" className="block rounded-xl px-4 py-2 font-medium text-slate-700 transition-all duration-200 hover:bg-white/50 hover:text-blue-600">Home</Link>
            <Link href="/submit" className="block rounded-xl px-4 py-2 font-medium text-slate-700 transition-all duration-200 hover:bg-white/50 hover:text-blue-600">Submit</Link>
            <Link href="/results" className="block rounded-xl px-4 py-2 font-medium text-slate-700 transition-all duration-200 hover:bg-white/50 hover:text-blue-600">Results</Link>
            <Link href="/history" className="block rounded-xl px-4 py-2 font-medium text-slate-700 transition-all duration-200 hover:bg-white/50 hover:text-blue-600">History</Link>
          </div>
        </div>
      )}
    </header>
  );
};