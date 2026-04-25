"use client";

// ---------------------------------------------------------------------------
// External dependencies
// ---------------------------------------------------------------------------
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Loader2,
  AlertCircle,
  Download,
  ArrowLeft,
  Plus,
  Zap,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Internal modules
// ---------------------------------------------------------------------------
import { Header } from "@/components/Header";
import { Button } from "@/components/Button";
import { apiUrl } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Card";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Ordered list of agent identifiers that form the processing pipeline.
 * Each agent executes sequentially and streams its progress to the frontend
 * via Server-Sent Events (SSE).
 */
const AGENTS = [
  "auditor",
  "clinician",
  "regulatory",
  "barrister",
  "judge",
] as const;

/** Union type representing a single agent from the pipeline. */
type AgentName = (typeof AGENTS)[number];

/**
 * Possible lifecycle states for a single agent during pipeline execution.
 *
 * - `pending`  — Not yet started
 * - `running`  — Currently executing
 * - `done`     — Completed successfully
 * - `error`    — Terminated with an error
 */
type AgentState = "pending" | "running" | "done" | "error";

/**
 * Human-readable metadata displayed in the pipeline sidebar for each agent.
 * Each entry maps an agent identifier to its icon, display label, and a
 * description shown while the agent is actively running.
 */
const AGENT_META: Record<
  AgentName,
  { icon: React.ReactNode; label: string; desc: string }
> = {
  auditor: {
    icon: "🔍",
    label: "Document Auditor",
    desc: "Parsing document & policy...",
  },
  clinician: {
    icon: "🩺",
    label: "Clinical Reviewer",
    desc: "Verifying medical necessity...",
  },
  regulatory: {
    icon: "⚖️",
    label: "Regulatory Advisor",
    desc: "Analyzing regulations & precedents...",
  },
  barrister: {
    icon: "📜",
    label: "Appeal Drafter",
    desc: "Composing persuasive letter...",
  },
  judge: {
    icon: "🏛️",
    label: "Quality Reviewer",
    desc: "Scoring appeal strength...",
  },
};

/**
 * Thresholds used to colour the final quality score badge.
 *
 * - >= 80  → Green  (strong appeal)
 * - >= 50  → Blue   (adequate appeal)
 * - < 50   → Amber  (needs improvement)
 */
const SCORE_THRESHOLD_HIGH = 80;
const SCORE_THRESHOLD_MEDIUM = 50;

// ---------------------------------------------------------------------------
// Pure helper functions (defined outside component to avoid re-creation)
// ---------------------------------------------------------------------------

/**
 * Create a record of initial agent states where every agent starts as "pending".
 * Extracted so the intent is explicit at the call-site.
 */
const initialAgentStates = (): Record<AgentName, AgentState> =>
  Object.fromEntries(AGENTS.map((agent) => [agent, "pending"])) as Record<
    AgentName,
    AgentState
  >;

/**
 * Map an agent lifecycle state to its corresponding status icon.
 * Pure function — safe to call directly inside JSX without memoisation.
 */
const statusIcon = (state: AgentState): React.ReactNode => {
  switch (state) {
    case "done":
      return (
        <CheckCircle2 className="h-5 w-5 text-emerald-500 drop-shadow-sm" />
      );
    case "running":
      return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
    case "error":
      return <AlertCircle className="h-5 w-5 text-red-500" />;
    default:
      // "pending" or any unrecognised state — empty circle placeholder
      return <div className="h-5 w-5 rounded-full border-2 border-slate-300" />;
  }
};

/**
 * Derive a Tailwind CSS text colour class based on the numeric quality score.
 */
const scoreColourClass = (score: number): string => {
  if (score >= SCORE_THRESHOLD_HIGH) return "text-emerald-600";
  if (score >= SCORE_THRESHOLD_MEDIUM) return "text-blue-600";
  return "text-amber-600";
};

// ===========================================================================
// CasePage Component
// ===========================================================================

