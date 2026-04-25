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

/** Discriminates between a hospital bill audit and an insurance claim review. */
type AnalysisType = "bill" | "insurance";

/** Allowed MIME types for file uploads. */
const ACCEPTED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
] as const;

/** localStorage key used to persist the wizard draft across page reloads. */
const STORAGE_KEY = "medguard_submit_draft";

/** Shape of the serialised draft stored in localStorage. */
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

/**
 * Validate that a file's MIME type is in the allowed list.
 * Shows a toast notification if validation fails.
 */
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
  // -------------------------------------------------------------------------
  // Routing
  // -------------------------------------------------------------------------
  const router = useRouter();

  // -------------------------------------------------------------------------
  // Analysis type
  // -------------------------------------------------------------------------

  /**
   * The type of analysis being submitted.
   *
   * Initialised in this order of precedence:
   *   1. Voice-commanded type (temporary, consumed once).
   *   2. Previously saved draft.
   *   3. Default: "bill".
   */
  const [analysisType, setAnalysisType] = useState<AnalysisType>(() => {
    if (typeof window !== "undefined") {
      // Check for a one-time voice command override.
      const voiceType = localStorage.getItem("medguard_voice_analysistype");
      if (voiceType === "bill" || voiceType === "insurance") {
        localStorage.removeItem("medguard_voice_analysistype");
        return voiceType;
      }

      // Restore from saved draft.
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const draft: SavedDraft = JSON.parse(saved);
          return draft.analysisType || "bill";
        } catch {
          // Corrupted draft — fall through.
        }
      }
    }
    return "bill";
  });

  /** Convenience flag — `true` when analysing a hospital bill. */
  const isBill = analysisType === "bill";

  // -------------------------------------------------------------------------
  // Wizard step
  // -------------------------------------------------------------------------

  /**
   * Current wizard step (1–4).
   * Restored from a saved draft when available.
   */
  const [step, setStep] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const draft: SavedDraft = JSON.parse(saved);
          return draft.step || 1;
        } catch {
          // Corrupted draft — fall through.
        }
      }
    }
    return 1;
  });

  // -------------------------------------------------------------------------
  // File state — Step 1 (bill / claim document)
  // -------------------------------------------------------------------------

  /** The actual File object for the primary document. */
  const [billFile, setBillFile] = useState<File | null>(null);

  /**
   * Display name for the primary document.
   * Restored from a pending upload flag or a saved draft.
   */
  const [billFileName, setBillFileName] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      // One-time flag set by another page after a file was staged.
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
        } catch {
          // Corrupted draft — fall through.
        }
      }
    }
    return null;
  });

  // -------------------------------------------------------------------------
  // File state — Step 2 (policy document)
  // -------------------------------------------------------------------------

  /** The actual File object for the policy document. */
  const [policyFile, setPolicyFile] = useState<File | null>(null);

  /**
   * Display name for the policy document.
   * Restored from a saved draft.
   */
  const [policyFileName, setPolicyFileName] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const draft: SavedDraft = JSON.parse(saved);
          return draft.policyFileName || null;
        } catch {
          // Corrupted draft — fall through.
        }
      }
    }
    return null;
  });

  // -------------------------------------------------------------------------
  // Form field state — Step 3 (case details)
  // -------------------------------------------------------------------------

  /** Patient name. Restored from draft or voice transcript. */
  const [patientName, setPatientName] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const draft: SavedDraft = JSON.parse(saved);
          return draft.patientName || "";
        } catch {
          // Corrupted draft — fall through.
        }
      }
    }
    return "";
  });

  /** Insurance company name. Restored from draft. */
  const [insurerName, setInsurerName] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const draft: SavedDraft = JSON.parse(saved);
          return draft.insurerName || "";
        } catch {
          // Corrupted draft — fall through.
        }
      }
    }
    return "";
  });

  /** Procedure or claim issue description. Restored from draft. */
  const [procedureOrIssue, setProcedureOrIssue] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const draft: SavedDraft = JSON.parse(saved);
          return draft.procedureOrIssue || "";
        } catch {
          // Corrupted draft — fall through.
        }
      }
    }
    return "";
  });

  /** Date of the bill or claim. Restored from draft. */
  const [date, setDate] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const draft: SavedDraft = JSON.parse(saved);
          return draft.date || "";
        } catch {
          // Corrupted draft — fall through.
        }
      }
    }
    return "";
  });

  /**
   * Additional notes / context.
   *
   * Restored in this order:
   *   1. Voice transcript (temporary, consumed once).
   *   2. Previously saved draft.
   *   3. Empty string.
   */
  const [notes, setNotes] = useState(() => {
    if (typeof window !== "undefined") {
      // One-time voice transcript override.
      const transcript = localStorage.getItem("medguard_voice_transcript");
      if (transcript) {
        localStorage.removeItem("medguard_voice_transcript");
        return transcript;
      }

      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const draft: SavedDraft = JSON.parse(saved);
          return draft.notes || "";
        } catch {
          // Corrupted draft — fall through.
        }
      }
    }
    return "";
  });

  // -------------------------------------------------------------------------
  // Submission state
  // -------------------------------------------------------------------------

  /** `true` while the final submission request is in flight. */
  const [submitting, setSubmitting] = useState(false);

  // -------------------------------------------------------------------------
  // Drag-and-drop state (step 1)
  // -------------------------------------------------------------------------

  /** Whether the step-1 drop zone is currently in an active drag state. */
  const [dragActiveStep1, setDragActiveStep1] = useState(false);

  /**
   * Tracks nested dragenter / dragleave events for the step-1 drop zone.
   * Prevents flickering when dragging over child elements.
   */
  const dragDepthStep1 = useRef(0);

  // -------------------------------------------------------------------------
  // Drag-and-drop state (step 2)
  // -------------------------------------------------------------------------

  /** Whether the step-2 drop zone is currently in an active drag state. */
  const [dragActiveStep2, setDragActiveStep2] = useState(false);

  /**
   * Tracks nested dragenter / dragleave events for the step-2 drop zone.
   * Prevents flickering when dragging over child elements.
   */
  const dragDepthStep2 = useRef(0);

  // -------------------------------------------------------------------------
  // Draft persistence
  // -------------------------------------------------------------------------

  /**
   * Serialise the current wizard state to localStorage so the user can
   * resume where they left off after a page reload or navigation.
   */
  const saveDraft = useCallback(() => {
    if (typeof window === "undefined") return;

    const draft: SavedDraft = {
      step,
      analysisType,
      billFileName,
      policyFileName,
      patientName,
      insurerName,
      procedureOrIssue,
      date,
      notes,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [
    step,
    analysisType,
    billFileName,
    policyFileName,
    patientName,
    insurerName,
    procedureOrIssue,
    date,
    notes,
  ]);

  /** Persist the draft on every relevant state change. */
  useEffect(() => {
    saveDraft();
  }, [saveDraft]);

  /** Remove the saved draft from localStorage (called on successful submission). */
  const clearDraft = () => {
    localStorage.removeItem(STORAGE_KEY);
  };

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  /**
   * Determine whether the user can advance to the next wizard step.
   *
   * - Step 1: A primary document must be selected.
   * - Step 2: A policy document must be selected.
   * - Step 3: Patient name (≥2 chars), insurer, and procedure/issue are required.
   * - Step 4: Always allowed (review screen).
   */
  const canNext = (): boolean => {
    if (step === 1) return !!(billFile || billFileName);
    if (step === 2) return !!(policyFile || policyFileName);
    if (step === 3)
      return (
        patientName.length >= 2 &&
        insurerName.length > 0 &&
        procedureOrIssue.length > 0
      );
    return true;
  };

  // -------------------------------------------------------------------------
  // File-change handlers
  // -------------------------------------------------------------------------

  /**
   * Update state when the primary document (bill/claim) changes.
   * Runs MIME-type validation before accepting the file.
   */
  const handleBillFileChange = (file: File | null) => {
    if (file && !validateFileType(file)) return;
    setBillFile(file);
    setBillFileName(file ? file.name : null);
  };

  /**
   * Update state when the policy document changes.
   * Runs MIME-type validation before accepting the file.
   */
  const handlePolicyFileChange = (file: File | null) => {
    if (file && !validateFileType(file)) return;
    setPolicyFile(file);
    setPolicyFileName(file ? file.name : null);
  };

  // -------------------------------------------------------------------------
  // Drag-and-drop handlers — Step 1 (bill / claim)
  // -------------------------------------------------------------------------

  const handleDragStep1 = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();

    // Ignore drag events that don't involve files.
    if (!e.dataTransfer?.types?.includes("Files")) return;

    if (e.type === "dragenter") {
      dragDepthStep1.current += 1;
      setDragActiveStep1(true);
      return;
    }

    if (e.type === "dragleave") {
      dragDepthStep1.current = Math.max(0, dragDepthStep1.current - 1);
      if (dragDepthStep1.current === 0) setDragActiveStep1(false);
      return;
    }

    if (e.type === "dragover") {
      e.dataTransfer.dropEffect = "copy";
      if (!dragActiveStep1) setDragActiveStep1(true);
    }
  };

  const handleDropStep1 = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();

    dragDepthStep1.current = 0;
    setDragActiveStep1(false);

    const file = e.dataTransfer.files?.[0];
    if (file && !validateFileType(file)) return;
    handleBillFileChange(file || null);
  };

  // -------------------------------------------------------------------------
  // Drag-and-drop handlers — Step 2 (policy)
  // -------------------------------------------------------------------------

  const handleDragStep2 = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (!e.dataTransfer?.types?.includes("Files")) return;

    if (e.type === "dragenter") {
      dragDepthStep2.current += 1;
      setDragActiveStep2(true);
      return;
    }

    if (e.type === "dragleave") {
      dragDepthStep2.current = Math.max(0, dragDepthStep2.current - 1);
      if (dragDepthStep2.current === 0) setDragActiveStep2(false);
      return;
    }

    if (e.type === "dragover") {
      e.dataTransfer.dropEffect = "copy";
      if (!dragActiveStep2) setDragActiveStep2(true);
    }
  };

  const handleDropStep2 = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();

    dragDepthStep2.current = 0;
    setDragActiveStep2(false);

    const file = e.dataTransfer.files?.[0];
    if (file && !validateFileType(file)) return;
    handlePolicyFileChange(file || null);
  };

  // -------------------------------------------------------------------------
  // Final submission
  // -------------------------------------------------------------------------

  /**
   * Build the FormData payload, persist a history entry, clear the draft,
   * and navigate to the live case tracking page.
   *
   * If the backend is unreachable a demo `sessionId` is generated so the
   * user can still explore the downstream UI.
   */
  const submit = async () => {
    setSubmitting(true);

    try {
      const formData = new FormData();
      if (billFile)
        formData.append(isBill ? "bill_pdf" : "claim_pdf", billFile);
      if (policyFile) formData.append("policy_pdf", policyFile);
      formData.append("patient_name", patientName);
      formData.append("insurer_name", insurerName);
      formData.append(
        isBill ? "procedure_billed" : "claim_issue",
        procedureOrIssue
      );
      formData.append(isBill ? "bill_date" : "claim_date", date);
      formData.append("notes", notes);
      formData.append("analysis_type", analysisType);

      // Save a lightweight entry to the local analysis history.
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

      clearDraft();
      addToast("Case submitted successfully", "success");

      // Attempt to submit to the backend; fall back to a demo session ID.
      let sessionId = "demo_" + Date.now();
      try {
        const res = await fetch(apiUrl("/api/submit"), {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
          const d = await res.json();
          sessionId = d.session_id || sessionId;
        }
      } catch {
        // Backend unreachable — the demo session ID is used.
      }

      router.push(`/case/${sessionId}`);
    } catch {
      addToast("Submission failed. Please try again.", "error");
      setSubmitting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Context-aware labels
  // -------------------------------------------------------------------------

  /** Title shown above step 1. */
  const step1Title = isBill ? "Upload Medical Bill" : "Upload Insurance Claim";

  /** Descriptive subtitle for step 1. */
  const step1Desc = isBill
    ? "The hospital bill you want analyzed for overcharges"
    : "The insurance claim document you want reviewed";

  /** Placeholder text inside the step-1 drop zone. */
  const step1DropText = isBill
    ? "Drop your hospital bill here"
    : "Drop your insurance claim here";

  /** Form fields for step 3 — varies based on analysis type. */
  const step3Fields = isBill
    ? [
        {
          label: "Patient Name",
          value: patientName,
          set: setPatientName,
          ph: "John Doe",
          required: true,
        },
        {
          label: "Insurance Company",
          value: insurerName,
          set: setInsurerName,
          ph: "e.g. UnitedHealthcare",
          required: true,
        },
        {
          label: "Procedure Billed",
          value: procedureOrIssue,
          set: setProcedureOrIssue,
          ph: "e.g. MRI Lumbar Spine",
          required: true,
        },
        {
          label: "Bill Date",
          value: date,
          set: setDate,
          ph: "YYYY-MM-DD",
          required: false,
        },
      ]
    : [
        {
          label: "Patient Name",
          value: patientName,
          set: setPatientName,
          ph: "John Doe",
          required: true,
        },
        {
          label: "Insurance Company",
          value: insurerName,
          set: setInsurerName,
          ph: "e.g. UnitedHealthcare",
          required: true,
        },
        {
          label: "Claim Issue",
          value: procedureOrIssue,
          set: setProcedureOrIssue,
          ph: "e.g. Claim denied for pre-existing condition",
          required: true,
        },
        {
          label: "Claim Date",
          value: date,
          set: setDate,
          ph: "YYYY-MM-DD",
          required: false,
        },
      ];

  /** Key-value pairs shown on the review step (step 4). */
  const reviewItems = [
    {
      label: isBill ? "Medical Bill" : "Insurance Claim",
      value: billFileName || "Not uploaded",
    },
    { label: "Policy Document", value: policyFileName || "Not uploaded" },
    { label: "Patient", value: patientName },
    { label: "Insurer", value: insurerName },
    { label: isBill ? "Procedure" : "Claim Issue", value: procedureOrIssue },
    { label: isBill ? "Bill Date" : "Claim Date", value: date || "—" },
  ];

  /** Title + subtitle for each wizard step. */
  const titles = [
    { t: step1Title, s: step1Desc },
    { t: "Upload Policy Document", s: "Your insurance plan's policy PDF" },
    { t: "Case Details", s: "Tell our AI agents about your case" },
    {
      t: "Review & Submit",
      s: "Everything looks good? Let the agents go to work!",
    },
  ];

  /** Final button label on step 4. */
  const submitButtonText = isBill
    ? "Submit Bill Analysis"
    : "Submit Claim Review";

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="relative flex min-h-screen flex-col items-center overflow-hidden bg-transparent p-8">
      {/* ---- Decorative background blurs ---- */}
      <div className="absolute left-[-10%] top-[-10%] h-[40%] w-[40%] rounded-full bg-[#4f7df3] opacity-15 blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] h-[40%] w-[40%] rounded-full bg-[#4fc3a1] opacity-15 blur-[120px]" />

      {/* ---- Header ---- */}
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

      {/* ---- Main content ---- */}
      <main className="z-10 w-full max-w-2xl flex-1">
        {/* =============================================================== */}
        {/* Analysis type toggle                                           */}
        {/* =============================================================== */}
        <div className="mx-auto mb-8 flex max-w-sm gap-2 rounded-xl border border-slate-200/60 bg-white/60 p-1 backdrop-blur-sm">
          <button
            onClick={() => {
              setAnalysisType("bill");
              setStep(1);
            }}
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
            onClick={() => {
              setAnalysisType("insurance");
              setStep(1);
            }}
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

        {/* =============================================================== */}
        {/* Step indicator (1 – 2 – 3 – 4)                                 */}
        {/* =============================================================== */}
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

              {/* Connector line between steps */}
              {s < 4 && (
                <div
                  className={`h-0.5 w-8 ${
                    s < step
                      ? "bg-gradient-to-r from-[#4f7df3] to-[#4fc3a1]"
                      : "bg-slate-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* =============================================================== */}
        {/* Active step panel                                              */}
        {/* =============================================================== */}
        <motion.div
          key={`${analysisType}-${step}`}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="glass-panel rounded-2xl border-slate-200/60 bg-white/70 p-8 shadow-xl shadow-blue-100/30 backdrop-blur-sm"
        >
          <h2 className="mb-1 text-2xl font-bold text-slate-900">
            {titles[step - 1].t}
          </h2>
          <p className="mb-6 text-sm text-slate-500">{titles[step - 1].s}</p>

          {/* ---- Step 1: Upload bill / claim document ---- */}
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
                onChange={(e) =>
                  handleBillFileChange(e.target.files?.[0] || null)
                }
              />

              {billFile || billFileName ? (
                <>
                  <FileText className="mb-3 text-[#4f7df3] drop-shadow-sm" size={40} />
                  <p className="font-medium text-slate-900">{billFileName}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Click or drop to change
                  </p>
                </>
              ) : (
                <>
                  <Upload className="mb-3 text-slate-400" size={40} />
                  <p className="font-medium text-slate-700">{step1DropText}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    PDF, PNG, or JPG
                  </p>
                </>
              )}
            </label>
          )}

          {/* ---- Step 2: Upload policy document ---- */}
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
                onChange={(e) =>
                  handlePolicyFileChange(e.target.files?.[0] || null)
                }
              />

              {policyFile || policyFileName ? (
                <>
                  <FileText className="mb-3 text-[#4f7df3] drop-shadow-sm" size={40} />
                  <p className="font-medium text-slate-900">
                    {policyFileName}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Click or drop to change
                  </p>
                </>
              ) : (
                <>
                  <Upload className="mb-3 text-slate-400" size={40} />
                  <p className="font-medium text-slate-700">
                    Drop policy document here
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    PDF, PNG, or JPG
                  </p>
                </>
              )}
            </label>
          )}

          {/* ---- Step 3: Case details form ---- */}
          {step === 3 && (
            <div className="space-y-4">
              {step3Fields.map((f) => (
                <div key={f.label}>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    {f.label}{" "}
                    {f.required && <span className="text-red-400">*</span>}
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
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Additional Notes
                </label>
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

          {/* ---- Step 4: Review summary ---- */}
          {step === 4 && (
            <div className="space-y-3">
              {reviewItems.map((r) => (
                <div
                  key={r.label}
                  className="flex items-center justify-between border-b border-slate-100 py-2"
                >
                  <span className="text-sm text-slate-500">{r.label}</span>
                  <span className="text-sm font-medium text-slate-900">
                    {r.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* ============================================================= */}
          {/* Navigation buttons (Back / Continue / Submit)                 */}
          {/* ============================================================= */}
          <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-4">
            {step > 1 ? (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-900"
              >
                <ArrowLeft size={16} /> Back
              </button>
            ) : (
              <Link
                href="/"
                className="flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-900"
              >
                <ArrowLeft size={16} /> Home
              </Link>
            )}

            {step < 4 ? (
              /* Continue button — disabled until step requirements are met */
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
              /* Submit button — only visible on step 4 */
              <button
                onClick={submit}
                disabled={submitting}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#4f7df3] via-[#4fc3a1] to-[#56c271] px-6 py-3 text-sm font-bold text-white shadow-md transition-all hover:shadow-lg hover:shadow-blue-300/40 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Launching agents...
                  </>
                ) : (
                  <>
                    {submitButtonText} <ArrowRight size={16} />
                  </>
                )}
              </button>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
}