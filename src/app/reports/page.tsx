"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface ReportSnippet {
  slug: string;
  title: string;
  published_at: string;
  snippet: string;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportSnippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReports() {
      try {
        const res = await fetch('/api/reports');
        if (!res.ok) throw new Error('Failed to fetch reports');
        const data = await res.json();
        setReports(data.reports || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchReports();
  }, []);

  return (
    <div className="min-h-screen rs-page py-8 sm:py-14 px-4 relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-[6%] left-[20%] w-[420px] h-[420px] rounded-full bg-indigo-500/[0.025] blur-[120px] pointer-events-none" />
      <div className="absolute top-[18%] right-[16%] w-[380px] h-[380px] rounded-full bg-purple-500/[0.025] blur-[120px] pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-8 sm:space-y-10 relative z-10 animate-fade-in">
        <header className="rounded-[1.5rem] sm:rounded-[1.75rem] border border-white/[0.08] bg-[#16181d]/60 px-5 py-8 sm:py-10 text-left shadow-2xl shadow-black/10 sm:px-8 lg:px-10">
          <div className="rs-badge mb-5">
            <span className="rs-badge-dot bg-indigo-400" />
            Market intelligence
          </div>
          <h1 className="max-w-3xl text-3xl sm:text-5xl lg:text-6xl font-semibold mb-5 text-white tracking-[-0.04em] leading-[1.02] text-balance">
            Weekly <span className="gradient-text">Reports</span>
          </h1>
          <p style={{ color: 'var(--rs-text-secondary)' }} className="max-w-3xl text-base sm:text-lg leading-7 sm:leading-8 text-balance">
            Weekly reports on category momentum, competitive movement, and brand visibility across AI-generated recommendations.
          </p>
        </header>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-12 h-12 border-[3px] border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-20 text-red-400 font-medium">⚠️ {error}</div>
        ) : reports.length === 0 ? (
          <div className="text-center py-20 rs-card border-white/[0.06] bg-[#16181d]/50 max-w-lg mx-auto">
            <span className="text-4xl mb-4 block">📭</span>
            <h3 className="text-xl font-bold text-white mb-2">No Reports Available</h3>
            <p className="text-xs sm:text-sm px-6" style={{ color: 'var(--rs-text-muted)' }}>
              The weekly pipeline runs haven&apos;t generated reports yet. Check back shortly.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {reports.map((report, idx) => (
              <Link 
                key={report.slug} 
                href={`/reports/${report.slug}`}
                className="block group"
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                <article className="rs-card h-full p-5 sm:p-6 bg-[#16181d]/70 border-white/[0.08] hover:border-white/[0.16] transition-colors duration-200 backdrop-blur-sm relative overflow-hidden">
                  {/* Styled side stripe */}
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-400 opacity-40 group-hover:opacity-90 transition-opacity duration-200" />
                  
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <div className="rs-badge border-white/[0.08] bg-white/[0.03] text-slate-300 font-bold" style={{ fontSize: '0.7rem' }}>
                      {new Date(report.published_at).toLocaleDateString('en-US', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 bg-white/[0.02] border border-white/[0.04] px-2 py-0.5 rounded">
                      5 Min Read
                    </span>
                  </div>

                  <h2 className="text-xl sm:text-2xl font-bold text-white mb-3 group-hover:text-indigo-300 transition-colors tracking-tight">
                    {report.title}
                  </h2>
                  <p className="leading-relaxed text-xs sm:text-sm" style={{ color: 'var(--rs-text-secondary)' }}>
                    {report.snippet}
                  </p>
                  
                  <div className="mt-6 flex items-center text-xs sm:text-sm font-bold uppercase tracking-wider text-indigo-300 group-hover:text-white transition-colors">
                    <span>Read report</span>
                    <span className="ml-2 transform group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
