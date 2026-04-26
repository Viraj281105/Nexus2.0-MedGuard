"use client";

// ---------------------------------------------------------------------------
// External dependencies
// ---------------------------------------------------------------------------
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  Upload,
  FileText,
  ArrowRight,
  ArrowLeft,
  Loader2,
  CheckCircle,
  ClipboardCheck,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Internal modules
// ---------------------------------------------------------------------------
import { apiUrl } from "@/lib/api";
import { saveToHistory } from "@/lib/history";
import { addToast } from "@/lib/toast";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type AnalysisType = "bill" | "insurance";

const ACCEPTED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
] as const;

const STORAGE_KEY = "medguard_submit_draft";

interface SavedDraft {
  step: number;
  analysisType: AnalysisType;
  billFileName: string | null;
  policyFileName: string | null;
  patientName: string;
  insurerName: string;
  procedureOrIssue: string;
  date: string;
  notes: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const validateFileType = (file: File): boolean => {
  if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
    addToast("Only PDF, JPG, and PNG files are supported", "error");
    return false;
  }
  return true;
};

// ===========================================================================
// SubmitPage Component
// ===========================================================================

export default function SubmitPage() {
  const router = useRouter();

  const [analysisType, setAnalysisType] = useState<AnalysisType>(() => {
    if (typeof window !== "undefined") {
      const voiceType = localStorage.getItem("medguard_voice_analysistype");
      if (voiceType === "bill" || voiceType === "insurance") {
        localStorage.removeItem("medguard_voice_analysistype");
        return voiceType;
      }
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const draft: SavedDraft = JSON.parse(saved);
          return draft.analysisType || "bill";
        } catch {}
      }
    }
    return "bill";
  });

  const isBill = analysisType === "bill";

  const [step, setStep] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const draft: SavedDraft = JSON.parse(saved);
          return draft.step || 1;
        } catch {}
      }
    }
    return 1;
  });

  const [billFile, setBillFile] = useState<File | null>(null);
  const [billFileName, setBillFileName] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const pendingName = localStorage.getItem("medguard_pending_file_name");
      if (pendingName) {
        localStorage.removeItem("medguard_pending_file_name");
        return pendingName;
      }
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const draft: SavedDraft = JSON.parse(saved);
          return draft.billFileName || null;
        } catch {}
      }
    }
    return null;
  });

  const [policyFile, setPolicyFile] = useState<File | null>(null);
  const [policyFileName, setPolicyFileName] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const draft: SavedDraft = JSON.parse(saved);
          return draft.policyFileName || null;
        } catch {}
      }
    }
    return null;
  });

  const [patientName, setPatientName] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try { return JSON.parse(saved).patientName || ""; } catch {}
      }
    }
    return "";
  });

  const [insurerName, setInsurerName] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try { return JSON.parse(saved).insurerName || ""; } catch {}
      }
    }
    return "";
  });

  const [procedureOrIssue, setProcedureOrIssue] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try { return JSON.parse(saved).procedureOrIssue || ""; } catch {}
      }
    }
    return "";
  });

  const [date, setDate] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try { return JSON.parse(saved).date || ""; } catch {}
      }
    }
    return "";
  });

  const [notes, setNotes] = useState(() => {
    if (typeof window !== "undefined") {
      const transcript = localStorage.getItem("medguard_voice_transcript");
      if (transcript) {
        localStorage.removeItem("medguard_voice_transcript");
        return transcript;
      }
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try { return JSON.parse(saved).notes || ""; } catch {}
      }
    }
    return "";
  });

  const [submitting, setSubmitting] = useState(false);
  const [dragActiveStep1, setDragActiveStep1] = useState(false);
  const dragDepthStep1 = useRef(0);
  const [dragActiveStep2, setDragActiveStep2] = useState(false);
  const dragDepthStep2 = useRef(0);

  // -------------------------------------------------------------------------
  // Draft persistence
  // -------------------------------------------------------------------------

  const saveDraft = useCallback(() => {
    if (typeof window === "undefined") return;
    const draft: SavedDraft = {
      step, analysisType, billFileName, policyFileName,
      patientName, insurerName, procedureOrIssue, date, notes,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [step, analysisType, billFileName, policyFileName, patientName, insurerName, procedureOrIssue, date, notes]);

  useEffect(() => { saveDraft(); }, [saveDraft]);

  const clearDraft = () => localStorage.removeItem(STORAGE_KEY);

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  const canNext = (): boolean => {
    if (step === 1) return !!(billFile || billFileName);
    if (step === 2) return !!(policyFile || policyFileName);
    if (step === 3)
      return patientName.length >= 2 && insurerName.length > 0 && procedureOrIssue.length > 0;
    return true;
  };

  // -------------------------------------------------------------------------
  // File-change handlers
  // -------------------------------------------------------------------------

  const handleBillFileChange = (file: File | null) => {
    if (file && !validateFileType(file)) return;
    setBillFile(file);
    setBillFileName(file ? file.name : null);
  };

  const handlePolicyFileChange = (file: File | null) => {
    if (file && !validateFileType(file)) return;
    setPolicyFile(file);
    setPolicyFileName(file ? file.name : null);
  };

  // -------------------------------------------------------------------------
  // Drag-and-drop handlers
  // -------------------------------------------------------------------------

  const handleDragStep1 = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.dataTransfer?.types?.includes("Files")) return;
    if (e.type === "dragenter") { dragDepthStep1.current += 1; setDragActiveStep1(true); return; }
    if (e.type === "dragleave") { dragDepthStep1.current = Math.max(0, dragDepthStep1.current - 1); if (dragDepthStep1.current === 0) setDragActiveStep1(false); return; }
    if (e.type === "dragover") { e.dataTransfer.dropEffect = "copy"; if (!dragActiveStep1) setDragActiveStep1(true); }
  };

  const handleDropStep1 = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault(); e.stopPropagation();
    dragDepthStep1.current = 0; setDragActiveStep1(false);
    const file = e.dataTransfer.files?.[0];
    if (file && !validateFileType(file)) return;
    handleBillFileChange(file || null);
  };

  const handleDragStep2 = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.dataTransfer?.types?.includes("Files")) return;
    if (e.type === "dragenter") { dragDepthStep2.current += 1; setDragActiveStep2(true); return; }
    if (e.type === "dragleave") { dragDepthStep2.current = Math.max(0, dragDepthStep2.current - 1); if (dragDepthStep2.current === 0) setDragActiveStep2(false); return; }
    if (e.type === "dragover") { e.dataTransfer.dropEffect = "copy"; if (!dragActiveStep2) setDragActiveStep2(true); }
  };

  const handleDropStep2 = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault(); e.stopPropagation();
    dragDepthStep2.current = 0; setDragActiveStep2(false);
    const file = e.dataTransfer.files?.[0];
    if (file && !validateFileType(file)) return;
    handlePolicyFileChange(file || null);
  };

  // -------------------------------------------------------------------------
  // Final submission
  // -------------------------------------------------------------------------

  const submit = async () => {
    // FIX 1: Guard — require actual File objects, not just cached filenames.
    // If the user loaded a draft but didn't re-select files, the File objects
    // will be null even though billFileName/policyFileName are set from localStorage.
    // This was causing the backend 400 "Either bill_pdf or claim_pdf is required".
    if (!billFile) {
      addToast(
        isBill
          ? "Please re-select your medical bill (file must be chosen again after reload)"
          : "Please re-select your insurance claim document",
        "error"
      );
      setStep(1);
      return;
    }
    if (!policyFile) {
      addToast("Please re-select your policy document", "error");
      setStep(2);
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append(isBill ? "bill_pdf" : "claim_pdf", billFile);
      formData.append("policy_pdf", policyFile);
      formData.append("patient_name", patientName);
      formData.append("insurer_name", insurerName);
      formData.append(isBill ? "procedure_billed" : "claim_issue", procedureOrIssue);
      formData.append(isBill ? "bill_date" : "claim_date", date);
      formData.append("notes", notes);
      formData.append("analysis_type", analysisType);

      saveToHistory({
        type: analysisType,
        patientName,
        insurerName,
        procedureOrIssue,
        date,
        savings: 0,
        findingsCount: 0,
        confidence: 0,
      });

      // FIX 2: Do NOT navigate until we have the real session_id from the backend.
      // Previously the code set sessionId = "demo_" + Date.now() first, then
      // tried the fetch, and navigated immediately — so the /case/[demo_id] page
      // opened and started polling before the real session existed, causing 404s.
      // Now we await the fetch fully before navigating. We only fall back to the
      // demo ID if the network is completely unreachable.
      const res = await fetch(apiUrl("/api/submit"), {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || `Server error ${res.status}`);
      }

      const d = await res.json();
      const sessionId = d.session_id;

      clearDraft();
      addToast("Case submitted successfully", "success");
      router.push(`/case/${sessionId}`);

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Submission failed";
      addToast(`Submission failed: ${message}`, "error");
      setSubmitting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Context-aware labels
  // -------------------------------------------------------------------------

  const step1Title = isBill ? "Upload Medical Bill" : "Upload Insurance Claim";
  const step1Desc = isBill
    ? "The hospital bill you want analyzed for overcharges"
    : "The insurance claim document you want reviewed";
  const step1DropText = isBill
    ? "Drop your hospital bill here"
    : "Drop your insurance claim here";

  const step3Fields = isBill
    ? [
        { label: "Patient Name", value: patientName, set: setPatientName, ph: "John Doe", required: true },
        { label: "Insurance Company", value: insurerName, set: setInsurerName, ph: "e.g. UnitedHealthcare", required: true },
        { label: "Procedure Billed", value: procedureOrIssue, set: setProcedureOrIssue, ph: "e.g. MRI Lumbar Spine", required: true },
        { label: "Bill Date", value: date, set: setDate, ph: "YYYY-MM-DD", required: false },
      ]
    : [
        { label: "Patient Name", value: patientName, set: setPatientName, ph: "John Doe", required: true },
        { label: "Insurance Company", value: insurerName, set: setInsurerName, ph: "e.g. UnitedHealthcare", required: true },
        { label: "Claim Issue", value: procedureOrIssue, set: setProcedureOrIssue, ph: "e.g. Claim denied for pre-existing condition", required: true },
        { label: "Claim Date", value: date, set: setDate, ph: "YYYY-MM-DD", required: false },
      ];

  const reviewItems = [
    { label: isBill ? "Medical Bill" : "Insurance Claim", value: billFileName || "Not uploaded" },
    { label: "Policy Document", value: policyFileName || "Not uploaded" },
    { label: "Patient", value: patientName },
    { label: "Insurer", value: insurerName },
    { label: isBill ? "Procedure" : "Claim Issue", value: procedureOrIssue },
    { label: isBill ? "Bill Date" : "Claim Date", value: date || "—" },
  ];

  const titles = [
    { t: step1Title, s: step1Desc },
    { t: "Upload Policy Document", s: "Your insurance plan's policy PDF" },
    { t: "Case Details", s: "Tell our AI agents about your case" },
    { t: "Review & Submit", s: "Everything looks good? Let the agents go to work!" },
  ];

  const submitButtonText = isBill ? "Submit Bill Analysis" : "Submit Claim Review";

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="relative flex min-h-screen flex-col items-center overflow-hidden bg-transparent p-8">
      <div className="absolute left-[-10%] top-[-10%] h-[40%] w-[40%] rounded-full bg-[#4f7df3] opacity-15 blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] h-[40%] w-[40%] rounded-full bg-[#4fc3a1] opacity-15 blur-[120px]" />

      <header className="z-10 flex w-full max-w-3xl items-center justify-between py-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="rounded-lg bg-gradient-to-br from-[#4f7df3] via-[#4fc3a1] to-[#56c271] p-2 text-white shadow-md shadow-blue-300/40">
            <ShieldCheck size={24} />
          </div>
          <span className="text-xl font-bold text-slate-900">
            MedGuard{" "}
            <span className="bg-gradient-to-r from-[#4f7df3] to-[#4fc3a1] bg-clip-text text-transparent">
              AI
            </span>
          </span>
        </Link>
        <span className="text-sm text-slate-500">Step {step} of 4</span>
      </header>

      <main className="z-10 w-full max-w-2xl flex-1">
        <div className="mx-auto mb-8 flex max-w-sm gap-2 rounded-xl border border-slate-200/60 bg-white/60 p-1 backdrop-blur-sm">
          <button
            onClick={() => { setAnalysisType("bill"); setStep(1); }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-300 ${
              isBill
                ? "bg-gradient-to-r from-[#4f7df3] via-[#4fc3a1] to-[#56c271] text-white shadow-md"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <FileText className="h-4 w-4" />
            Medical Bill
          </button>
          <button
            onClick={() => { setAnalysisType("insurance"); setStep(1); }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-300 ${
              !isBill
                ? "bg-gradient-to-r from-[#4f7df3] via-[#4fc3a1] to-[#56c271] text-white shadow-md"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <ClipboardCheck className="h-4 w-4" />
            Insurance Claim
          </button>
        </div>

        <div className="mb-8 flex items-center justify-center gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-all ${
                  s < step
                    ? "bg-gradient-to-br from-[#4f7df3] to-[#4fc3a1] text-white shadow-md"
                    : s === step
                      ? "bg-gradient-to-br from-[#4f7df3] via-[#4fc3a1] to-[#56c271] text-white shadow-lg shadow-blue-300/50"
                      : "border border-slate-200 bg-white/60 text-slate-400 backdrop-blur-sm"
                }`}
              >
                {s < step ? <CheckCircle size={16} /> : s}
              </div>
              {s < 4 && (
                <div className={`h-0.5 w-8 ${s < step ? "bg-gradient-to-r from-[#4f7df3] to-[#4fc3a1]" : "bg-slate-200"}`} />
              )}
            </div>
          ))}
        </div>

        <motion.div
          key={`${analysisType}-${step}`}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="glass-panel rounded-2xl border-slate-200/60 bg-white/70 p-8 shadow-xl shadow-blue-100/30 backdrop-blur-sm"
        >
          <h2 className="mb-1 text-2xl font-bold text-slate-900">{titles[step - 1].t}</h2>
          <p className="mb-6 text-sm text-slate-500">{titles[step - 1].s}</p>

          {step === 1 && (
            <label
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-all duration-300 ${
                dragActiveStep1
                  ? "scale-[1.01] border-blue-400 bg-gradient-to-br from-blue-100/80 to-emerald-100/80 shadow-lg shadow-blue-200/50"
                  : billFile || billFileName
                    ? "border-[#4fc3a1] bg-gradient-to-br from-blue-50 to-emerald-50 shadow-md"
                    : "border-slate-200 hover:border-blue-300 hover:bg-blue-50/30"
              }`}
              onDragEnter={handleDragStep1}
              onDragLeave={handleDragStep1}
              onDragOver={handleDragStep1}
              onDrop={handleDropStep1}
            >
              <input
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => handleBillFileChange(e.target.files?.[0] || null)}
              />
              {billFile || billFileName ? (
                <>
                  <FileText className="mb-3 text-[#4f7df3] drop-shadow-sm" size={40} />
                  <p className="font-medium text-slate-900">{billFileName}</p>
                  <p className="mt-1 text-sm text-slate-500">Click or drop to change</p>
                  {/* FIX: warn if only filename known (file object lost after reload) */}
                  {!billFile && billFileName && (
                    <p className="mt-2 text-xs text-amber-500">
                      ⚠ Please re-select this file before submitting
                    </p>
                  )}
                </>
              ) : (
                <>
                  <Upload className="mb-3 text-slate-400" size={40} />
                  <p className="font-medium text-slate-700">{step1DropText}</p>
                  <p className="mt-1 text-sm text-slate-500">PDF, PNG, or JPG</p>
                </>
              )}
            </label>
          )}

          {step === 2 && (
            <label
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-all duration-300 ${
                dragActiveStep2
                  ? "scale-[1.01] border-blue-400 bg-gradient-to-br from-blue-100/80 to-emerald-100/80 shadow-lg shadow-blue-200/50"
                  : policyFile || policyFileName
                    ? "border-[#4fc3a1] bg-gradient-to-br from-blue-50 to-emerald-50 shadow-md"
                    : "border-slate-200 hover:border-blue-300 hover:bg-blue-50/30"
              }`}
              onDragEnter={handleDragStep2}
              onDragLeave={handleDragStep2}
              onDragOver={handleDragStep2}
              onDrop={handleDropStep2}
            >
              <input
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => handlePolicyFileChange(e.target.files?.[0] || null)}
              />
              {policyFile || policyFileName ? (
                <>
                  <FileText className="mb-3 text-[#4f7df3] drop-shadow-sm" size={40} />
                  <p className="font-medium text-slate-900">{policyFileName}</p>
                  <p className="mt-1 text-sm text-slate-500">Click or drop to change</p>
                  {!policyFile && policyFileName && (
                    <p className="mt-2 text-xs text-amber-500">
                      ⚠ Please re-select this file before submitting
                    </p>
                  )}
                </>
              ) : (
                <>
                  <Upload className="mb-3 text-slate-400" size={40} />
                  <p className="font-medium text-slate-700">Drop policy document here</p>
                  <p className="mt-1 text-sm text-slate-500">PDF, PNG, or JPG</p>
                </>
              )}
            </label>
          )}

          {step === 3 && (
            <div className="space-y-4">
              {step3Fields.map((f) => (
                <div key={f.label}>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    {f.label} {f.required && <span className="text-red-400">*</span>}
                  </label>
                  <input
                    value={f.value}
                    onChange={(e) => f.set(e.target.value)}
                    placeholder={f.ph}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm placeholder-slate-400 transition-all focus:border-[#4f7df3] focus:outline-none focus:ring-2 focus:ring-blue-200/50"
                  />
                </div>
              ))}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Additional Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Any additional context..."
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm placeholder-slate-400 transition-all focus:border-[#4f7df3] focus:outline-none focus:ring-2 focus:ring-blue-200/50"
                />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              {reviewItems.map((r) => (
                <div key={r.label} className="flex items-center justify-between border-b border-slate-100 py-2">
                  <span className="text-sm text-slate-500">{r.label}</span>
                  <span className="text-sm font-medium text-slate-900">{r.value}</span>
                </div>
              ))}
              {/* FIX: warn on review screen if files need re-selecting */}
              {(!billFile || !policyFile) && (
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  ⚠ One or more files need to be re-selected (browser security prevents
                  restoring file selections after a page reload). Go back and re-upload them.
                </p>
              )}
            </div>
          )}

          <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-4">
            {step > 1 ? (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-900"
              >
                <ArrowLeft size={16} /> Back
              </button>
            ) : (
              <Link href="/" className="flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-900">
                <ArrowLeft size={16} /> Home
              </Link>
            )}

            {step < 4 ? (
              <button
                onClick={() => canNext() && setStep((s) => s + 1)}
                disabled={!canNext()}
                className={`flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-medium transition-all ${
                  canNext()
                    ? "bg-gradient-to-r from-[#4f7df3] via-[#4fc3a1] to-[#56c271] text-white shadow-md hover:shadow-lg hover:shadow-blue-300/30"
                    : "cursor-not-allowed bg-slate-100 text-slate-400"
                }`}
              >
                Continue <ArrowRight size={16} />
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={submitting}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#4f7df3] via-[#4fc3a1] to-[#56c271] px-6 py-3 text-sm font-bold text-white shadow-md transition-all hover:shadow-lg hover:shadow-blue-300/40 disabled:opacity-50"
              >
                {submitting ? (
                  <><Loader2 size={16} className="animate-spin" /> Launching agents...</>
                ) : (
                  <>{submitButtonText} <ArrowRight size={16} /></>
                )}
              </button>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
}