"use client";

import { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function RashEngineButton({ brand, industry }: { brand: string, industry: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<string | null>(null);
  const [generatedBy, setGeneratedBy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [diagnosticStep, setDiagnosticStep] = useState(0);

  const diagnosticSteps = [
    "Compiling current LLM prompt visibility metrics...",
    "Scanning competitive brand share-of-voice indices...",
    "Analyzing sentiment alignment anomalies...",
    "Synthesizing customized LLMO action steps..."
  ];

  // Diagnostic step animation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      setDiagnosticStep(0);
      interval = setInterval(() => {
        setDiagnosticStep(prev => (prev < 3 ? prev + 1 : prev));
      }, 1200);
    }
    return () => clearInterval(interval);
  }, [loading]);

  // Close on Escape key
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen && !loading) {
        setIsOpen(false);
      }
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, loading]);

  const fetchPlan = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPlan(null);
    setGeneratedBy(null);
    try {
      const res = await fetch(`/api/rs?brand=${encodeURIComponent(brand)}&industry=${encodeURIComponent(industry)}`);
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to generate plan');
      
      setPlan(data.plan);
      setGeneratedBy(data.generatedBy);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [brand, industry]);

  async function handleGenerate() {
    setIsOpen(true);
    if (plan) return; // Already generated — just re-open the modal
    await fetchPlan();
  }

  async function handleRegenerate() {
    await fetchPlan();
  }

  return (
    <>
      <button 
        onClick={handleGenerate}
        className="group relative mt-6 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-sm transition-all duration-300 active:scale-95 flex items-center gap-2.5 w-max overflow-hidden"
      >
        <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4 text-purple-200 group-hover:animate-bounce">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
        <span>LAUNCH rAsh ENGINE</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md" onClick={() => !loading && setIsOpen(false)}>
          <div className="bg-[#08080e]/95 border border-white/10 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-[0_0_50px_rgba(168,85,247,0.15)] overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-white/[0.08] flex justify-between items-center bg-white/[0.01]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-5 h-5 text-white">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-wide">rAsh LLM Optimization Engine</h3>
                  <p className="text-[10px] font-mono" style={{ color: 'var(--rs-text-muted)' }}>STRATEGY FORMULATION FOR {brand.toUpperCase()}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)} 
                className="hover:text-white p-2 hover:bg-white/5 rounded-full transition-colors"
                style={{ color: 'var(--rs-text-secondary)' }}
                aria-label="Close modal"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 sm:p-8 overflow-y-auto flex-1 bg-rs-base">
              {loading && (
                <div className="flex flex-col py-12 px-4 space-y-6">
                  {/* Glowing spinner */}
                  <div className="flex justify-center">
                    <div className="relative w-14 h-14">
                      <div className="absolute inset-0 rounded-full border-4 border-purple-500/20" />
                      <div className="absolute inset-0 rounded-full border-4 border-t-purple-500 animate-spin" />
                    </div>
                  </div>
                  
                  {/* Diagnostics status messages */}
                  <div className="max-w-md mx-auto w-full bg-white/[0.01] border border-white/[0.05] rounded-2xl p-5 space-y-3 font-mono text-xs shadow-inner">
                    {diagnosticSteps.map((step, idx) => {
                      const isPending = idx > diagnosticStep;
                      const isActive = idx === diagnosticStep;
                      
                      return (
                        <div key={idx} className="flex items-center gap-3 transition-opacity duration-300">
                          {isPending ? (
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-700" />
                          ) : isActive ? (
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-ping" />
                          ) : (
                            <span className="text-green-500 font-bold">✓</span>
                          )}
                          <span className={
                            isPending ? '' : isActive ? 'font-bold' : ''
                          } style={{
                            color: isPending ? 'var(--rs-text-faint)' : isActive ? 'hsl(var(--rs-accent))' : 'var(--rs-text-secondary)'
                          }}>
                            {step}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl text-xs font-mono">
                  ⚠️ DIAGNOSTIC ERROR: {error}
                </div>
              )}

              {plan && (
                <div className="prose prose-sm prose-invert prose-purple max-w-none space-y-6 font-light leading-relaxed prose-headings:font-bold prose-h3:text-purple-400" style={{ color: 'var(--rs-text-secondary)' }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {plan}
                  </ReactMarkdown>
                  
                  <div className="mt-8 pt-4 border-t border-white/[0.05] flex items-center justify-between">
                    {generatedBy && (
                      <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: 'var(--rs-text-muted)' }}>
                        Generated by {generatedBy}
                      </span>
                    )}
                    <button
                      onClick={handleRegenerate}
                      disabled={loading}
                      className="ml-auto px-4 py-2 bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 hover:border-purple-500/30 hover:text-purple-300 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all duration-200 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ color: 'var(--rs-text-secondary)' }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-3 h-3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                      </svg>
                      Regenerate
                    </button>
                  </div>
                </div>
              )}
            </div>
            
          </div>
        </div>
      )}
    </>
  );
}
