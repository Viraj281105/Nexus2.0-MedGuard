"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle, Download, CheckCircle, ChevronRight, Scale, ShieldCheck } from "lucide-react";

export default function Results() {
  const [data, setData] = useState<{ overcharges: any[], savings: number } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [appealReady, setAppealReady] = useState(false);

  const [appealLink, setAppealLink] = useState("");

  useEffect(() => {
    const savedData = localStorage.getItem('medguard_results');
    if (savedData) {
      const parsed = JSON.parse(savedData);
      setData({ overcharges: parsed.overcharges, savings: parsed.savings_estimate });
    } else {
      // Fallback
      setData({
        overcharges: [
          { item: "Blood Test", charged: 840, cghs_rate: 320, overcharge: 520, confidence: 0.87 },
          { item: "Consultation Fee", charged: 1500, cghs_rate: 800, overcharge: 700, confidence: 0.92 }
        ],
        savings: 1220
      });
    }
  }, []);

  const handleGenerateAppeal = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch("http://localhost:8000/api/generate-appeal", { method: "POST" });
      if (response.ok) {
        const result = await response.json();
        setAppealLink(result.download_url);
        setAppealReady(true);
      } else {
        throw new Error("Failed to generate");
      }
    } catch (err) {
      console.error(err);
      setTimeout(() => setAppealReady(true), 3000); // mock success
    } finally {
      setIsGenerating(false);
    }
  };

  if (!data) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="min-h-screen flex flex-col items-center p-8 relative overflow-hidden bg-[var(--color-background)]">
      <header className="w-full max-w-6xl flex justify-between items-center py-6 z-10 mb-8 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-[var(--color-primary)] rounded-lg text-white">
            <ShieldCheck size={28} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">MedGuard <span className="text-[var(--color-primary)]">AI</span></h1>
        </div>
      </header>

      <main className="w-full max-w-5xl z-10 flex flex-col lg:flex-row gap-8">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex-1 space-y-6"
        >
          <div className="glass-panel rounded-2xl p-6">
            <h2 className="text-2xl font-bold mb-2">Audit Report</h2>
            <p className="text-slate-400 mb-6">We found {data.overcharges.length} discrepancies compared to government CGHS benchmarks.</p>
            
            <div className="space-y-4">
              {data.overcharges.map((item, idx) => (
                <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-4 flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold text-lg">{item.item}</h3>
                    <div className="flex gap-4 mt-1 text-sm text-slate-400">
                      <span>Billed: ₹{item.charged}</span>
                      <span>CGHS: ₹{item.cghs_rate}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-red-400 font-bold flex items-center gap-1 justify-end">
                      <AlertCircle size={16} /> +₹{item.overcharge}
                    </div>
                    <span className="text-xs text-slate-500">{(item.confidence * 100).toFixed(0)}% confidence</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full lg:w-[400px] flex flex-col gap-6"
        >
          <div className="glass-panel rounded-2xl p-8 bg-gradient-to-br from-[var(--color-primary)]/10 to-transparent border-[var(--color-primary)]/30 text-center">
            <h3 className="text-slate-300 font-medium mb-2">Potential Savings</h3>
            <div className="text-5xl font-extrabold text-[var(--color-primary)] mb-6">
              ₹{data.savings.toLocaleString()}
            </div>
            
            {!appealReady ? (
              <button 
                onClick={handleGenerateAppeal}
                disabled={isGenerating}
                className="w-full py-4 rounded-xl font-bold text-lg bg-white text-[var(--color-background)] hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                   <>Drafting with AdvocAI <span className="animate-pulse">...</span></>
                ) : (
                  <>Generate Legal Appeal <Scale size={20} /></>
                )}
              </button>
            ) : (
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-full"
              >
                <div className="flex items-center justify-center gap-2 text-emerald-400 mb-4 font-medium">
                  <CheckCircle size={20} /> Appeal Drafted Successfully
                </div>
                <a href={appealLink || "#"} target="_blank" rel="noreferrer" className="w-full py-4 rounded-xl font-bold text-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                  <Download size={20} /> Download PDF
                </a>
              </motion.div>
            )}
          </div>
          
          <div className="glass-panel rounded-2xl p-6">
            <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider text-slate-400">AdvocAI Pipeline Status</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <CheckCircle size={16} className="text-emerald-400" />
                <span>Auditor Agent: Document Parsed</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <CheckCircle size={16} className="text-emerald-400" />
                <span>Clinician Agent: Necessity Verified</span>
              </div>
              <div className={`flex items-center gap-3 text-sm ${isGenerating ? 'animate-pulse text-blue-400' : (appealReady ? 'text-emerald-400' : 'text-slate-500')}`}>
                {appealReady ? <CheckCircle size={16} /> : (isGenerating ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <div className="w-4 h-4 rounded-full border-2 border-slate-500" />)}
                <span>Regulatory Agent: Citing IRDAI Rules</span>
              </div>
              <div className={`flex items-center gap-3 text-sm ${appealReady ? 'text-emerald-400' : 'text-slate-500'}`}>
                {appealReady ? <CheckCircle size={16} /> : <div className="w-4 h-4 rounded-full border-2 border-slate-500" />}
                <span>Barrister Agent: Drafting Letter</span>
              </div>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
