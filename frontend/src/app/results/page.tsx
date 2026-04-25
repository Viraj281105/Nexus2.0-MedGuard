"use client";

// ---------------------------------------------------------------------------
// External dependencies
// ---------------------------------------------------------------------------
import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  Download,
  CheckCircle2,
  TrendingDown,
  Scale,
  Zap,
  FileText,
  Send,
  ClipboardCheck,
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
 * Staggered container animation.
 * When applied to a parent `motion.div`, all direct children that also have
 * `variants` defined will animate in sequence with the specified delay
 * between each child.
 */
const containerVariants = {
  animate: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

/**
 * Standard "fade in and slide up" animation used for individual elements
 * throughout the page.
 */
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single billing anomaly or claim discrepancy found during analysis. */
interface Finding {
  /** Name of the line item or procedure. */
  item: string;
  /** Amount actually charged or claimed. */
  charged: number;
  /** The benchmark rate (CGHS, policy, etc.) that was expected. */
  expected_rate: number;
  /** The difference between `charged` and `expected_rate`. */
  difference: number;
  /** Confidence value for this finding (0–1). */
  confidence: number;
}

/** Discriminates between a hospital bill audit and an insurance claim review. */
type AnalysisType = "bill" | "insurance";

/** The complete result payload displayed on this page. */
interface ResultData {
  /** Whether this is a bill or insurance analysis. */
  analysisType: AnalysisType;
  /** Individual line-item findings. */
  findings: Finding[];
  /** Total potential savings / reimbursement. */
  savings: number;
}

// ---------------------------------------------------------------------------
// Skeleton loading component
// ---------------------------------------------------------------------------

/**
 * A simple pulsing placeholder rectangle used during the loading state.
 * Mimics the shape of real content so the page structure is visible while
 * data is being fetched or computed.
 */
function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-lg bg-slate-200/80 ${className}`} />
  );
}

// ---------------------------------------------------------------------------
// AnimatedNumber sub-component
// ---------------------------------------------------------------------------

/**
 * Animates a numeric value from 0 to the target over a given duration.
 *
 * Uses `requestAnimationFrame` for smooth 60 fps updates and applies an
 * ease-out cubic curve so the number decelerates naturally as it approaches
 * the final value.
 *
 * @param value    - The final number to display.
 * @param duration - Animation duration in milliseconds (default 1500).
 */
function AnimatedNumber({
  value,
  duration = 1500,
}: {
  value: number;
  duration?: number;
}) {
  /** The current displayed value, updated on every animation frame. */
  const [displayValue, setDisplayValue] = useState(0);

  /** Tracks when the animation started (used to calculate elapsed time). */
  const startTimeRef = useRef<number | null>(null);

  /** Stores the current `requestAnimationFrame` ID so we can cancel it. */
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    // Reset the start time whenever the target value or duration changes.
    startTimeRef.current = null;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic: starts fast, decelerates towards the end.
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * value);

      setDisplayValue(current);

      // Continue animating until we reach 100 % progress.
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    // Cleanup: cancel the animation frame if the component unmounts or the
    // value/duration changes before the animation finishes.
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [value, duration]);

  return <span>₹{displayValue.toLocaleString()}</span>;
}

// ===========================================================================
// Results Page Component
// ===========================================================================

export default function Results() {
  // -------------------------------------------------------------------------
  // State — initialised from localStorage (client-side only)
  // -------------------------------------------------------------------------

  /**
   * Lazy initialiser for the results data.
   *
   * Reads from `localStorage` on first render. Falls back to a hard-coded
   * demo dataset when no stored data exists (e.g. first-time visitor or
   * after clearing history). The `typeof window` guard prevents SSR errors.
   */
  const [data, setData] = useState<ResultData | null>(() => {
    if (typeof window === "undefined") return null;

    const savedData = localStorage.getItem("medguard_results");
    if (savedData) {
      const parsed = JSON.parse(savedData);

      // Normalise older data shapes into the current `ResultData` interface.
      return {
        analysisType: parsed.analysisType || "bill",
        findings: parsed.overcharges
          ? parsed.overcharges.map(
              (o: {
                item: string;
                charged: number;
                cghs_rate: number;
                overcharge: number;
                confidence: number;
              }) => ({
                item: o.item,
                charged: o.charged,
                expected_rate: o.cghs_rate,
                difference: o.overcharge,
                confidence: o.confidence,
              })
            )
          : parsed.findings || [],
        savings: parsed.savings_estimate || parsed.savings || 0,
      };
    }

    // Demo fallback data — allows the UI to be explored without real input.
    return {
      analysisType: "bill",
      findings: [
        {
          item: "Complete Blood Count",
          charged: 850,
          expected_rate: 320,
          difference: 530,
          confidence: 0.95,
        },
        {
          item: "Room Rent (General)",
          charged: 4500,
          expected_rate: 3000,
          difference: 1500,
          confidence: 0.85,
        },
      ],
      savings: 2030,
    };
  });

  // -------------------------------------------------------------------------
  // Report generation state
  // -------------------------------------------------------------------------

  /** `true` while the report generation request is in flight. */
  const [isGenerating, setIsGenerating] = useState(false);

  /** Becomes `true` once the report has been successfully generated. */
  const [reportReady, setReportReady] = useState(false);

  /** URL to the generated report PDF (if available). */
  const [reportLink, setReportLink] = useState("");

  // -------------------------------------------------------------------------
  // Derived values
  // -------------------------------------------------------------------------

  /** Convenience flag — `true` when analysing a hospital bill. */
  const isBillAnalysis = data?.analysisType === "bill";

  /**
   * Aggregate confidence score across all findings (0–100).
   * Computed as the average of individual finding confidences.
   */
  const confidenceScore = data
    ? Math.round(
        (data.findings.reduce((sum, item) => sum + item.confidence, 0) /
          data.findings.length) *
          100
      )
    : 0;

  // -------------------------------------------------------------------------
  // Context-aware labels
  // -------------------------------------------------------------------------

  /** Label for the column showing what was actually charged/claimed. */
  const statsLabel = isBillAnalysis ? "Hospital Charged" : "Claimed Amount";

  /** Label for the column showing the benchmark/eligible rate. */
  const rateLabel = isBillAnalysis ? "Standard Rate" : "Eligible Amount";

  /** Label for the difference column. */
  const diffLabel = isBillAnalysis ? "Overcharge" : "Underpaid";

  /** Text colour class for the difference value. */
  const diffColor = isBillAnalysis ? "text-emerald-600" : "text-orange-600";

  /** Icon colour class for the difference indicator. */
  const diffIconColor = isBillAnalysis
    ? "text-emerald-600"
    : "text-orange-600";

  /** Title shown above the findings list. */
  const findingsTitle = isBillAnalysis
    ? "Audit Findings"
    : "Claim Review Findings";

  /** Label for the total potential savings/reimbursement. */
  const recoveryLabel = isBillAnalysis
    ? "Potential Recovery"
    : "Potential Reimbursement";

  /** Button label for initiating report generation. */
  const generateLabel = isBillAnalysis ? "Generate Appeal" : "Generate Dispute";

  /** Button label shown while the report is being generated. */
  const generatingLabel = "Generating...";

  /** Status message shown once the report is ready. */
  const readyLabel = isBillAnalysis ? "Appeal Ready" : "Report Ready";

  /** Label for the share button. */
  const shareLabel = isBillAnalysis ? "Share Appeal" : "Share Report";

  /**
   * Processing pipeline steps shown in the sidebar.
   * The last step is always incomplete until a future phase is implemented.
   */
  const processSteps = isBillAnalysis
    ? [
        { label: "Bill Analysis", complete: true },
        { label: "Rate Verification", complete: true },
        { label: "Report Drafting", complete: reportReady },
        { label: "Legal Review", complete: false },
      ]
    : [
        { label: "Claim Analysis", complete: true },
        { label: "Policy Verification", complete: true },
        { label: "Report Drafting", complete: reportReady },
        { label: "Final Review", complete: false },
      ];

  /** Ordered list of recommended next steps shown at the bottom of the page. */
  const nextSteps = isBillAnalysis
    ? [
        "Download your generated analysis report",
        "Review the findings carefully",
        "Submit appeal to your insurance provider within 30 days",
        "Track your claim status in the portal",
      ]
    : [
        "Download your generated claim review report",
        "Review identified discrepancies carefully",
        "File a dispute with supporting documentation",
        "Track your reimbursement status in the portal",
      ];

  // -------------------------------------------------------------------------
  // Event handlers
  // -------------------------------------------------------------------------

  /**
   * Trigger report generation via the backend API.
   *
   * On success the returned download URL is stored and the "report ready"
   * UI is revealed. On failure a toast notification is shown and a fallback
   * timer simulates completion so the user can still explore the UI.
   */
  const handleGenerateReport = async () => {
    setIsGenerating(true);

    try {
      const response = await fetch("/api/generate-report", {
        method: "POST",
      });

      if (response.ok) {
        const result = await response.json();
        setReportLink(result.download_url);
        setReportReady(true);
      } else {
        throw new Error("Failed to generate");
      }
    } catch (err) {
      console.error(err);
      addToast("Report generation failed. Using demo.", "warning");

      // Fallback: simulate completion after a short delay so the UI isn't
      // stuck in a loading state forever.
      setTimeout(() => setReportReady(true), 2_000);
    } finally {
      setIsGenerating(false);
    }
  };

  // =========================================================================
  // Loading state — full-page skeleton
  // =========================================================================

  if (!data) {
    return (
      <main className="min-h-screen bg-transparent text-slate-900">
        <Header showNav={true} />

        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="space-y-12">
            {/* ---- Skeleton stat cards ---- */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card
                  key={i}
                  className="border-slate-200/60 bg-white/70 p-6 shadow-md backdrop-blur-sm"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-3">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-8 w-32" />
                    </div>
                    <Skeleton className="h-12 w-12 rounded-xl" />
                  </div>
                </Card>
              ))}
            </div>

            {/* ---- Skeleton main content ---- */}
            <div className="grid gap-8 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                <Card className="border-slate-200/60 bg-white/70 shadow-md backdrop-blur-sm">
                  <CardHeader>
                    <Skeleton className="h-7 w-48" />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[1, 2].map((i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-slate-200 bg-white p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-5 w-40" />
                            <div className="grid grid-cols-2 gap-4">
                              <Skeleton className="h-14 w-full" />
                              <Skeleton className="h-14 w-full" />
                            </div>
                          </div>
                          <Skeleton className="h-14 w-24" />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card className="border-blue-200/60 bg-gradient-to-br from-blue-50 to-emerald-50 shadow-md">
                  <CardContent className="space-y-4 pt-6">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-10 w-40" />
                    <Skeleton className="h-12 w-full rounded-xl" />
                  </CardContent>
                </Card>

                <Card className="border-slate-200/60 bg-white/70 shadow-md backdrop-blur-sm">
                  <CardHeader>
                    <Skeleton className="h-5 w-36" />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="flex items-center gap-3">
                        <Skeleton className="h-5 w-5 rounded-full" />
                        <Skeleton className="h-4 w-28" />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* ---- Skeleton next steps ---- */}
            <Card className="border-slate-200/60 bg-white/70 shadow-md backdrop-blur-sm">
              <CardHeader>
                <Skeleton className="h-7 w-32" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex gap-3">
                      <Skeleton className="h-6 w-6 rounded-full" />
                      <Skeleton className="h-4 max-w-md flex-1" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    );
  }

  // =========================================================================
  // Render — loaded state
  // =========================================================================

  return (
    <main className="min-h-screen bg-transparent text-slate-900">
      <Header showNav={true} />

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <motion.div
          className="space-y-12"
          variants={containerVariants}
          initial="initial"
          animate="animate"
        >
          {/* =============================================================== */}
          {/* Summary stat cards                                              */}
          {/* =============================================================== */}
          <motion.div
            variants={fadeInUp}
            className="grid grid-cols-1 gap-6 md:grid-cols-3"
          >
            {[
              {
                label: recoveryLabel,
                value: data.savings,
                isAnimated: true,
                icon: TrendingDown,
                color: "green",
              },
              {
                label: "Issues Found",
                value: data.findings.length,
                isAnimated: false,
                icon: AlertCircle,
                color: "orange",
              },
              {
                label: "Confidence Score",
                value: confidenceScore,
                isAnimated: false,
                suffix: "%",
                icon: CheckCircle2,
                color: "blue",
              },
            ].map((stat, idx) => {
              const Icon = stat.icon;
              const colorClass = {
                green: "bg-emerald-50 text-emerald-600",
                orange: "bg-orange-50 text-orange-600",
                blue: "bg-blue-50 text-blue-600",
              }[stat.color];

              return (
                <motion.div key={idx} variants={fadeInUp}>
                  <Card
                    hover
                    className="border-slate-200/60 bg-white/70 p-6 shadow-md backdrop-blur-sm"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-3">
                        <p className="text-sm font-medium text-slate-500">
                          {stat.label}
                        </p>
                        <p className="text-3xl font-bold text-slate-900">
                          {stat.isAnimated ? (
                            <AnimatedNumber value={stat.value as number} />
                          ) : (
                            <>
                              {stat.value}
                              {stat.suffix || ""}
                            </>
                          )}
                        </p>
                      </div>
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white ${colorClass} shadow-sm`}
                      >
                        <Icon className="h-6 w-6" />
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>

          {/* =============================================================== */}
          {/* Main content grid — findings list + sidebar                     */}
          {/* =============================================================== */}
          <div className="grid gap-8 lg:grid-cols-3">
            {/* ---- Findings detail cards (left 2/3) ---------------------- */}
            <motion.div
              variants={fadeInUp}
              className="space-y-6 lg:col-span-2"
            >
              <Card className="overflow-hidden border-slate-200/60 bg-white/70 shadow-md backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {isBillAnalysis ? (
                      <FileText className="h-6 w-6 text-blue-500 drop-shadow-sm" />
                    ) : (
                      <ClipboardCheck className="h-6 w-6 text-blue-500 drop-shadow-sm" />
                    )}
                    {findingsTitle}
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-3">
                  {data.findings.map((item, idx) => (
                    <motion.div
                      key={idx}
                      variants={fadeInUp}
                      className="rounded-xl border border-slate-200 bg-white p-4 transition-all duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-100/50"
                    >
                      <div className="flex items-start justify-between gap-4">
                        {/* Item name + charge/rate comparison */}
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-slate-900">
                              {item.item}
                            </h3>
                            <Badge
                              variant="info"
                              size="sm"
                              className="border-blue-200 bg-blue-50 text-blue-700"
                            >
                              {(item.confidence * 100).toFixed(0)}% confidence
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-slate-500">{statsLabel}</p>
                              <p className="text-lg font-semibold text-slate-900">
                                <AnimatedNumber
                                  value={item.charged}
                                  duration={800}
                                />
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500">{rateLabel}</p>
                              <p className="text-lg font-semibold text-slate-900">
                                <AnimatedNumber
                                  value={item.expected_rate}
                                  duration={800}
                                />
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Difference (overcharge / underpaid) */}
                        <div className="space-y-1 text-right">
                          <div
                            className={`flex items-center justify-end gap-1 text-lg font-bold ${diffIconColor}`}
                          >
                            <TrendingDown className="h-5 w-5" />
                            <AnimatedNumber
                              value={item.difference}
                              duration={1000}
                            />
                          </div>
                          <p
                            className={`text-xs font-medium ${diffColor}`}
                          >
                            {diffLabel}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>

            {/* ---- Right sidebar — report generation + status ------------- */}
            <motion.div variants={fadeInUp} className="space-y-6">
              {/* Report generation card */}
              <Card className="border-blue-200/60 bg-gradient-to-br from-blue-50 to-emerald-50 shadow-md">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div>
                      <p className="mb-1 text-sm font-medium text-slate-500">
                        {recoveryLabel}
                      </p>
                      <p className="text-4xl font-bold text-transparent bg-gradient-to-r from-[#4f7df3] via-[#4fc3a1] to-[#56c271] bg-clip-text">
                        <AnimatedNumber
                          value={data.savings}
                          duration={2000}
                        />
                      </p>
                    </div>

                    {!reportReady ? (
                      /* ---- Generate button (not yet generated) ---- */
                      <Button
                        onClick={handleGenerateReport}
                        disabled={isGenerating}
                        isLoading={isGenerating}
                        fullWidth
                        size="lg"
                        className="bg-gradient-to-r from-[#4f7df3] via-[#4fc3a1] to-[#56c271] font-semibold text-white shadow-md transition-all duration-300 hover:shadow-lg hover:shadow-blue-300/30"
                        icon={!isGenerating && <Scale className="h-5 w-5" />}
                      >
                        {isGenerating ? generatingLabel : generateLabel}
                      </Button>
                    ) : (
                      /* ---- Post-generation actions ---- */
                      <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="space-y-3"
                      >
                        <div className="flex items-center gap-2 font-medium text-emerald-600">
                          <CheckCircle2 className="h-5 w-5" />
                          {readyLabel}
                        </div>

                        {/* Download PDF button */}
                        <a
                          href={reportLink || "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="block"
                        >
                          <Button
                            fullWidth
                            size="lg"
                            className="bg-gradient-to-r from-[#4f7df3] via-[#4fc3a1] to-[#56c271] font-semibold text-white shadow-md transition-all duration-300 hover:shadow-lg hover:shadow-blue-300/30"
                            icon={<Download className="h-5 w-5" />}
                          >
                            Download PDF
                          </Button>
                        </a>

                        {/* Share button */}
                        <Button
                          variant="outline"
                          fullWidth
                          size="md"
                          className="border-slate-200 transition-all duration-300 hover:border-blue-300 hover:bg-blue-50/50"
                          icon={<Send className="h-4 w-4" />}
                        >
                          {shareLabel}
                        </Button>
                      </motion.div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Processing status card */}
              <Card className="border-slate-200/60 bg-white/70 shadow-md backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Zap className="h-5 w-5 text-blue-500 drop-shadow-sm" />
                    Processing Status
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-3">
                  {processSteps.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      {step.complete ? (
                        <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-500 drop-shadow-sm" />
                      ) : (
                        <div className="h-5 w-5 flex-shrink-0 rounded-full border-2 border-slate-300" />
                      )}
                      <span
                        className={`text-sm ${
                          step.complete ? "text-slate-900" : "text-slate-500"
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* =============================================================== */}
          {/* Next steps section                                              */}
          {/* =============================================================== */}
          <motion.div variants={fadeInUp}>
            <Card className="border-slate-200/60 bg-white/70 shadow-md backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Next Steps</CardTitle>
              </CardHeader>

              <CardContent>
                <ol className="space-y-3">
                  {nextSteps.map((step, idx) => (
                    <li key={idx} className="flex gap-3">
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-blue-200 bg-gradient-to-br from-blue-50 to-emerald-50 text-sm font-semibold text-blue-700 shadow-sm">
                        {idx + 1}
                      </span>
                      <span className="text-slate-600">{step}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </main>
  );
}