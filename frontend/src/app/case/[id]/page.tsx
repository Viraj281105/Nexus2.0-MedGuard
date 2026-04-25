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

// NOTE: viewport cannot be exported from a "use client" component.
// It has been moved to app/layout.tsx as a shared export instead.
// Exporting it here caused: TypeError: Cannot read properties of undefined (reading '$$typeof')

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AGENTS = [
  "auditor",
  "clinician",
  "regulatory",
  "barrister",
  "judge",
] as const;

type AgentName = (typeof AGENTS)[number];
type AgentState = "pending" | "running" | "done" | "error";

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

const SCORE_THRESHOLD_HIGH = 80;
const SCORE_THRESHOLD_MEDIUM = 50;

// ---------------------------------------------------------------------------
// Pure helper functions
// ---------------------------------------------------------------------------

const initialAgentStates = (): Record<AgentName, AgentState> =>
  Object.fromEntries(AGENTS.map((agent) => [agent, "pending"])) as Record<
    AgentName,
    AgentState
  >;

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
      return <div className="h-5 w-5 rounded-full border-2 border-slate-300" />;
  }
};

const scoreColourClass = (score: number): string => {
  if (score >= SCORE_THRESHOLD_HIGH) return "text-emerald-600";
  if (score >= SCORE_THRESHOLD_MEDIUM) return "text-blue-600";
  return "text-amber-600";
};

// ===========================================================================
// CasePage Component
// ===========================================================================

export default function CasePage() {
  const params = useParams();
  const sessionId = params.id as string;

  const [agentStates, setAgentStates] = useState<Record<AgentName, AgentState>>(
    initialAgentStates
  );
  const [streamChunks, setStreamChunks] = useState<string[]>([]);
  const [pipelineDone, setPipelineDone] = useState(false);
  const [error, setError] = useState("");
  const [judgeScore, setJudgeScore] = useState<number | null>(null);

  const streamRef = useRef<EventSource | null>(null);
  const letterRef = useRef<HTMLDivElement>(null);

  const isProcessing = useMemo(
    () => Object.values(agentStates).some((state) => state === "running"),
    [agentStates]
  );

  const formattedLetter = useMemo(
    () => streamChunks.join(""),
    [streamChunks]
  );

  const scoreColour = useMemo(
    () => (judgeScore !== null ? scoreColourClass(judgeScore) : ""),
    [judgeScore]
  );

  const handleSseMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case "agent_start":
          setAgentStates((prev) => ({ ...prev, [data.agent]: "running" }));
          break;

        case "agent_done":
          setAgentStates((prev) => ({ ...prev, [data.agent]: "done" }));
          if (data.agent === "judge" && data.output?.score !== undefined) {
            setJudgeScore(data.output.score);
          }
          break;

        case "agent_error":
          setAgentStates((prev) => ({ ...prev, [data.agent]: "error" }));
          setError(`${data.agent}: ${data.message}`);
          break;

        case "agent_stream":
          if (data.agent === "barrister") {
            setStreamChunks((prev) => [...prev, data.chunk]);
            requestAnimationFrame(() => {
              letterRef.current?.scrollTo({
                top: letterRef.current.scrollHeight,
                behavior: "smooth",
              });
            });
          }
          break;

        case "pipeline_done":
        case "close":
          setPipelineDone(true);
          streamRef.current?.close();
          break;

        case "error":
          setError(data.message);
          streamRef.current?.close();
          break;

        default:
          break;
      }
    } catch {
      // Ignore malformed SSE chunks
    }
  }, []);

  useEffect(() => {
    const eventSource = new EventSource(
      apiUrl(`/api/case/${sessionId}/stream`)
    );
    streamRef.current = eventSource;
    eventSource.onmessage = handleSseMessage;

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
          // Silently ignore fallback poll error
        }
      }, 1_000);
    };

    return () => {
      eventSource.close();
    };
  }, [sessionId, handleSseMessage]);

  return (
    <main className="min-h-screen bg-transparent text-slate-900">
      <Header showNav={false} />

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
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

          <div className="grid gap-8 lg:grid-cols-3">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
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
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5">{statusIcon(state)}</div>
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
                          {!isLast && (
                            <div className="ml-2.5 h-2 w-0.5 bg-slate-200" />
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </CardContent>
              </Card>

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

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="lg:col-span-2"
            >
              <Card className="h-full border-slate-200/60 bg-white/70 shadow-md backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Analysis Report</CardTitle>

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
                  <div
                    ref={letterRef}
                    className="h-[500px] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap text-slate-700 shadow-inner"
                  >
                    {formattedLetter.length > 0 ? (
                      <>{formattedLetter}</>
                    ) : (
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