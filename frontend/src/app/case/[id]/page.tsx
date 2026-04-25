"use client";
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ShieldCheck, CheckCircle, Loader2, AlertCircle, Download, ArrowLeft, ArrowRight } from "lucide-react";
import { apiUrl } from "@/lib/api";

const AGENTS = ["auditor", "clinician", "regulatory", "barrister", "judge"] as const;
type AgentName = typeof AGENTS[number];
type AgentState = "pending" | "running" | "done" | "error";

const AGENT_META: Record<AgentName, { icon: string; label: string; desc: string }> = {
  auditor:    { icon: "🔍", label: "Auditor Agent",    desc: "Parsing denial letter & policy..." },
  clinician:  { icon: "🩺", label: "Clinician Agent",  desc: "Retrieving clinical evidence..." },
  regulatory: { icon: "⚖️",  label: "Regulatory Agent", desc: "Searching legal statutes..." },
  barrister:  { icon: "📜", label: "Barrister Agent",  desc: "Drafting appeal letter..." },
  judge:      { icon: "🏛️",  label: "Judge Agent",     desc: "QA scoring the appeal..." },
};

export default function CasePage() {
  const params = useParams();
  const sessionId = params.id as string;
  const [agentStates, setAgentStates] = useState<Record<AgentName, AgentState>>(
    Object.fromEntries(AGENTS.map(a => [a, "pending"])) as Record<AgentName, AgentState>
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
          setAgentStates(prev => ({ ...prev, [data.agent]: "running" }));
        }
        if (data.type === "agent_done") {
          setAgentStates(prev => ({ ...prev, [data.agent]: "done" }));
          if (data.agent === "judge" && data.output?.score) {
            setJudgeScore(data.output.score);
          }
        }
        if (data.type === "agent_error") {
          setAgentStates(prev => ({ ...prev, [data.agent]: "error" }));
          setError(`${data.agent}: ${data.message}`);
        }
        if (data.type === "agent_stream" && data.agent === "barrister") {
          setStreamChunks(prev => [...prev, data.chunk]);
          if (letterRef.current) letterRef.current.scrollTop = letterRef.current.scrollHeight;
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
      // SSE connection closed — check status via polling
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

    return () => { eventSource.close(); };
  }, [sessionId]);

  const getIcon = (state: AgentState) => {
    if (state === "done") return <CheckCircle size={18} className="text-emerald-400" />;
    if (state === "running") return <Loader2 size={18} className="text-blue-400 animate-spin" />;
    if (state === "error") return <AlertCircle size={18} className="text-red-400" />;
    return <div className="w-[18px] h-[18px] rounded-full border-2 border-slate-600" />;
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-8 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[var(--color-primary)] opacity-20 blur-[120px]" />

      <header className="w-full max-w-5xl flex justify-between items-center py-6 z-10 border-b border-white/10 mb-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="p-2 bg-[var(--color-primary)] rounded-lg text-white"><ShieldCheck size={24} /></div>
          <span className="text-xl font-bold">MedGuard <span className="text-[var(--color-primary)]">AI</span></span>
        </Link>
        <span className="text-sm text-slate-400 font-mono">{sessionId}</span>
      </header>

      <main className="w-full max-w-5xl z-10 flex flex-col lg:flex-row gap-8">
        {/* Agent Pipeline */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="w-full lg:w-[380px]">
          <div className="glass-panel rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-1">Agent Pipeline</h2>
            <p className="text-slate-400 text-sm mb-6">5-agent autonomous appeal system</p>
            
            <div className="space-y-1">
              {AGENTS.map((agent, i) => {
                const meta = AGENT_META[agent];
                const state = agentStates[agent];
                return (
                  <div key={agent}>
                    <div className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                      state === "running" ? "bg-blue-500/10 border border-blue-500/20" :
                      state === "done" ? "bg-emerald-500/5 border border-emerald-500/10" :
                      state === "error" ? "bg-red-500/10 border border-red-500/20" :
                      "bg-white/5 border border-transparent"
                    }`}>
                      <span className="text-xl">{meta.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{meta.label}</p>
                        <p className="text-xs text-slate-400 truncate">
                          {state === "running" ? meta.desc : state === "done" ? "Complete" : state === "error" ? "Failed" : "Waiting..."}
                        </p>
                      </div>
                      {getIcon(state)}
                    </div>
                    {i < AGENTS.length - 1 && <div className="w-0.5 h-3 bg-white/10 ml-7" />}
                  </div>
                );
              })}
            </div>

            {judgeScore !== null && (
              <div className="mt-6 p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                <p className="text-sm text-slate-400 mb-1">Appeal Score</p>
                <p className={`text-4xl font-extrabold ${judgeScore >= 80 ? "text-emerald-400" : judgeScore >= 50 ? "text-amber-400" : "text-red-400"}`}>
                  {judgeScore}/100
                </p>
              </div>
            )}

            {error && <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}
          </div>
        </motion.div>

        {/* Live Output */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex-1">
          <div className="glass-panel rounded-2xl p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Live Appeal Draft</h2>
              {pipelineDone && (
                <a href={apiUrl(`/api/case/${sessionId}/download`)} target="_blank" rel="noreferrer"
                   className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-dark)] transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                  <Download size={16} /> Download PDF
                </a>
              )}
            </div>

            <div ref={letterRef} className="flex-1 min-h-[400px] max-h-[600px] overflow-y-auto p-4 rounded-xl bg-black/20 border border-white/5 font-mono text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
              {streamChunks.length > 0
                ? streamChunks.join("")
                : (
                  <div className="flex items-center justify-center h-full text-slate-500">
                    {Object.values(agentStates).some(s => s === "running")
                      ? <><Loader2 size={20} className="animate-spin mr-2" /> Agents processing...</>
                      : pipelineDone ? "Appeal letter will appear here." : "Waiting for pipeline to start..."}
                  </div>
                )
              }
            </div>
          </div>
        </motion.div>
      </main>

      {/* Bottom actions */}
      {pipelineDone && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-5xl z-10 mt-8 flex justify-between">
          <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"><ArrowLeft size={16} /> Back to Home</Link>
          <Link href="/submit" className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-medium border border-white/10 transition-all">Submit Another Case <ArrowRight size={16} /></Link>
        </motion.div>
      )}
    </div>
  );
}

