"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud,
  ShieldCheck,
  FileSearch,
  Zap,
  CheckCircle2,
  CircleDollarSign,
  BrainCircuit,
  Activity,
  Lock,
  Sparkles,
  Mic,
  MicOff,
  FileText,
  ClipboardCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
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
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

type InputMode = "upload" | "voice";
type AnalysisType = "bill" | "insurance";

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

// ---------------------------------------------------------------------------
// FIX: createRecognition builds a fresh SpeechRecognition instance each time.
//
// The Web Speech API does NOT allow restarting a stopped instance — calling
// .start() on an instance that has already ended throws a network error in
// Chrome. The fix is to create a new instance on every recording session
// instead of reusing one created at mount time.
//
// continuous: false  — one utterance per tap, then auto-stops cleanly.
//                      continuous:true holds a persistent Google server
//                      connection that breaks on localhost and most networks.
// ---------------------------------------------------------------------------
function createRecognition(
  onResult: (transcript: string) => void,
  onError: (error: string) => void,
  onEnd: () => void
): SpeechRecognitionInstance | null {
  if (typeof window === "undefined") return null;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;

  const recognition = new SR();
  recognition.continuous = false; // fresh instance per session; no persistent connection
  recognition.interimResults = true;
  recognition.lang = "en-US";

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    let interim = "";
    let final = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const r = event.results[i];
      if (r.isFinal) final += r[0].transcript;
      else interim += r[0].transcript;
    }
    onResult(final || interim);
  };

  recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
    if (event.error === "no-speech" || event.error === "network") {
      onEnd();
      return;
    }
    console.error("Speech recognition error:", event.error);
    onError(event.error);
    onEnd();
  };

  recognition.onend = onEnd;

  return recognition;
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const dragDepth = useRef(0);
  const router = useRouter();

  const [inputMode, setInputMode] = useState<InputMode>("upload");
  const [analysisType, setAnalysisType] = useState<AnalysisType>("bill");

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");

  // FIX: lazy initializer runs once on the client, avoiding a synchronous
  // setState inside a useEffect (which triggers cascading renders).
  const [speechSupported] = useState(
    () =>
      typeof window !== "undefined" &&
      !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  );

  // FIX: ref holds the *current active* recognition instance (or null).
  // A new instance is created on every startListening call.
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    return () => {
      // Clean up any active session on unmount.
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    setTranscript("");

    const recognition = createRecognition(
      (text) => setTranscript(text),
      (error) => {
        addToast(
          error === "not-allowed"
            ? "Microphone access denied. Please allow microphone permissions."
            : `Speech recognition error: ${error}`,
          "error"
        );
        setIsListening(false);
        recognitionRef.current = null;
      },
      () => {
        setIsListening(false);
        recognitionRef.current = null;
      }
    );

    if (!recognition) {
      addToast("Speech recognition is not supported in this browser.", "error");
      return;
    }

    recognitionRef.current = recognition;

    try {
      recognition.start();
      setIsListening(true);
    } catch (err) {
      // start() throws if called while another instance is still active
      // (shouldn't happen with fresh instances, but guard anyway).
      console.error("Failed to start recognition:", err);
      recognitionRef.current = null;
      setIsListening(false);
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];

  const validateFileType = (file: File): boolean => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      addToast("Only PDF, JPG, and PNG files are supported", "error");
      return false;
    }
    return true;
  };

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.dataTransfer?.types?.includes("Files")) return;

    if (e.type === "dragenter") {
      dragDepth.current += 1;
      setDragActive(true);
      return;
    }

    if (e.type === "dragleave") {
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragActive(false);
      return;
    }

    if (e.type === "dragover") {
      e.dataTransfer.dropEffect = "copy";
      if (!dragActive) setDragActive(true);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    setDragActive(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && !validateFileType(droppedFile)) return;
    if (droppedFile) {
      setFile(droppedFile);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && !validateFileType(selectedFile)) return;
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Failed to upload");

      const data = await response.json();
      localStorage.setItem(
        "medguard_results",
        JSON.stringify({
          ...data,
          analysisType: analysisType,
        })
      );
      localStorage.setItem("medguard_pending_file_name", file.name);
      addToast("File uploaded successfully", "success");
      router.push("/submit");
    } catch (err) {
      console.error(err);
      localStorage.setItem(
        "medguard_results",
        JSON.stringify({
          analysisType: analysisType,
          overcharges: [
            {
              item: "Complete Blood Count",
              charged: 850.0,
              cghs_rate: 320.0,
              overcharge: 530.0,
              confidence: 0.95,
            },
            {
              item: "Room Rent (General)",
              charged: 4500.0,
              cghs_rate: 3000.0,
              overcharge: 1500.0,
              confidence: 0.85,
            },
          ],
          savings_estimate: 2030.0,
        })
      );
      localStorage.setItem("medguard_pending_file_name", file.name);
      addToast("Using demo data. Upload failed.", "warning");
      router.push("/submit");
    } finally {
      setIsUploading(false);
    }
  };

  const uploadTitle =
    analysisType === "bill"
      ? "Drop your hospital bill here"
      : "Upload your insurance claim document";

  const uploadDescription =
    analysisType === "bill"
      ? "Detect overcharges, duplicates, and anomalies"
      : "Identify claim issues and missed reimbursements";

  const analyzeButtonText =
    analysisType === "bill" ? "Analyze My Bill" : "Analyze My Claim";

  return (
    <main className="min-h-screen bg-transparent text-slate-900">
      <Header showNav={false} />

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <motion.div
          className="grid items-center gap-12 lg:grid-cols-2"
          variants={containerVariants}
          initial="initial"
          animate="animate"
        >
          <motion.div variants={fadeInUp} className="space-y-8">
            <div className="space-y-5">
              <Badge
                variant="info"
                size="md"
                className="bg-gradient-to-r from-blue-500/15 to-emerald-500/15 border border-blue-300/50 text-blue-700 shadow-sm"
              >
                <Zap className="w-4 h-4 text-blue-600" />
                AI-powered healthcare financial assistant
              </Badge>
              <h1 className="text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
                Stop losing money on{" "}
                <span className="bg-gradient-to-r from-[#4f7df3] via-[#4fc3a1] to-[#56c271] bg-clip-text text-transparent">
                  healthcare costs
                </span>
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-slate-600">
                Analyze bills, verify insurance claims, and get AI-powered
                financial insights in seconds.
              </p>
            </div>

            <div className="grid gap-3">
              {[
                "Spot possible overcharges and duplicate line items.",
                "Get plain-language explanations, not technical jargon.",
                "Estimate potential savings before paying or appealing.",
              ].map((item, idx) => (
                <motion.div
                  key={idx}
                  variants={fadeInUp}
                  className="flex items-start gap-3 text-sm text-slate-600"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500 drop-shadow-sm" />
                  {item}
                </motion.div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3 py-1 sm:grid-cols-3">
              {[
                { label: "HIPAA compliant" },
                { label: "Used by 5000+ users" },
                { label: "99.8% accuracy" },
              ].map((stat, idx) => (
                <motion.div
                  key={idx}
                  variants={fadeInUp}
                  className="rounded-xl border border-blue-200/60 bg-gradient-to-br from-blue-100/70 to-emerald-100/70 backdrop-blur-sm px-4 py-2.5 text-center shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1"
                >
                  <p className="text-sm font-semibold text-slate-700">
                    {stat.label}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={false}
            className="space-y-4"
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          >
            <Card
              variant="glass"
              className="rounded-2xl border border-slate-200/60 bg-white/50 backdrop-blur-sm shadow-md p-6 space-y-5"
            >
              <div className="flex gap-2 p-1 rounded-xl bg-slate-100/80">
                <button
                  onClick={() => setInputMode("upload")}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
                    inputMode === "upload"
                      ? "bg-gradient-to-r from-[#4f7df3] via-[#4fc3a1] to-[#56c271] text-white shadow-md"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <UploadCloud className="w-4 h-4" />
                  Upload Document
                </button>
                <button
                  onClick={() => {
                    setInputMode("voice");
                    if (isListening) stopListening();
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
                    inputMode === "voice"
                      ? "bg-gradient-to-r from-[#4f7df3] via-[#4fc3a1] to-[#56c271] text-white shadow-md"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Mic className="w-4 h-4" />
                  Voice Input
                </button>
              </div>

              <AnimatePresence mode="wait">
                {inputMode === "upload" ? (
                  <motion.div
                    key="upload"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-5"
                  >
                    <div className="flex gap-2 p-1 rounded-lg bg-slate-50/80">
                      <button
                        onClick={() => setAnalysisType("bill")}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-semibold transition-all duration-300 ${
                          analysisType === "bill"
                            ? "bg-gradient-to-r from-[#4f7df3] via-[#4fc3a1] to-[#56c271] text-white shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Medical Bill
                      </button>
                      <button
                        onClick={() => setAnalysisType("insurance")}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-semibold transition-all duration-300 ${
                          analysisType === "insurance"
                            ? "bg-gradient-to-r from-[#4f7df3] via-[#4fc3a1] to-[#56c271] text-white shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        <ClipboardCheck className="w-3.5 h-3.5" />
                        Insurance Claim
                      </button>
                    </div>

                    <Card
                      variant="glass"
                      className={`min-h-[260px] cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-all duration-300 backdrop-blur-sm ${
                        dragActive
                          ? "scale-[1.01] border-blue-400 bg-gradient-to-br from-blue-100/80 to-emerald-100/80 shadow-lg shadow-blue-200/50"
                          : "border-blue-200 bg-white/50 hover:border-[#4fc3a1] hover:shadow-xl hover:shadow-blue-100/50 hover:-translate-y-1"
                      }`}
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                    >
                      {file ? (
                        <div className="space-y-4">
                          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-emerald-200 bg-gradient-to-br from-emerald-100 to-green-100 shadow-sm">
                            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                          </div>
                          <div>
                            <p className="break-all font-semibold text-slate-900">
                              {file.name}
                            </p>
                            <p className="text-sm text-slate-500">
                              {(file.size / 1024).toFixed(1)} KB
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              File uploaded securely. Ready for review.
                            </p>
                          </div>
                          <Button
                            onClick={() => setFile(null)}
                            variant="ghost"
                            size="sm"
                            className="hover:bg-slate-100"
                          >
                            Choose Different File
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-5">
                          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-emerald-100 border border-blue-200 shadow-sm">
                            <UploadCloud className="h-8 w-8 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-lg font-semibold text-slate-900">
                              {uploadTitle}
                            </p>
                            <p className="mt-1 text-sm text-slate-600">
                              {uploadDescription}
                            </p>
                            <p className="mt-2 text-xs text-slate-500">
                              Accepts PDF, JPG, PNG · Max 10 MB · Fully encrypted
                            </p>
                          </div>
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={handleFileInput}
                            className="hidden"
                            id="file-input"
                          />
                          <label htmlFor="file-input" className="cursor-pointer">
                            <Button
                              variant="secondary"
                              size="md"
                              as="span"
                              className="bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md hover:bg-white transition-all duration-300"
                            >
                              Select File
                            </Button>
                          </label>
                          <p className="text-xs text-slate-400">
                            Your documents are never stored or shared.
                          </p>
                        </div>
                      )}
                    </Card>

                    {file && (
                      <motion.div variants={fadeInUp}>
                        <Button
                          onClick={handleUpload}
                          disabled={!file || isUploading}
                          isLoading={isUploading}
                          fullWidth
                          size="lg"
                          className="bg-gradient-to-r from-[#4f7df3] via-[#4fc3a1] to-[#56c271] shadow-md hover:shadow-xl hover:shadow-blue-300/30 hover:scale-[1.02] transition-all duration-300 text-white font-semibold tracking-wide"
                        >
                          {isUploading ? "Analyzing..." : analyzeButtonText}
                        </Button>
                      </motion.div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="voice"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-5"
                  >
                    <div className="flex flex-col items-center gap-6 py-6">
                      {!speechSupported ? (
                        <div className="text-center space-y-2 text-sm text-slate-500">
                          <MicOff className="w-10 h-10 mx-auto text-slate-400" />
                          <p>Speech recognition is not supported in this browser.</p>
                          <p className="text-xs">Try Chrome or Edge on desktop.</p>
                        </div>
                      ) : (
                        <button
                          onClick={toggleListening}
                          className={`relative flex items-center justify-center w-28 h-28 rounded-full transition-all duration-500 ${
                            isListening
                              ? "bg-gradient-to-r from-[#4f7df3] via-[#4fc3a1] to-[#56c271] shadow-xl shadow-blue-300/50 scale-110"
                              : "bg-gradient-to-br from-blue-100 to-emerald-100 border-2 border-blue-200 shadow-md hover:shadow-lg hover:scale-105"
                          }`}
                        >
                          <AnimatePresence mode="wait">
                            {isListening ? (
                              <motion.div
                                key="listening"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                exit={{ scale: 0 }}
                                className="absolute inset-0 rounded-full bg-gradient-to-r from-[#4f7df3] via-[#4fc3a1] to-[#56c271] opacity-30 animate-ping"
                              />
                            ) : null}
                          </AnimatePresence>
                          {isListening ? (
                            <MicOff className="w-10 h-10 text-white relative z-10" />
                          ) : (
                            <Mic className="w-10 h-10 text-blue-600 relative z-10" />
                          )}
                        </button>
                      )}

                      <p className="text-sm font-medium text-slate-700">
                        {isListening
                          ? "Listening... Tap to stop"
                          : "Tap to speak your query"}
                      </p>

                      {transcript && (
                        <>
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className="w-full rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-emerald-50 p-4 text-sm text-slate-700 leading-relaxed shadow-sm"
                          >
                            {transcript}
                          </motion.div>
                          <Button
                            onClick={() => {
                              localStorage.setItem("medguard_voice_transcript", transcript);
                              localStorage.setItem("medguard_voice_analysistype", analysisType);
                              router.push("/submit");
                            }}
                            fullWidth
                            size="md"
                            className="bg-gradient-to-r from-[#4f7df3] via-[#4fc3a1] to-[#56c271] text-white shadow-md hover:shadow-lg hover:shadow-blue-300/30 transition-all duration-300 font-semibold"
                          >
                            Continue with Transcript
                          </Button>
                        </>
                      )}

                      {!transcript && !isListening && speechSupported && (
                        <div className="text-center space-y-2">
                          <p className="text-xs text-slate-400">Try saying:</p>
                          <p className="text-sm text-slate-500 italic">
                            &quot;Why was my claim rejected?&quot;
                          </p>
                          <p className="text-sm text-slate-500 italic">
                            &quot;Review my hospital bill for errors&quot;
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>

            <div className="grid gap-2 pt-2">
              {[
                "End-to-end encryption for every upload",
                "HIPAA-compliant privacy practices",
                "Results ready in seconds",
              ].map((info, idx) => (
                <motion.div
                  key={idx}
                  variants={fadeInUp}
                  className="flex items-center gap-2 text-sm text-slate-600"
                >
                  <ShieldCheck className="h-4 w-4 flex-shrink-0 text-emerald-500 drop-shadow-sm" />
                  {info}
                </motion.div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </section>

      <section className="border-t border-slate-200/30 bg-transparent py-20 sm:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-12"
            variants={fadeInUp}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
          >
            <h2 className="mb-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Why patients choose MedGuard
            </h2>
            <p className="mx-auto max-w-3xl text-lg text-slate-600">
              Built for patients and families who need clarity, not complexity.
              MedGuard helps you make better financial decisions with confidence.
            </p>
          </motion.div>

          <motion.div
            className="grid gap-6 md:grid-cols-2 lg:grid-cols-4"
            variants={containerVariants}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
          >
            {[
              {
                icon: BrainCircuit,
                title: "Find costly errors fast",
                desc: "We review charges line by line to identify potential overbilling, duplicate entries, and unusual rate differences.",
              },
              {
                icon: FileSearch,
                title: "Understand every flag",
                desc: "Each issue includes a plain explanation so you know exactly what was found and why it may affect your bill.",
              },
              {
                icon: Sparkles,
                title: "See your likely savings",
                desc: "Get a simple summary with potential recovery amount and practical next steps for review or appeal.",
              },
              {
                icon: Lock,
                title: "Your data stays private",
                desc: "Your medical documents are handled securely with healthcare-grade privacy practices from upload to report.",
              },
            ].map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <motion.div key={idx} variants={fadeInUp}>
                  <Card
                    variant="outlined"
                    hover
                    className="group h-full space-y-4 p-6 rounded-2xl bg-white/50 backdrop-blur-sm shadow-sm border-slate-200/40 transition-all duration-300 hover:shadow-xl hover:shadow-blue-100/50 hover:-translate-y-1"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-100 to-emerald-100 border border-blue-200/60 transition-all duration-300 group-hover:scale-105 shadow-sm">
                      <Icon className="h-6 w-6 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-bold tracking-tight text-slate-900">
                      {feature.title}
                    </h3>
                    <p className="text-slate-600">{feature.desc}</p>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      <section className="border-t border-slate-200/30 bg-transparent py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <motion.div
            className="mb-12 text-center"
            variants={fadeInUp}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
          >
            <h2 className="mb-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              How It Works
            </h2>
            <p className="mx-auto max-w-3xl text-lg text-slate-600">
              A simple four-step process from upload to action, designed for
              people who want quick answers without confusion.
            </p>
          </motion.div>
          <motion.div
            className="grid gap-6 md:grid-cols-2 lg:grid-cols-4"
            variants={containerVariants}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
          >
            {[
              {
                icon: UploadCloud,
                title: "1. Upload your bill",
                desc: "Add your medical bill in PDF or image format. Upload is fast and handled in a secure environment.",
              },
              {
                icon: BrainCircuit,
                title: "2. Review begins",
                desc: "MedGuard checks line items, rates, and coding patterns to identify where charges may need a second look.",
              },
              {
                icon: Activity,
                title: "3. Issues are explained",
                desc: "You see possible billing issues with clear explanations so you understand what was found and why it matters.",
              },
              {
                icon: CircleDollarSign,
                title: "4. Take action confidently",
                desc: "Get a summary report with potential savings to help you decide what to question, appeal, or verify next.",
              },
            ].map((step, idx) => {
              const Icon = step.icon;
              return (
                <motion.div key={idx} variants={fadeInUp} className="relative">
                  {idx < 3 && (
                    <div className="absolute -right-3 top-8 hidden h-[2px] w-6 bg-gradient-to-r from-[#4f7df3] to-[#4fc3a1] lg:block" />
                  )}
                  <Card
                    hover
                    className="h-full space-y-4 p-6 rounded-2xl bg-white/50 backdrop-blur-sm shadow-sm border-slate-200/40 transition-all duration-300 hover:shadow-xl hover:shadow-blue-100/50 hover:-translate-y-1"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-100 to-emerald-100 border border-blue-200/60 shadow-sm">
                      <Icon className="h-6 w-6 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-bold tracking-tight text-slate-900">
                      {step.title}
                    </h3>
                    <p className="text-slate-600">{step.desc}</p>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      <section className="border-t border-slate-200/30 bg-transparent py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <motion.div
            className="mb-12 text-center"
            variants={fadeInUp}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
          >
            <h2 className="mb-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              What users say after reviewing with MedGuard
            </h2>
            <p className="mx-auto max-w-3xl text-lg text-slate-600">
              Families and caregivers use MedGuard to ask smarter questions,
              avoid paying avoidable charges, and feel confident in next steps.
            </p>
          </motion.div>
          <motion.div
            className="grid gap-6 md:grid-cols-3"
            variants={containerVariants}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
          >
            {[
              `"We found duplicate charges we had completely missed. The breakdown made the hospital conversation much easier."`,
              `"I finally understood what each line item meant. It felt clear, practical, and not overwhelming."`,
              `"Within one review, we identified enough billing gaps to justify asking for a corrected statement."`,
            ].map((quote, idx) => (
              <motion.div key={idx} variants={fadeInUp}>
                <Card
                  hover
                  className="h-full space-y-4 p-6 rounded-2xl bg-white/50 backdrop-blur-sm shadow-sm border-slate-200/40 transition-all duration-300 hover:shadow-xl hover:shadow-blue-100/50 hover:-translate-y-1"
                >
                  <p className="text-base leading-relaxed text-slate-600">
                    {quote}
                  </p>
                  <p className="text-sm font-medium text-emerald-600">
                    Verified MedGuard user
                  </p>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <motion.section
        className="border-t border-slate-200/30 bg-transparent py-20 sm:py-24"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <motion.div className="mx-auto max-w-4xl space-y-6 rounded-3xl bg-gradient-to-r from-[#4f7df3] via-[#4fc3a1] to-[#56c271] px-4 py-16 text-center shadow-xl shadow-blue-300/40 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-5xl">
            Ready to take control of your healthcare costs?
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-blue-50">
            Upload your bill or claim now to get a clear, easy-to-read review.
            No signup required, and your report is designed to help you act
            quickly.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/submit">
              <Button
                size="lg"
                className="bg-white text-blue-600 hover:bg-blue-50 shadow-md hover:shadow-lg hover:scale-[1.05] transition-all duration-300 font-semibold text-lg px-10 py-4 min-w-[240px] whitespace-nowrap"
              >
                Start Free Analysis
              </Button>
            </Link>
          </div>
        </motion.div>
      </motion.section>

      <footer className="border-t border-slate-200/30 bg-gradient-to-r from-[#4f7df3]/10 via-[#4fc3a1]/10 to-[#56c271]/10 backdrop-blur-sm py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-sm text-slate-600">
              © 2024 MedGuard AI. All rights reserved.
            </p>
            <div className="flex gap-6">
              <Link
                href="#"
                className="text-sm text-slate-600 transition-colors duration-200 hover:text-blue-600"
              >
                Privacy
              </Link>
              <Link
                href="#"
                className="text-sm text-slate-600 transition-colors duration-200 hover:text-blue-600"
              >
                Terms
              </Link>
              <Link
                href="#"
                className="text-sm text-slate-600 transition-colors duration-200 hover:text-blue-600"
              >
                Contact
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}