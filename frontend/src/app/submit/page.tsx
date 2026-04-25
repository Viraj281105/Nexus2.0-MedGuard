"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ShieldCheck, Upload, FileText, ArrowRight, ArrowLeft, Loader2, CheckCircle } from "lucide-react";
import { apiUrl } from "@/lib/api";

export default function SubmitPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [denialFile, setDenialFile] = useState<File | null>(null);
  const [policyFile, setPolicyFile] = useState<File | null>(null);
  const [patientName, setPatientName] = useState("");
  const [insurerName, setInsurerName] = useState("");
  const [procedureDenied, setProcedureDenied] = useState("");
  const [denialDate, setDenialDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canNext = () => {
    if (step === 1) return !!denialFile;
    if (step === 2) return !!policyFile;
    if (step === 3) return patientName.length >= 2 && insurerName.length > 0 && procedureDenied.length > 0;
    return true;
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("denial_pdf", denialFile!);
      formData.append("policy_pdf", policyFile!);
      formData.append("patient_name", patientName);
      formData.append("insurer_name", insurerName);
      formData.append("procedure_denied", procedureDenied);
      formData.append("denial_date", denialDate);
      formData.append("notes", notes);

      let sessionId = "demo_" + Date.now();
      try {
        const res = await fetch(apiUrl("/api/submit"), { method: "POST", body: formData });
        if (res.ok) { const d = await res.json(); sessionId = d.session_id || sessionId; }
      } catch { /* fallback */ }
      router.push(`/case/${sessionId}`);
    } catch { setSubmitting(false); }
  };

  const titles = [
    { t: "Upload Denial Letter", s: "The PDF your insurer sent denying your claim" },
    { t: "Upload Policy Document", s: "Your insurance plan's policy PDF" },
    { t: "Case Details", s: "Tell our AI agents about your case" },
    { t: "Review & Submit", s: "Everything looks good? Let the agents go to work!" },
  ];

  return (
    <div className="min-h-screen flex flex-col items-center p-8 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[var(--color-primary)] opacity-20 blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[var(--color-secondary)] opacity-20 blur-[120px]" />

      <header className="w-full max-w-3xl flex justify-between items-center py-6 z-10">
        <Link href="/" className="flex items-center gap-2">
          <div className="p-2 bg-[var(--color-primary)] rounded-lg text-white"><ShieldCheck size={24} /></div>
          <span className="text-xl font-bold">MedGuard <span className="text-[var(--color-primary)]">AI</span></span>
        </Link>
        <span className="text-sm text-slate-400">Step {step} of 4</span>
      </header>

      <main className="w-full max-w-2xl z-10 flex-1">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                s < step ? "bg-[var(--color-primary)] text-white" :
                s === step ? "bg-[var(--color-primary)] text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]" :
                "bg-white/10 text-slate-400"
              }`}>
                {s < step ? <CheckCircle size={16} /> : s}
              </div>
              {s < 4 && <div className={`w-8 h-0.5 ${s < step ? "bg-[var(--color-primary)]" : "bg-white/10"}`} />}
            </div>
          ))}
        </div>

        <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} className="glass-panel rounded-2xl p-8">
          <h2 className="text-2xl font-bold mb-1">{titles[step - 1].t}</h2>
          <p className="text-slate-400 text-sm mb-6">{titles[step - 1].s}</p>

          {/* Step 1: Denial file */}
          {step === 1 && (
            <label className={`flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${denialFile ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10" : "border-white/20 hover:border-white/40"}`}>
              <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => e.target.files && setDenialFile(e.target.files[0])} />
              {denialFile ? <><FileText size={40} className="text-[var(--color-primary)] mb-3" /><p className="font-medium">{denialFile.name}</p><p className="text-sm text-slate-400 mt-1">Click to change</p></>
               : <><Upload size={40} className="text-slate-400 mb-3" /><p className="font-medium">Drop denial letter here</p><p className="text-sm text-slate-400 mt-1">PDF, PNG, or JPG</p></>}
            </label>
          )}

          {/* Step 2: Policy file */}
          {step === 2 && (
            <label className={`flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${policyFile ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10" : "border-white/20 hover:border-white/40"}`}>
              <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => e.target.files && setPolicyFile(e.target.files[0])} />
              {policyFile ? <><FileText size={40} className="text-[var(--color-primary)] mb-3" /><p className="font-medium">{policyFile.name}</p><p className="text-sm text-slate-400 mt-1">Click to change</p></>
               : <><Upload size={40} className="text-slate-400 mb-3" /><p className="font-medium">Drop policy document here</p><p className="text-sm text-slate-400 mt-1">PDF, PNG, or JPG</p></>}
            </label>
          )}

          {/* Step 3: Details */}
          {step === 3 && (
            <div className="space-y-4">
              {[
                { label: "Patient Name", value: patientName, set: setPatientName, ph: "John Doe", required: true },
                { label: "Insurance Company", value: insurerName, set: setInsurerName, ph: "e.g. UnitedHealthcare", required: true },
                { label: "Procedure Denied", value: procedureDenied, set: setProcedureDenied, ph: "e.g. MRI Lumbar Spine", required: true },
                { label: "Denial Date", value: denialDate, set: setDenialDate, ph: "YYYY-MM-DD", required: false },
              ].map((f) => (
                <div key={f.label}>
                  <label className="block text-sm font-medium text-slate-300 mb-1">{f.label} {f.required && <span className="text-red-400">*</span>}</label>
                  <input value={f.value} onChange={(e) => f.set(e.target.value)} placeholder={f.ph} className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-[var(--color-primary)] transition-colors" />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Additional Notes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Any additional context..." className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-[var(--color-primary)] transition-colors resize-none" />
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div className="space-y-3">
              {[
                { label: "Denial Letter", value: denialFile?.name || "Not uploaded" },
                { label: "Policy Document", value: policyFile?.name || "Not uploaded" },
                { label: "Patient", value: patientName },
                { label: "Insurer", value: insurerName },
                { label: "Procedure", value: procedureDenied },
                { label: "Denial Date", value: denialDate || "—" },
              ].map((r) => (
                <div key={r.label} className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-sm text-slate-400">{r.label}</span>
                  <span className="text-sm font-medium">{r.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between items-center mt-8 pt-4 border-t border-white/10">
            {step > 1 ? (
              <button onClick={() => setStep(s => s - 1)} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
                <ArrowLeft size={16} /> Back
              </button>
            ) : (
              <Link href="/" className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"><ArrowLeft size={16} /> Home</Link>
            )}

            {step < 4 ? (
              <button onClick={() => canNext() && setStep(s => s + 1)} disabled={!canNext()} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-sm transition-all ${
                canNext() ? "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] shadow-[0_0_15px_rgba(16,185,129,0.3)]" : "bg-slate-700 text-slate-400 cursor-not-allowed"
              }`}>
                Continue <ArrowRight size={16} />
              </button>
            ) : (
              <button onClick={submit} disabled={submitting} className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] shadow-[0_0_20px_rgba(16,185,129,0.4)] disabled:opacity-50 transition-all">
                {submitting ? <><Loader2 size={16} className="animate-spin" /> Launching agents...</> : <>Submit Appeal <ArrowRight size={16} /></>}
              </button>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
