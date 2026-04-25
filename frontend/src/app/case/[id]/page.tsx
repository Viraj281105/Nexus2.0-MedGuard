"use client";

import { useEffect, useState, useRef } from "react";
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

import { Header } from "@/components/Header";
import { Button } from "@/components/Button";
import { apiUrl } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Card";

const AGENTS = ["auditor", "clinician", "regulatory", "barrister", "judge"] as const;
type AgentName = typeof AGENTS[number];
type AgentState = "pending" | "running" | "done" | "error";

const AGENT_META: Record<AgentName, { icon: React.ReactNode; label: string; desc: string }> = {
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

export default function CasePage() {
  const params = useParams();
  const sessionId = params.id as string;
  const [agentStates, setAgentStates] = useState<Record<AgentName, AgentState>>(
    Object.fromEntries(AGENTS.map((a) => [a, "pending"])) as Record<AgentName, AgentState>
  );
  const [streamChunks, setStreamChunks] = useState<string[]>([]);
  const [pipelineDone, setPipelineDone] = useState(false);
  const [error, setError] = useState("");
  const [judgeScore, setJudgeScore] = useState<number | null>(null);
  const streamRef = useRef<EventSource | null>(null);
  const letterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const eventSource = new EventSource(apiUrl(`/api/case/${sessionId}/stream`));
    streamRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "agent_start") {
          setAgentStates((prev) => ({ ...prev, [data.agent]: "running" }));
        }
        if (data.type === "agent_done") {
          setAgentStates((prev) => ({ ...prev, [data.agent]: "done" }));
          if (data.agent === "judge" && data.output?.score) {
            setJudgeScore(data.output.score);
          }
        }
        if (data.type === "agent_error") {
          setAgentStates((prev) => ({ ...prev, [data.agent]: "error" }));
          setError(`${data.agent}: ${data.message}`);
        }
        if (data.type === "agent_stream" && data.agent === "barrister") {
          setStreamChunks((prev) => [...prev, data.chunk]);
          if (letterRef.current)
            letterRef.current.scrollTop = letterRef.current.scrollHeight;
        }
        if (data.type === "pipeline_done" || data.type === "close") {
          setPipelineDone(true);
          eventSource.close();
        }
        if (data.type === "error") {
          setError(data.message);
          eventSource.close();
        }
      } catch {}
    };

    eventSource.onerror = () => {
      eventSource.close();
      setTimeout(async () => {
        try {
          const res = await fetch(apiUrl(`/api/case/${sessionId}/status`));
          if (res.ok) {
            const d = await res.json();
            if (d.status === "done") setPipelineDone(true);
          }
        } catch {}
      }, 1000);
    };

    return () => {
      eventSource.close();
    };
  }, [sessionId]);

  const getStatusIcon = (state: AgentState) => {
    if (state === "done") return <CheckCircle2 className="w-5 h-5 text-emerald-500 drop-shadow-sm" />;
    if (state === "running")
      return <Loader2 className="w-5 h-5 animate-spin text-blue-500" />;
    if (state === "error")
      return <AlertCircle className="w-5 h-5 text-red-500" />;
    return <div className="h-5 w-5 rounded-full border-2 border-slate-300" />;
  };

  const scoreColor =
    judgeScore && judgeScore >= 80
      ? "text-emerald-600"
      : judgeScore && judgeScore >= 50
        ? "text-blue-600"
        : "text-amber-600";

  return (
    <main className="min-h-screen bg-transparent text-slate-900">
      <Header showNav={false} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-slate-500 transition-all duration-200 hover:-translate-y-0.5 hover:text-blue-600">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
            <div className="text-right">
              <p className="text-sm text-slate-500">Case ID</p>
              <p className="font-mono font-semibold text-slate-900">
                {sessionId.slice(0, 12)}...
              </p>
            </div>
          </div>

          {/* Main Content */}
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Agent Pipeline - Left Sidebar */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <Card className="bg-white/70 backdrop-blur-sm border-slate-200/60 shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-blue-600 drop-shadow-sm" />
                    Processing Pipeline
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {AGENTS.map((agent, i) => {
                    const meta = AGENT_META[agent];
                    const state = agentStates[agent];
                    const isComplete = state === "done";
                    const isRunning = state === "running";
                    const isError = state === "error";

                    return (
                      <motion.div
                        key={agent}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                      >
                        <div className="space-y-2">
                          <div className="flex items-start gap-3">
                            <div
                              className={`mt-0.5 ${
                                isComplete
                                  ? "text-emerald-500"
                                  : isRunning
                                    ? "text-blue-500"
                                    : isError
                                      ? "text-red-500"
                                      : "text-slate-400"
                              }`}
                            >
                              {getStatusIcon(state)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`font-medium text-sm ${
                                isComplete || isRunning
                                  ? "text-slate-900"
                                  : "text-slate-700"
                              }`}>
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
                          {i < AGENTS.length - 1 && (
                            <div className="ml-2.5 h-2 w-0.5 bg-slate-200" />
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Score Card */}
              {judgeScore !== null && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <Card className="bg-gradient-to-br from-blue-50 to-emerald-50 border-blue-200/60 shadow-md">
                    <CardContent className="pt-6 text-center space-y-3">
                      <p className="text-sm font-medium text-slate-500">
                        Analysis Quality Score
                      </p>
                      <p className={`text-4xl font-bold ${scoreColor}`}>
                        {judgeScore}/100
                      </p>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r from-[#4f7df3] via-[#4fc3a1] to-[#56c271]`}
                          style={{ width: `${judgeScore}%` }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Error Card */}
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

            {/* Live Output - Main Content */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="lg:col-span-2"
            >
              <Card className="h-full bg-white/70 backdrop-blur-sm border-slate-200/60 shadow-md">
                <CardHeader className="flex items-center justify-between flex-row">
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
                        icon={<Download className="w-4 h-4" />}
                        className="bg-gradient-to-r from-[#4f7df3] via-[#4fc3a1] to-[#56c271] text-white shadow-md hover:shadow-lg hover:shadow-blue-300/30 transition-all duration-300 font-semibold"
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
                    {streamChunks.length > 0 ? (
                      <>{streamChunks.join("")}</>
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-500">
                        {Object.values(agentStates).some((s) => s === "running") ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin mr-2 text-blue-500" />
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

          {/* Bottom Actions */}
          {pipelineDone && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col justify-between gap-4 border-t border-slate-200 pt-6 sm:flex-row"
            >
              <Link href="/" className="inline-block">
                <Button variant="ghost" icon={<ArrowLeft className="w-4 h-4" />} className="hover:bg-slate-100 transition-all duration-300">
                  Back to Home
                </Button>
              </Link>
              <Link href="/submit" className="inline-block">
                <Button icon={<Plus className="w-4 h-4" />} className="bg-gradient-to-r from-[#4f7df3] via-[#4fc3a1] to-[#56c271] text-white shadow-md hover:shadow-lg hover:shadow-blue-300/30 transition-all duration-300 font-semibold">
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