"use client";

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
import { Header } from "@/components/Header";
import { Button } from "@/components/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { addToast } from "@/lib/toast";

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
};

const containerVariants = {
  animate: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

interface HistoryEntry {
  id: string;
  type: "bill" | "insurance";
  patientName: string;
  insurerName: string;
  procedureOrIssue: string;
  date: string;
  savings: number;
  findingsCount: number;
  confidence: number;
  createdAt: string;
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("medguard_history");
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {}
      }
    }
    return [];
  });

  const clearHistory = () => {
    localStorage.removeItem("medguard_history");
    setHistory([]);
    addToast("History cleared", "info");
  };

  const removeEntry = (id: string) => {
    const updated = history.filter((entry) => entry.id !== id);
    setHistory(updated);
    localStorage.setItem("medguard_history", JSON.stringify(updated));
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <main className="min-h-screen bg-transparent text-slate-900">
      <Header showNav={false} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          className="space-y-8"
          variants={containerVariants}
          initial="initial"
          animate="animate"
        >
          {/* Header */}
          <motion.div variants={fadeInUp} className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="flex items-center gap-2 text-slate-500 transition-all duration-200 hover:-translate-y-0.5 hover:text-blue-600"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Link>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Recent Analyses
              </h1>
            </div>
            {history.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearHistory}
                icon={<Trash2 className="w-4 h-4" />}
                className="text-slate-500 hover:text-red-600 transition-colors"
              >
                Clear All
              </Button>
            )}
          </motion.div>

          {/* History List */}
          {history.length === 0 ? (
            <motion.div variants={fadeInUp}>
              <Card className="p-12 text-center bg-white/50 backdrop-blur-sm border-slate-200/60">
                <div className="space-y-4">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-emerald-100 border border-blue-200">
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
                  <Link href="/">
                    <Button
                      size="md"
                      className="bg-gradient-to-r from-[#4f7df3] via-[#4fc3a1] to-[#56c271] text-white shadow-md hover:shadow-lg hover:shadow-blue-300/30 transition-all duration-300 font-semibold"
                    >
                      Start Your First Analysis
                    </Button>
                  </Link>
                </div>
              </Card>
            </motion.div>
          ) : (
            <motion.div variants={fadeInUp} className="space-y-4">
              {history.map((entry) => (
                <motion.div key={entry.id} variants={fadeInUp}>
                  <Card
                    hover
                    className="p-6 bg-white/50 backdrop-blur-sm border-slate-200/60 transition-all duration-300 hover:shadow-xl hover:shadow-blue-100/50"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${
                          entry.type === "bill"
                            ? "bg-gradient-to-br from-blue-100 to-blue-200"
                            : "bg-gradient-to-br from-emerald-100 to-green-200"
                        }`}>
                          {entry.type === "bill" ? (
                            <FileText className="w-5 h-5 text-blue-600" />
                          ) : (
                            <ClipboardCheck className="w-5 h-5 text-emerald-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-slate-900 truncate">
                              {entry.patientName || "Unknown Patient"}
                            </h3>
                            <Badge
                              variant={entry.type === "bill" ? "info" : "success"}
                              size="sm"
                            >
                              {entry.type === "bill" ? "Medical Bill" : "Insurance Claim"}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm text-slate-500 truncate">
                            {entry.insurerName} · {entry.procedureOrIssue}
                          </p>
                          <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {formatDate(entry.createdAt)}
                            </span>
                            <span className="flex items-center gap-1">
                              <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />
                              <span className="font-semibold text-emerald-600">
                                ₹{entry.savings.toLocaleString()}
                              </span>
                            </span>
                            <span>
                              {entry.findingsCount} finding{entry.findingsCount !== 1 ? "s" : ""}
                            </span>
                            <span>
                              {entry.confidence}% confidence
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Link href={`/results`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<ExternalLink className="w-4 h-4" />}
                            className="text-slate-500 hover:text-blue-600"
                          >
                            View
                          </Button>
                        </Link>
                        <button
                            onClick={() => removeEntry(entry.id)}
                            aria-label={`Delete ${entry.type === "bill" ? "bill" : "claim"} analysis for ${entry.patientName || "Unknown Patient"}`}
                            className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            >
                            <Trash2 className="w-4 h-4" />
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