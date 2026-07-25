"use client";

import { useState } from 'react';
import { INDUSTRIES } from '@/lib/industry-data';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Flatten all brands for dropdowns
const ALL_BRANDS = INDUSTRIES.flatMap(i => i.topBrands).sort();

export default function ArenaPage() {
  const [brandA, setBrandA] = useState(ALL_BRANDS[0]);
  const [brandB, setBrandB] = useState(ALL_BRANDS[1]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [results, setResults] = useState<{
    historyA: { score: number; run_date: string; recommendation?: number; sentiment?: number }[];
    historyB: { score: number; run_date: string; recommendation?: number; sentiment?: number }[];
    debateMarkdown: string;
    generatedBy: string;
  } | null>(null);

  async function handleFight() {
    if (brandA === brandB) {
      setError("Please select two different brands.");
      return;
    }
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const res = await fetch(`/api/arena?brandA=${encodeURIComponent(brandA)}&brandB=${encodeURIComponent(brandB)}`);
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch debate');
      }
      
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  // Parse debate sections
  const parsedDebate = results ? parseDebate(results.debateMarkdown, brandA, brandB) : null;

  function parseDebate(markdown: string, _a: string, _b: string) {
    if (!markdown) return null;
    const sections = markdown.split(/(?=###\s+)/g).filter(s => s.trim());
    
    if (sections.length < 3) {
      // Not enough sections to parse reliably
      return null;
    }

    // Extract content from each section (skip the ### header line)
    function extractContent(sec: string): string {
      const trimmed = sec.trim();
      const firstLineEnd = trimmed.indexOf('\n');
      if (firstLineEnd === -1) return '';
      return trimmed.substring(firstLineEnd).trim();
    }

    // Check if a section header contains judge/verdict keywords
    function isJudgeSection(sec: string): boolean {
      const header = sec.split('\n')[0].toLowerCase();
      return header.includes('judge') || header.includes('verdict');
    }

    // Strategy: find the judge section first (usually last), assign others by order
    const judgeIdx = sections.findIndex(isJudgeSection);
    
    if (judgeIdx >= 0) {
      // Judge found — the other two sections are A and B in order
      const nonJudge = sections.filter((_, i) => i !== judgeIdx);
      return {
        agentA: extractContent(nonJudge[0] || ''),
        agentB: extractContent(nonJudge[1] || ''),
        judge: extractContent(sections[judgeIdx])
      };
    }

    // Fallback: assume order is A, B, Judge
    return {
      agentA: extractContent(sections[0]),
      agentB: extractContent(sections[1]),
      judge: extractContent(sections[2])
    };
  }

  // Calculate chart max/min dates
  let maxPoints = 0;
  let avgA = 0;
  let avgB = 0;
  if (results) {
    maxPoints = Math.max(results.historyA.length, results.historyB.length);
    const sumA = results.historyA.reduce((acc, val) => acc + val.score, 0);
    const sumB = results.historyB.reduce((acc, val) => acc + val.score, 0);
    avgA = results.historyA.length ? Math.round(sumA / results.historyA.length) : 0;
    avgB = results.historyB.length ? Math.round(sumB / results.historyB.length) : 0;
  }

  return (
    <div className="relative min-h-screen rs-page pt-28 pb-20 px-4 sm:px-6 overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-[10%] left-[10%] w-[400px] h-[400px] rounded-full bg-blue-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[10%] w-[500px] h-[500px] rounded-full bg-red-500/5 blur-[150px] pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-12 relative z-10">
        <header className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rs-surface border border-rs text-rs-secondary text-[11px] font-bold tracking-widest uppercase mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse shadow-[0_0_8px_#c084fc]" />
            AI Multi-Agent Simulation
          </div>
          <h1 className="text-4xl sm:text-6xl font-black text-rs-primary tracking-tight leading-none">
            Battle Arena
          </h1>
          <p className="max-w-2xl mx-auto text-sm sm:text-base font-light leading-relaxed" style={{ color: 'var(--rs-text-secondary)' }}>
            Compare two brands in a head-to-head visibility debate. Our consensus model analyzes historical visibility metrics and runs a live debate between agent personas.
          </p>
        </header>

        {/* Selection Card */}
        <div className="bg-white/[0.01] backdrop-blur-xl border border-white/[0.05] rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none" />
          
          <div className="grid md:grid-cols-11 items-center gap-8 relative z-10">
            {/* Corner A Select */}
            <div className="md:col-span-5 w-full relative group">
              <label className="block text-xs font-bold uppercase tracking-wider text-blue-400 mb-3 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]" />
                Corner A (Blue Contender)
              </label>
              <div className="relative">
                <select 
                  value={brandA}
                  onChange={(e) => setBrandA(e.target.value)}
                  className="w-full border border-white/10 group-hover:border-blue-500/30 focus:border-blue-500/60 rounded-2xl px-5 py-4 text-white font-semibold text-lg focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-300 appearance-none cursor-pointer"
                  style={{ background: 'var(--rs-bg-base)' }}
                >
                  {ALL_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors" style={{ color: 'var(--rs-text-muted)' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              </div>
            </div>

            {/* VS Badge */}
            <div className="md:col-span-1 flex justify-center">
              <div className="relative w-14 h-14 flex items-center justify-center rounded-full border border-white/10 shadow-lg group" style={{ background: 'var(--rs-bg-elevated)' }}>
                <div className="absolute inset-0 rounded-full blur-sm group-hover:blur-md transition-all duration-300" />
                <span className="text-xl font-black text-rs-muted italic z-10">VS</span>
              </div>
            </div>

            {/* Corner B Select */}
            <div className="md:col-span-5 w-full relative group">
              <label className="block text-xs font-bold uppercase tracking-wider text-red-400 mb-3 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]" />
                Corner B (Red Contender)
              </label>
              <div className="relative">
                <select 
                  value={brandB}
                  onChange={(e) => setBrandB(e.target.value)}
                  className="w-full border border-white/10 group-hover:border-red-500/30 focus:border-red-500/60 rounded-2xl px-5 py-4 text-white font-semibold text-lg focus:ring-4 focus:ring-red-500/10 outline-none transition-all duration-300 appearance-none cursor-pointer"
                  style={{ background: 'var(--rs-bg-base)' }}
                >
                  {ALL_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors" style={{ color: 'var(--rs-text-muted)' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center justify-center gap-3">
            <button 
              onClick={handleFight}
              disabled={loading}
              className="relative px-12 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-base tracking-wider rounded-xl shadow-sm transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 overflow-hidden group"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>SIMULATING DEBATE...</span>
                </>
              ) : (
                <>
                  <span>⚔️</span>
                  <span>INITIATE CLASH</span>
                </>
              )}
            </button>
          </div>
          
          {error && (
            <div className="mt-6 max-w-md mx-auto text-center text-red-400 bg-red-500/10 py-3 px-4 rounded-xl border border-red-500/20 text-sm">
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* Results Area */}
        {results && (
          <div className="grid lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-6 duration-500">
            
            {/* Chart Column */}
            <div className="backdrop-blur-xl border border-white/[0.05] rounded-3xl p-6 sm:p-8 flex flex-col relative overflow-hidden shadow-2xl" style={{ background: 'var(--rs-bg-surface)' }}>
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-indigo-500" />
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                  <h3 className="text-xl font-bold text-white">Score Match-up</h3>
                  <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--rs-text-muted)' }}>HISTORICAL TIMELINE DATA</p>
                </div>
                <div className="flex items-center gap-4 bg-white/[0.02] border border-white/5 rounded-xl px-4 py-2 text-xs font-semibold">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-blue-500 shadow-[0_0_6px_#3b82f6]" />
                    <span style={{ color: 'var(--rs-text-secondary)' }}>{brandA} ({avgA})</span>
                  </div>
                  <div className="h-3 w-px bg-white/10" />
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-red-500 shadow-[0_0_6px_#ef4444]" />
                    <span style={{ color: 'var(--rs-text-secondary)' }}>{brandB} ({avgB})</span>
                  </div>
                </div>
              </div>

              {/* Chart Plot Area */}
              <div className="flex-1 relative h-64 sm:h-80 w-full flex items-end mt-4">
                
                {/* Horizontal Guide Lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                  {[100, 75, 50, 25, 0].map((val) => (
                    <div key={val} className="w-full flex items-center gap-2">
                      <span className="text-[10px] font-mono w-5 text-right" style={{ color: 'var(--rs-text-muted)' }}>{val}</span>
                      <div className="flex-1 border-b border-white/[0.04] border-dashed" />
                    </div>
                  ))}
                </div>

                {/* Bars Container */}
                <div className="w-full h-full flex items-end pl-7 pr-2 z-10 gap-1 sm:gap-2">
                  {Array.from({ length: maxPoints }).map((_, i) => {
                    const ptA = results.historyA[i];
                    const ptB = results.historyB[i];
                    
                    return (
                      <div key={i} className="flex-1 h-[90%] flex flex-col justify-end group/bar relative">
                        {/* Unified Tooltip at column group level */}
                        {(ptA || ptB) && (
                          <div className="absolute -top-20 left-1/2 -translate-x-1/2 border border-purple-500/30 text-white text-[10px] px-3 py-2 rounded-xl opacity-0 group-hover/bar:opacity-100 whitespace-nowrap pointer-events-none z-30 transition-all duration-200 shadow-xl shadow-black/90 font-mono min-w-[130px] flex flex-col gap-1 backdrop-blur-md" style={{ background: 'var(--rs-bg-elevated)' }}>
                            <div className="border-b border-white/[0.06] pb-1 mb-0.5 text-center font-bold" style={{ color: 'var(--rs-text-muted)' }}>
                              {new Date((ptA || ptB)!.run_date).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
                            </div>
                            {ptA && (
                              <div className="flex justify-between items-center gap-4">
                                <span className="text-blue-400 font-semibold">{brandA}</span>
                                <span className="font-bold text-white bg-blue-500/10 px-1.5 py-0.5 rounded">{ptA.score}</span>
                              </div>
                            )}
                            {ptB && (
                              <div className="flex justify-between items-center gap-4">
                                <span className="text-red-400 font-semibold">{brandB}</span>
                                <span className="font-bold text-white bg-red-500/10 px-1.5 py-0.5 rounded">{ptB.score}</span>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="w-full relative h-[95%] flex items-end px-[5%] gap-0.5 sm:gap-1">
                          
                          {/* Bar A */}
                          <div 
                            className="w-1/2 bg-indigo-500/20 hover:bg-indigo-500/40 rounded-t-md transition-all duration-300 relative cursor-pointer border-t border-indigo-500/50"
                            style={{ height: `${ptA ? ptA.score : 0}%` }}
                          />

                          {/* Bar B */}
                          <div 
                            className="w-1/2 bg-indigo-500/20 hover:bg-indigo-500/40 rounded-t-md transition-all duration-300 relative cursor-pointer border-t border-indigo-500/50"
                            style={{ height: `${ptB ? ptB.score : 0}%` }}
                          />

                        </div>
                        <div className="h-6 mt-3 border-t border-white/[0.05] w-full flex justify-center pt-2">
                          <span className="text-[9px] font-mono truncate max-w-full" style={{ color: 'var(--rs-text-muted)' }}>
                            {ptA?.run_date ? new Date(ptA.run_date).toLocaleDateString(undefined, {month: 'short', day: 'numeric'}) : ''}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>

              {/* Quick Insight Bar */}
              <div className="mt-8 pt-6 border-t border-white/[0.05] flex items-center gap-3 text-xs font-mono" style={{ color: 'var(--rs-text-secondary)' }}>
                <span className="uppercase tracking-wider">Verdict Advantage:</span>
                {avgA === avgB ? (
                  <span className="text-purple-400 font-bold bg-purple-500/10 px-2.5 py-1 border border-purple-500/20 rounded-lg">DRAW</span>
                ) : avgA > avgB ? (
                  <span className="text-blue-400 font-bold bg-blue-500/10 px-2.5 py-1 border border-blue-500/20 rounded-lg">+{avgA - avgB} PTS ({brandA})</span>
                ) : (
                  <span className="text-red-400 font-bold bg-red-500/10 px-2.5 py-1 border border-red-500/20 rounded-lg">+{avgB - avgA} PTS ({brandB})</span>
                )}
              </div>
            </div>

            {/* Debate Column */}
            <div className="backdrop-blur-xl border border-white/[0.05] rounded-3xl p-6 sm:p-8 flex flex-col shadow-2xl relative" style={{ background: 'var(--rs-bg-surface)' }}>
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-indigo-500" />
              
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white">Simulation Verdict</h3>
                  <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--rs-text-muted)' }}>AGENT DEBATE transcript</p>
                </div>
                <span className="text-[10px] bg-white/[0.02] border border-white/5 rounded px-2.5 py-1 font-mono uppercase tracking-wider" style={{ color: 'var(--rs-text-muted)' }}>
                  Model: {results.generatedBy}
                </span>
              </div>
              
              <div className="flex-1 overflow-y-auto max-h-[400px] pr-2 space-y-6">
                {parsedDebate ? (
                  <>
                    {/* Agent A Card */}
                    <div className="bg-blue-500/[0.02] border border-blue-500/10 rounded-2xl p-4 space-y-2 relative">
                      <div className="absolute -top-2.5 left-4 px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-wider rounded">
                        Agent Pro-{brandA}
                      </div>
                      <div className="prose prose-sm prose-invert max-w-none font-light leading-relaxed pt-1" style={{ color: 'var(--rs-text-secondary)' }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {parsedDebate.agentA}
                        </ReactMarkdown>
                      </div>
                    </div>

                    {/* Agent B Card */}
                    <div className="bg-red-500/[0.02] border border-red-500/10 rounded-2xl p-4 space-y-2 relative">
                      <div className="absolute -top-2.5 left-4 px-2 py-0.5 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-wider rounded">
                        Agent Pro-{brandB}
                      </div>
                      <div className="prose prose-sm prose-invert max-w-none font-light leading-relaxed pt-1" style={{ color: 'var(--rs-text-secondary)' }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {parsedDebate.agentB}
                        </ReactMarkdown>
                      </div>
                    </div>

                    {/* The Judge's Verdict Card */}
                    <div className="bg-rs-surface border border-rs rounded-xl p-5 space-y-2 relative shadow-sm">
                      <div className="absolute -top-2.5 left-4 px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[10px] font-black uppercase tracking-wider rounded flex items-center gap-1">
                        <span>⚖️</span> The Judge's Verdict
                      </div>
                      <div className="prose prose-sm prose-invert max-w-none text-purple-200/90 font-medium leading-relaxed pt-1">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {parsedDebate.judge}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </>
                ) : (
                  // Fallback if parsing failed
                  <div className="prose prose-invert prose-blue max-w-none prose-headings:font-bold prose-h3:text-lg prose-p:leading-relaxed" style={{ color: 'var(--rs-text-secondary)' }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {results.debateMarkdown}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
