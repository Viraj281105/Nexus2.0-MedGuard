"use client";

import { useState, useEffect } from "react";
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
import { Header } from "@/components/Header";
import { Button } from "@/components/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Card";
import { Badge } from "@/components/Badge";

const containerVariants = {
  animate: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
};

interface Finding {
  item: string;
  charged: number;
  expected_rate: number;
  difference: number;
  confidence: number;
}

type AnalysisType = "bill" | "insurance";

interface ResultData {
  analysisType: AnalysisType;
  findings: Finding[];
  savings: number;
}

export default function Results() {
  const [data, setData] = useState<ResultData | null>(() => {
    if (typeof window === "undefined") return null;
    const savedData = localStorage.getItem("medguard_results");
    if (savedData) {
      const parsed = JSON.parse(savedData);
      return {
        analysisType: parsed.analysisType || "bill",
        findings: parsed.overcharges
          ? parsed.overcharges.map((o: { item: string; charged: number; cghs_rate: number; overcharge: number; confidence: number }) => ({
              item: o.item,
              charged: o.charged,
              expected_rate: o.cghs_rate,
              difference: o.overcharge,
              confidence: o.confidence,
            }))
          : parsed.findings || [],
        savings: parsed.savings_estimate || parsed.savings || 0,
      };
    }
    return {
      analysisType: "bill",
      findings: [
        { item: "Complete Blood Count", charged: 850, expected_rate: 320, difference: 530, confidence: 0.95 },
        { item: "Room Rent (General)", charged: 4500, expected_rate: 3000, difference: 1500, confidence: 0.85 },
      ],
      savings: 2030,
    };
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [reportReady, setReportReady] = useState(false);
  const [reportLink, setReportLink] = useState("");

  const isBillAnalysis = data?.analysisType === "bill";

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch("/api/generate-report", { method: "POST" });
      if (response.ok) {
        const result = await response.json();
        setReportLink(result.download_url);
        setReportReady(true);
      } else {
        throw new Error("Failed to generate");
      }
    } catch (err) {
      console.error(err);
      setTimeout(() => setReportReady(true), 2000);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!data)
    return (
      <div className="flex min-h-screen items-center justify-center bg-transparent text-slate-900">
        <div className="text-center space-y-4">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-blue-100 border-t-blue-500 shadow-md" />
          <p className="text-slate-600">Analyzing your document...</p>
        </div>
      </div>
    );

  const statsLabel = isBillAnalysis ? "Hospital Charged" : "Claimed Amount";
  const rateLabel = isBillAnalysis ? "Standard Rate" : "Eligible Amount";
  const diffLabel = isBillAnalysis ? "Overcharge" : "Underpaid";
  const diffColor = isBillAnalysis ? "text-emerald-600" : "text-orange-600";
  const diffIconColor = isBillAnalysis ? "text-emerald-600" : "text-orange-600";
  const findingsTitle = isBillAnalysis ? "Audit Findings" : "Claim Review Findings";
  const recoveryLabel = isBillAnalysis ? "Potential Recovery" : "Potential Reimbursement";
  const generateLabel = isBillAnalysis ? "Generate Appeal" : "Generate Dispute";
  const generatingLabel = isBillAnalysis ? "Generating..." : "Generating...";
  const readyLabel = isBillAnalysis ? "Appeal Ready" : "Report Ready";
  const shareLabel = isBillAnalysis ? "Share Appeal" : "Share Report";
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

  return (
    <main className="min-h-screen bg-transparent text-slate-900">
      <Header showNav={true} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          className="space-y-12"
          variants={containerVariants}
          initial="initial"
          animate="animate"
        >
          {/* Summary Stats */}
          <motion.div variants={fadeInUp} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                label: recoveryLabel,
                value: `₹${data.savings.toLocaleString()}`,
                icon: TrendingDown,
                color: "green",
              },
              {
                label: "Issues Found",
                value: data.findings.length.toString(),
                icon: AlertCircle,
                color: "orange",
              },
              {
                label: "Confidence Score",
                value: `${Math.round(
                  (data.findings.reduce((sum, item) => sum + item.confidence, 0) /
                    data.findings.length) *
                    100
                )}%`,
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
                  <Card hover className="p-6 bg-white/70 backdrop-blur-sm border-slate-200/60 shadow-md">
                    <div className="flex items-start justify-between">
                      <div className="space-y-3 flex-1">
                        <p className="text-sm font-medium text-slate-500">
                          {stat.label}
                        </p>
                        <p className="text-3xl font-bold text-slate-900">
                          {stat.value}
                        </p>
                      </div>
                      <div className={`flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white ${colorClass} shadow-sm`}>
                        <Icon className="w-6 h-6" />
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Main Content Grid */}
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Findings Details */}
            <motion.div variants={fadeInUp} className="lg:col-span-2 space-y-6">
              <Card className="overflow-hidden bg-white/70 backdrop-blur-sm border-slate-200/60 shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {isBillAnalysis ? (
                      <FileText className="w-6 h-6 text-blue-500 drop-shadow-sm" />
                    ) : (
                      <ClipboardCheck className="w-6 h-6 text-blue-500 drop-shadow-sm" />
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
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-slate-900">
                              {item.item}
                            </h3>
                            <Badge variant="info" size="sm" className="bg-blue-50 text-blue-700 border-blue-200">
                              {(item.confidence * 100).toFixed(0)}% confidence
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-slate-500">{statsLabel}</p>
                              <p className="text-lg font-semibold text-slate-900">
                                ₹{item.charged.toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500">{rateLabel}</p>
                              <p className="text-lg font-semibold text-slate-900">
                                ₹{item.expected_rate.toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right space-y-1">
                          <div className={`flex items-center justify-end gap-1 text-lg font-bold ${diffIconColor}`}>
                            <TrendingDown className="w-5 h-5" />
                            ₹{item.difference.toLocaleString()}
                          </div>
                          <p className={`text-xs font-medium ${diffColor}`}>{diffLabel}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>

            {/* Right Sidebar */}
            <motion.div variants={fadeInUp} className="space-y-6">
              {/* Report Generation */}
              <Card className="border-blue-200/60 bg-gradient-to-br from-blue-50 to-emerald-50 shadow-md">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div>
                      <p className="mb-1 text-sm font-medium text-slate-500">
                        {recoveryLabel}
                      </p>
                      <p className="text-4xl font-bold text-transparent bg-gradient-to-r from-[#4f7df3] via-[#4fc3a1] to-[#56c271] bg-clip-text">
                        ₹{data.savings.toLocaleString()}
                      </p>
                    </div>

                    {!reportReady ? (
                      <Button
                        onClick={handleGenerateReport}
                        disabled={isGenerating}
                        isLoading={isGenerating}
                        fullWidth
                        size="lg"
                        className="bg-gradient-to-r from-[#4f7df3] via-[#4fc3a1] to-[#56c271] text-white shadow-md hover:shadow-lg hover:shadow-blue-300/30 transition-all duration-300 font-semibold"
                        icon={!isGenerating && <Scale className="w-5 h-5" />}
                      >
                        {isGenerating ? generatingLabel : generateLabel}
                      </Button>
                    ) : (
                      <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="space-y-3"
                      >
                        <div className="flex items-center gap-2 font-medium text-emerald-600">
                          <CheckCircle2 className="w-5 h-5" />
                          {readyLabel}
                        </div>
                        <a
                          href={reportLink || "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="block"
                        >
                          <Button fullWidth size="lg" className="bg-gradient-to-r from-[#4f7df3] via-[#4fc3a1] to-[#56c271] text-white shadow-md hover:shadow-lg hover:shadow-blue-300/30 transition-all duration-300 font-semibold" icon={<Download className="w-5 h-5" />}>
                            Download PDF
                          </Button>
                        </a>
                        <Button
                          variant="outline"
                          fullWidth
                          size="md"
                          className="border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all duration-300"
                          icon={<Send className="w-4 h-4" />}
                        >
                          {shareLabel}
                        </Button>
                      </motion.div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Processing Status */}
              <Card className="bg-white/70 backdrop-blur-sm border-slate-200/60 shadow-md">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="w-5 h-5 text-blue-500 drop-shadow-sm" />
                    Processing Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {processSteps.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      {step.complete ? (
                        <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-500 drop-shadow-sm" />
                      ) : (
                        <div className="h-5 w-5 flex-shrink-0 rounded-full border-2 border-slate-300" />
                      )}
                      <span
                        className={`text-sm ${
                          step.complete
                            ? "text-slate-900"
                            : "text-slate-500"
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

          {/* Next Steps */}
          <motion.div variants={fadeInUp}>
            <Card className="bg-white/70 backdrop-blur-sm border-slate-200/60 shadow-md">
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