export default function CasePage() {
  // -------------------------------------------------------------------------
  // Routing
  // -------------------------------------------------------------------------

  const params = useParams();
  const sessionId = params.id as string;

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  /** Tracks the current lifecycle state of each agent in the pipeline. */
  const [agentStates, setAgentStates] = useState<Record<AgentName, AgentState>>(
    initialAgentStates
  );

  /**
   * Accumulates text chunks streamed from the Barrister agent.
   * Each chunk is appended as it arrives; the array is joined for display.
   */
  const [streamChunks, setStreamChunks] = useState<string[]>([]);

  /** Becomes `true` once the SSE stream signals pipeline completion. */
  const [pipelineDone, setPipelineDone] = useState(false);

  /** Holds a human-readable error message if any agent fails. */
  const [error, setError] = useState("");

  /** Final quality score assigned by the Judge agent (0–100). */
  const [judgeScore, setJudgeScore] = useState<number | null>(null);

  // -------------------------------------------------------------------------
  // Refs
  // -------------------------------------------------------------------------

  /** Reference to the active SSE connection so we can close it on unmount. */
  const streamRef = useRef<EventSource | null>(null);

  /** Reference to the scrollable letter container for auto-scrolling. */
  const letterRef = useRef<HTMLDivElement>(null);

  // -------------------------------------------------------------------------
  // Derived values (memoised to avoid unnecessary re-renders)
  // -------------------------------------------------------------------------

  /** `true` while at least one agent is still in the "running" state. */
  const isProcessing = useMemo(
    () => Object.values(agentStates).some((state) => state === "running"),
    [agentStates]
  );

  /** The complete appeal letter assembled from all streamed chunks. */
  const formattedLetter = useMemo(
    () => streamChunks.join(""),
    [streamChunks]
  );

  /** CSS class string for colouring the score display. */
  const scoreColour = useMemo(
    () => (judgeScore !== null ? scoreColourClass(judgeScore) : ""),
    [judgeScore]
  );

  // -------------------------------------------------------------------------
  // SSE message handler (stable reference via useCallback)
  // -------------------------------------------------------------------------

  /**
   * Central handler for all incoming Server-Sent Events.
   *
   * Dispatches based on `data.type` to update agent states, accumulate
   * streamed letter chunks, handle errors, or finalise the pipeline.
   *
   * Wrapped in `useCallback` with an empty dependency array so the function
   * identity never changes, preventing unnecessary SSE re-connections.
   */
  const handleSseMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);

      switch (data.type) {
        // ---- Agent lifecycle events --------------------------------------
        case "agent_start":
          setAgentStates((prev) => ({ ...prev, [data.agent]: "running" }));
          break;

        case "agent_done":
          setAgentStates((prev) => ({ ...prev, [data.agent]: "done" }));
          // Capture the Judge's quality score when it finishes.
          if (data.agent === "judge" && data.output?.score !== undefined) {
            setJudgeScore(data.output.score);
          }
          break;

        case "agent_error":
          setAgentStates((prev) => ({ ...prev, [data.agent]: "error" }));
          setError(`${data.agent}: ${data.message}`);
          break;

        // ---- Streaming content from the Barrister agent ------------------
        case "agent_stream":
          if (data.agent === "barrister") {
            setStreamChunks((prev) => [...prev, data.chunk]);

            // Auto-scroll the letter container to show the latest content.
            // `requestAnimationFrame` ensures the DOM has painted the new
            // chunk before we try to scroll.
            requestAnimationFrame(() => {
              letterRef.current?.scrollTo({
                top: letterRef.current.scrollHeight,
                behavior: "smooth",
              });
            });
          }
          break;

        // ---- Pipeline completion events ----------------------------------
        case "pipeline_done":
        case "close":
          setPipelineDone(true);
          streamRef.current?.close();
          break;

        // ---- Global error (not tied to a specific agent) -----------------
        case "error":
          setError(data.message);
          streamRef.current?.close();
          break;

        default:
          // Silently ignore any unrecognised event types.
          break;
      }
    } catch {
      // Gracefully ignore malformed JSON events from the SSE stream.
      // These are typically incomplete chunks that can be safely discarded.
    }
  }, []);

  // -------------------------------------------------------------------------
  // SSE lifecycle — connect on mount, disconnect on unmount
  // -------------------------------------------------------------------------

  useEffect(() => {
    // Establish a persistent SSE connection to the backend pipeline.
    const eventSource = new EventSource(
      apiUrl(`/api/case/${sessionId}/stream`)
    );
    streamRef.current = eventSource;

    // Attach the stable message handler.
    eventSource.onmessage = handleSseMessage;

    /**
     * Fallback error handler for connection-level failures.
     *
     * When the SSE connection drops unexpectedly, we close it and poll the
     * status endpoint once after a short delay. This handles edge cases where
     * the pipeline finished but the final "close" event was lost in transit.
     */
    eventSource.onerror = () => {
      eventSource.close();

      setTimeout(async () => {
        try {
          const res = await fetch(apiUrl(`/api/case/${sessionId}/status`));
          if (res.ok) {
            const body = await res.json();
            if (body.status === "done") {
              setPipelineDone(true);
            }
          }
        } catch {
          // Silently ignore the fallback poll error — the UI already shows
          // whatever state we had before the connection dropped.
        }
      }, 1_000);
    };

    // Cleanup: close the SSE connection when the component unmounts or
    // the sessionId changes (which triggers a re-run of this effect).
    return () => {
      eventSource.close();
    };
  }, [sessionId, handleSseMessage]);

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <main className="min-h-screen bg-transparent text-slate-900">
      <Header showNav={false} />

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* =============================================================== */}
          {/* Top bar — back navigation & session identifier                  */}
          {/* =============================================================== */}
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 text-slate-500 transition-all duration-200 hover:-translate-y-0.5 hover:text-blue-600"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>

            <div className="text-right">
              <p className="text-sm text-slate-500">Case ID</p>
              <p className="font-mono font-semibold text-slate-900">
                {sessionId.slice(0, 12)}...
              </p>
            </div>
          </div>

          {/* =============================================================== */}
          {/* Main two-column layout                                          */}
          {/* Left: Pipeline sidebar  |  Right: Live report viewer            */}
          {/* =============================================================== */}
          <div className="grid gap-8 lg:grid-cols-3">
            {/* ------------------------------------------------------------- */}
            {/* LEFT SIDEBAR — Agent pipeline + Score + Errors                */}
            {/* ------------------------------------------------------------- */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              {/* ---- Agent pipeline card --------------------------------- */}
              <Card className="border-slate-200/60 bg-white/70 shadow-md backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-blue-600 drop-shadow-sm" />
                    Processing Pipeline
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                  {AGENTS.map((agent, idx) => {
                    const meta = AGENT_META[agent];
                    const state = agentStates[agent];
                    const isLast = idx === AGENTS.length - 1;

                    return (
                      <motion.div
                        key={agent}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                      >
                        <div className="space-y-2">
                          {/* Agent row: status icon + label + description */}
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5">
                              {statusIcon(state)}
                            </div>

                            <div className="min-w-0 flex-1">
                              <p
                                className={`text-sm font-medium ${
                                  state === "done" || state === "running"
                                    ? "text-slate-900"
                                    : "text-slate-700"
                                }`}
                              >
                                {meta.label}
                              </p>

                              <p className="mt-0.5 text-xs text-slate-500">
                                {state === "running"
                                  ? meta.desc
                                  : state === "done"
                                    ? "Complete"
                                    : state === "error"
                                      ? "Failed"
                                      : "Pending"}
                              </p>
                            </div>
                          </div>

                          {/* Vertical connector line between pipeline steps */}
                          {!isLast && (
                            <div className="ml-2.5 h-2 w-0.5 bg-slate-200" />
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* ---- Quality score card (conditional) --------------------- */}
              {judgeScore !== null && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <Card className="border-blue-200/60 bg-gradient-to-br from-blue-50 to-emerald-50 shadow-md">
                    <CardContent className="space-y-3 pt-6 text-center">
                      <p className="text-sm font-medium text-slate-500">
                        Analysis Quality Score
                      </p>

                      <p className={`text-4xl font-bold ${scoreColour}`}>
                        {judgeScore}/100
                      </p>

                      {/* Progress bar visualisation of the score */}
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#4f7df3] via-[#4fc3a1] to-[#56c271]"
                          style={{ width: `${judgeScore}%` }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* ---- Error card (conditional) ----------------------------- */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card className="border-red-200 bg-red-50 shadow-md">
                    <CardContent className="pt-6">
                      <div className="flex gap-3">
                        <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
                        <p className="text-sm text-red-700">{error}</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </motion.div>

            {/* ------------------------------------------------------------- */}
            {/* RIGHT PANEL — Live analysis report viewer                    */}
            {/* ------------------------------------------------------------- */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="lg:col-span-2"
            >
              <Card className="h-full border-slate-200/60 bg-white/70 shadow-md backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Analysis Report</CardTitle>

                  {/* Download button — only visible after pipeline completes */}
                  {pipelineDone && (
                    <a
                      href={apiUrl(`/api/case/${sessionId}/download`)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block"
                    >
                      <Button
                        size="sm"
                        icon={<Download className="h-4 w-4" />}
                        className="bg-gradient-to-r from-[#4f7df3] via-[#4fc3a1] to-[#56c271] font-semibold text-white shadow-md transition-all duration-300 hover:shadow-lg hover:shadow-blue-300/30"
                      >
                        Download PDF
                      </Button>
                    </a>
                  )}
                </CardHeader>

                <CardContent>
                  {/* Scrollable letter output area */}
                  <div
                    ref={letterRef}
                    className="h-[500px] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap text-slate-700 shadow-inner"
                  >
                    {formattedLetter.length > 0 ? (
                      /* Streamed content is available — render it */
                      <>{formattedLetter}</>
                    ) : (
                      /* Fallback: show contextual placeholder message */
                      <div className="flex h-full items-center justify-center text-slate-500">
                        {isProcessing ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin text-blue-500" />
                            Agents processing...
                          </>
                        ) : pipelineDone ? (
                          "Analysis report will appear here."
                        ) : (
                          "Waiting for pipeline to start..."
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* =============================================================== */}
          {/* Bottom action bar — visible only after pipeline completion     */}
          {/* =============================================================== */}
          {pipelineDone && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col justify-between gap-4 border-t border-slate-200 pt-6 sm:flex-row"
            >
              <Link href="/" className="inline-block">
                <Button
                  variant="ghost"
                  icon={<ArrowLeft className="h-4 w-4" />}
                  className="transition-all duration-300 hover:bg-slate-100"
                >
                  Back to Home
                </Button>
              </Link>

              <Link href="/submit" className="inline-block">
                <Button
                  icon={<Plus className="h-4 w-4" />}
                  className="bg-gradient-to-r from-[#4f7df3] via-[#4fc3a1] to-[#56c271] font-semibold text-white shadow-md transition-all duration-300 hover:shadow-lg hover:shadow-blue-300/30"
                >
                  Submit Another Case
                </Button>
              </Link>
            </motion.div>
          )}
        </motion.div>
      </div>
    </main>
  );
}