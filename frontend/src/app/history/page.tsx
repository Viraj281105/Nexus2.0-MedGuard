"use client";

// ---------------------------------------------------------------------------
// External dependencies
// ---------------------------------------------------------------------------
import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  ClipboardCheck,
  TrendingDown,
  Clock,
  Trash2,
  ExternalLink,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Internal modules
// ---------------------------------------------------------------------------
import { Header } from "@/components/Header";
import { Button } from "@/components/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { addToast } from "@/lib/toast";

// ---------------------------------------------------------------------------
// Animation presets
// ---------------------------------------------------------------------------

/**
 * Standard "fade in and slide up" animation used for individual list items
 * and section headers throughout the page.
 */
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
};

/**
 * Staggered container animation.
 * When applied to a parent `motion.div`, all direct children that also have
 * `variants` defined will animate in sequence with the specified delay
 * between each child.
 */
const containerVariants = {
  animate: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Represents a single entry in the analysis history.
 * Persisted in `localStorage` under the key `medguard_history`.
 */
interface HistoryEntry {
  /** Unique identifier for the entry (typically a UUID or timestamp). */
  id: string;

  /** Whether this was a bill audit or an insurance appeal. */
  type: "bill" | "insurance";

  /** Name of the patient associated with this case. */
  patientName: string;

  /** Name of the insurance provider. */
  insurerName: string;

  /** The medical procedure or billing issue that was analysed. */
  procedureOrIssue: string;

  /** Human-readable date string for display purposes. */
  date: string;

  /** Estimated savings identified (in INR). */
  savings: number;

  /** Number of individual findings / anomalies detected. */
  findingsCount: number;

  /** Confidence percentage (0–100) for the analysis. */
  confidence: number;

  /** ISO timestamp of when the entry was originally created. */
  createdAt: string;
}

// ===========================================================================
// HistoryPage Component
// ===========================================================================

export default function HistoryPage() {
  // -------------------------------------------------------------------------
  // State — initialised from localStorage (client-side only)
  // -------------------------------------------------------------------------

  /**
   * Lazy initialiser for the history list.
   *
   * Reads from `localStorage` on first render. The `typeof window` guard
   * prevents SSR errors when Next.js tries to pre-render the page on the
   * server (where `localStorage` does not exist).
   */
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("medguard_history");
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          // If the stored JSON is corrupted, fall through and return an
          // empty array so the app doesn't crash.
        }
      }
    }
    return [];
  });

  // -------------------------------------------------------------------------
  // Event handlers
  // -------------------------------------------------------------------------

  /**
   * Clear all history entries.
   *
   * Removes the data from both React state and `localStorage`, then shows
   * a confirmation toast so the user knows the operation succeeded.
   */
  const clearHistory = () => {
    localStorage.removeItem("medguard_history");
    setHistory([]);
    addToast("History cleared", "info");
  };

  /**
   * Remove a single history entry by its unique ID.
   *
   * Filters the entry out of state and immediately persists the updated
   * array back to `localStorage`. Does **not** show a toast to avoid
   * notification fatigue during rapid deletions.
   */
  const removeEntry = (id: string) => {
    const updated = history.filter((entry) => entry.id !== id);
    setHistory(updated);
    localStorage.setItem("medguard_history", JSON.stringify(updated));
  };

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Format an ISO date string into a human-readable form.
   *
   * Example output: "Apr 25, 2026, 03:30 PM"
   */
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <main className="min-h-screen bg-transparent text-slate-900">
      <Header showNav={false} />

      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <motion.div
          className="space-y-8"
          variants={containerVariants}
          initial="initial"
          animate="animate"
        >
          {/* =============================================================== */}
          {/* Page header — title + clear-all button                          */}
          {/* =============================================================== */}
          <motion.div
            variants={fadeInUp}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              {/* Back navigation link */}
              <Link
                href="/"
                className="flex items-center gap-2 text-slate-500 transition-all duration-200 hover:-translate-y-0.5 hover:text-blue-600"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>

              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Recent Analyses
              </h1>
            </div>

            {/* "Clear All" button — only visible when there are entries */}
            {history.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearHistory}
                icon={<Trash2 className="h-4 w-4" />}
                className="text-slate-500 transition-colors hover:text-red-600"
              >
                Clear All
              </Button>
            )}
          </motion.div>

          {/* =============================================================== */}
          {/* Empty state — shown when no history entries exist               */}
          {/* =============================================================== */}
          {history.length === 0 ? (
            <motion.div variants={fadeInUp}>
              <Card className="border-slate-200/60 bg-white/50 p-12 text-center backdrop-blur-sm">
                <div className="space-y-4">
                  {/* Decorative clock icon in a soft gradient circle */}
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-blue-200 bg-gradient-to-br from-blue-100 to-emerald-100">
                    <Clock className="h-8 w-8 text-blue-500" />
                  </div>

                  <div>
                    <p className="text-lg font-semibold text-slate-900">
                      No analyses yet
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Your analyzed bills and claims will appear here.
                    </p>
                  </div>

                  {/* CTA to start the first analysis */}
                  <Link href="/">
                    <Button
                      size="md"
                      className="bg-gradient-to-r from-[#4f7df3] via-[#4fc3a1] to-[#56c271] font-semibold text-white shadow-md transition-all duration-300 hover:shadow-lg hover:shadow-blue-300/30"
                    >
                      Start Your First Analysis
                    </Button>
                  </Link>
                </div>
              </Card>
            </motion.div>
          ) : (
            /* =========================================================== */
            /* History list — rendered when entries exist                  */
            /* =========================================================== */
            <motion.div variants={fadeInUp} className="space-y-4">
              {history.map((entry) => (
                <motion.div key={entry.id} variants={fadeInUp}>
                  <Card
                    hover
                    className="border-slate-200/60 bg-white/50 p-6 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:shadow-blue-100/50"
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* ---- Left side: icon + metadata ------------------- */}
                      <div className="flex min-w-0 flex-1 items-start gap-4">
                        {/* Type icon — different gradient per entry type */}
                        <div
                          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${
                            entry.type === "bill"
                              ? "bg-gradient-to-br from-blue-100 to-blue-200"
                              : "bg-gradient-to-br from-emerald-100 to-green-200"
                          }`}
                        >
                          {entry.type === "bill" ? (
                            <FileText className="h-5 w-5 text-blue-600" />
                          ) : (
                            <ClipboardCheck className="h-5 w-5 text-emerald-600" />
                          )}
                        </div>

                        {/* Metadata */}
                        <div className="min-w-0 flex-1">
                          {/* Patient name + type badge */}
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate font-semibold text-slate-900">
                              {entry.patientName || "Unknown Patient"}
                            </h3>
                            <Badge
                              variant={
                                entry.type === "bill" ? "info" : "success"
                              }
                              size="sm"
                            >
                              {entry.type === "bill"
                                ? "Medical Bill"
                                : "Insurance Claim"}
                            </Badge>
                          </div>

                          {/* Insurer + procedure summary */}
                          <p className="mt-1 truncate text-sm text-slate-500">
                            {entry.insurerName} · {entry.procedureOrIssue}
                          </p>

                          {/* Detail row: date, savings, findings, confidence */}
                          <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {formatDate(entry.createdAt)}
                            </span>

                            <span className="flex items-center gap-1">
                              <TrendingDown className="h-3.5 w-3.5 text-emerald-500" />
                              <span className="font-semibold text-emerald-600">
                                ₹{entry.savings.toLocaleString()}
                              </span>
                            </span>

                            <span>
                              {entry.findingsCount} finding
                              {entry.findingsCount !== 1 ? "s" : ""}
                            </span>

                            <span>{entry.confidence}% confidence</span>
                          </div>
                        </div>
                      </div>

                      {/* ---- Right side: action buttons ------------------- */}
                      <div className="flex flex-shrink-0 items-center gap-2">
                        {/* View button — navigates to the results page */}
                        <Link href="/results">
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<ExternalLink className="h-4 w-4" />}
                            className="text-slate-500 hover:text-blue-600"
                          >
                            View
                          </Button>
                        </Link>

                        {/* Delete button — removes this single entry */}
                        <button
                          onClick={() => removeEntry(entry.id)}
                          aria-label={`Delete ${
                            entry.type === "bill" ? "bill" : "claim"
                          } analysis for ${entry.patientName || "Unknown Patient"}`}
                          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          )}
        </motion.div>
      </div>
    </main>
  );
}