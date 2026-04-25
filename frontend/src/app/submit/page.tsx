"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ShieldCheck, Upload, FileText, ArrowRight, ArrowLeft, Loader2, CheckCircle, ClipboardCheck } from "lucide-react";
import { apiUrl } from "@/lib/api";

type AnalysisType = "bill" | "insurance";

export default function SubmitPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [analysisType, setAnalysisType] = useState<AnalysisType>("bill");
  const [billFile, setBillFile] = useState<File | null>(null);
  const [policyFile, setPolicyFile] = useState<File | null>(null);
  const [patientName, setPatientName] = useState("");
  const [insurerName, setInsurerName] = useState("");
  const [procedureOrIssue, setProcedureOrIssue] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isBill = analysisType === "bill";

  const canNext = () => {
    if (step === 1) return !!billFile;
    if (step === 2) return !!policyFile;
    if (step === 3) return patientName.length >= 2 && insurerName.length > 0 && procedureOrIssue.length > 0;
    return true;
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append(isBill ? "bill_pdf" : "claim_pdf", billFile!);
      formData.append("policy_pdf", policyFile!);
      formData.append("patient_name", patientName);
      formData.append("insurer_name", insurerName);
      formData.append(isBill ? "procedure_billed" : "claim_issue", procedureOrIssue);
      formData.append(isBill ? "bill_date" : "claim_date", date);
      formData.append("notes", notes);
      formData.append("analysis_type", analysisType);

      let sessionId = "demo_" + Date.now();
      try {
        const res = await fetch(apiUrl("/api/submit"), { method: "POST", body: formData });
        if (res.ok) { const d = await res.json(); sessionId = d.session_id || sessionId; }
      } catch { /* fallback */ }
      router.push(`/case/${sessionId}`);
    } catch { setSubmitting(false); }
  };

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
    { label: isBill ? "Medical Bill" : "Insurance Claim", value: billFile?.name || "Not uploaded" },
    { label: "Policy Document", value: policyFile?.name || "Not uploaded" },
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

  return (
    <div className="min-h-screen flex flex-col items-center p-8 relative overflow-hidden bg-transparent">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[#4f7df3] opacity-15 blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[#4fc3a1] opacity-15 blur-[120px]" />

      <header className="w-full max-w-3xl flex justify-between items-center py-6 z-10">
        <Link href="/" className="flex items-center gap-2">
          <div className="p-2 bg-gradient-to-br from-[#4f7df3] via-[#4fc3a1] to-[#56c271] rounded-lg text-white shadow-md shadow-blue-300/40"><ShieldCheck size={24} /></div>
          <span className="text-xl font-bold text-slate-900">MedGuard <span className="text-transparent bg-gradient-to-r from-[#4f7df3] to-[#4fc3a1] bg-clip-text">AI</span></span>
        </Link>
        <span className="text-sm text-slate-500">Step {step} of 4</span>
      </header>

      <main className="w-full max-w-2xl z-10 flex-1">
        {/* Analysis Type Selector */}
        <div className="flex gap-2 p-1 rounded-xl bg-white/60 backdrop-blur-sm border border-slate-200/60 mb-8 max-w-sm mx-auto">
          <button
            onClick={() => { setAnalysisType("bill"); setStep(1); }}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
              isBill
                ? "bg-gradient-to-r from-[#4f7df3] via-[#4fc3a1] to-[#56c271] text-white shadow-md"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <FileText className="w-4 h-4" />
            Medical Bill
          </button>
          <button
            onClick={() => { setAnalysisType("insurance"); setStep(1); }}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
              !isBill
                ? "bg-gradient-to-r from-[#4f7df3] via-[#4fc3a1] to-[#56c271] text-white shadow-md"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <ClipboardCheck className="w-4 h-4" />
            Insurance Claim
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                s < step ? "bg-gradient-to-br from-[#4f7df3] to-[#4fc3a1] text-white shadow-md" :
                s === step ? "bg-gradient-to-br from-[#4f7df3] via-[#4fc3a1] to-[#56c271] text-white shadow-lg shadow-blue-300/50" :
                "bg-white/60 backdrop-blur-sm text-slate-400 border border-slate-200"
              }`}>
                {s < step ? <CheckCircle size={16} /> : s}
              </div>
              {s < 4 && <div className={`w-8 h-0.5 ${s < step ? "bg-gradient-to-r from-[#4f7df3] to-[#4fc3a1]" : "bg-slate-200"}`} />}
            </div>
          ))}
        </div>

        <motion.div key={`${analysisType}-${step}`} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} className="glass-panel rounded-2xl p-8 bg-white/70 backdrop-blur-sm border-slate-200/60 shadow-xl shadow-blue-100/30">
          <h2 className="text-2xl font-bold mb-1 text-slate-900">{titles[step - 1].t}</h2>
          <p className="text-slate-500 text-sm mb-6">{titles[step - 1].s}</p>

          {/* Step 1: Bill/Claim file */}
          {step === 1 && (
            <label className={`flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300 ${
              billFile 
                ? "border-[#4fc3a1] bg-gradient-to-br from-blue-50 to-emerald-50 shadow-md" 
                : "border-slate-200 hover:border-blue-300 hover:bg-blue-50/30"
            }`}>
              <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => e.target.files && setBillFile(e.target.files[0])} />
              {billFile ? (
                <><FileText size={40} className="text-[#4f7df3] mb-3 drop-shadow-sm" /><p className="font-medium text-slate-900">{billFile.name}</p><p className="text-sm text-slate-500 mt-1">Click to change</p></>
               ) : (
                <><Upload size={40} className="text-slate-400 mb-3" /><p className="font-medium text-slate-700">{step1DropText}</p><p className="text-sm text-slate-500 mt-1">PDF, PNG, or JPG</p></>
              )}
            </label>
          )}

          {/* Step 2: Policy file */}
          {step === 2 && (
            <label className={`flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300 ${
              policyFile 
                ? "border-[#4fc3a1] bg-gradient-to-br from-blue-50 to-emerald-50 shadow-md" 
                : "border-slate-200 hover:border-blue-300 hover:bg-blue-50/30"
            }`}>
              <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => e.target.files && setPolicyFile(e.target.files[0])} />
              {policyFile ? (
                <><FileText size={40} className="text-[#4f7df3] mb-3 drop-shadow-sm" /><p className="font-medium text-slate-900">{policyFile.name}</p><p className="text-sm text-slate-500 mt-1">Click to change</p></>
               ) : (
                <><Upload size={40} className="text-slate-400 mb-3" /><p className="font-medium text-slate-700">Drop policy document here</p><p className="text-sm text-slate-500 mt-1">PDF, PNG, or JPG</p></>
              )}
            </label>
          )}

          {/* Step 3: Details */}
          {step === 3 && (
            <div className="space-y-4">
              {step3Fields.map((f) => (
                <div key={f.label}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{f.label} {f.required && <span className="text-red-400">*</span>}</label>
                  <input value={f.value} onChange={(e) => f.set(e.target.value)} placeholder={f.ph} className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#4f7df3] focus:ring-2 focus:ring-blue-200/50 transition-all shadow-sm" />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Additional Notes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Any additional context..." className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#4f7df3] focus:ring-2 focus:ring-blue-200/50 transition-all shadow-sm resize-none" />
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div className="space-y-3">
              {reviewItems.map((r) => (
                <div key={r.label} className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-sm text-slate-500">{r.label}</span>
                  <span className="text-sm font-medium text-slate-900">{r.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between items-center mt-8 pt-4 border-t border-slate-200">
            {step > 1 ? (
              <button onClick={() => setStep(s => s - 1)} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors">
                <ArrowLeft size={16} /> Back
              </button>
            ) : (
              <Link href="/" className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors"><ArrowLeft size={16} /> Home</Link>
            )}

            {step < 4 ? (
              <button onClick={() => canNext() && setStep(s => s + 1)} disabled={!canNext()} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-sm transition-all ${
                canNext() 
                  ? "bg-gradient-to-r from-[#4f7df3] via-[#4fc3a1] to-[#56c271] text-white shadow-md hover:shadow-lg hover:shadow-blue-300/30" 
                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
              }`}>
                Continue <ArrowRight size={16} />
              </button>
            ) : (
              <button onClick={submit} disabled={submitting} className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-[#4f7df3] via-[#4fc3a1] to-[#56c271] text-white shadow-md hover:shadow-lg hover:shadow-blue-300/40 disabled:opacity-50 transition-all">
                {submitting ? <><Loader2 size={16} className="animate-spin" /> Launching agents...</> : <>{submitButtonText} <ArrowRight size={16} /></>}
              </button>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
}