"use client";

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Report {
  slug: string;
  title: string;
  content_md: string;
  published_at: string;
}

export default function ReportDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReport() {
      try {
        const res = await fetch(`/api/reports/${slug}`);
        if (!res.ok) throw new Error('Report not found');
        const data = await res.json();
        setReport(data.report);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchReport();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen rs-page flex items-center justify-center">
        <div className="w-12 h-12 border-[3px] rounded-full animate-spin" style={{ borderColor: 'hsl(var(--rs-accent) / 0.3)', borderTopColor: 'hsl(var(--rs-accent))' }} />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen rs-page flex flex-col items-center justify-center text-center px-4">
        <span className="text-4xl mb-4 block">⚠️</span>
        <h1 className="text-2xl font-bold text-white mb-2">Report Not Found</h1>
        <p className="mb-6" style={{ color: 'var(--rs-text-secondary)' }}>The requested report could not be found.</p>
        <Link href="/reports" className="transition-colors" style={{ color: 'hsl(var(--rs-accent))' }}>
          ← Back to Reports
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen rs-page pt-24 pb-16 px-4 relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-[10%] left-[20%] w-[400px] h-[400px] rounded-full bg-indigo-500/[0.02] blur-[120px] pointer-events-none" />
      <div className="absolute top-[35%] right-[20%] w-[350px] h-[350px] rounded-full bg-purple-500/[0.02] blur-[120px] pointer-events-none" />

      <article className="max-w-3xl mx-auto relative z-10 animate-fade-in">
        <Link href="/reports" className="inline-flex items-center text-sm font-bold uppercase tracking-wider transition-colors mb-8 hover:text-indigo-400" style={{ color: 'var(--rs-text-muted)' }}>
          <span className="mr-2">←</span> Back to Reports
        </Link>
        
        <header className="mb-10 pb-10 border-b relative" style={{ borderColor: 'var(--rs-border)' }}>
          <div className="rs-badge mb-6 inline-flex items-center gap-2 border-indigo-500/20 bg-indigo-500/10 text-indigo-400 hover:scale-105 transition-all">
            <span className="rs-badge-dot bg-indigo-400" />
            AI Intelligence Report
          </div>
          <h1 className="text-4xl sm:text-5xl font-black mb-6 leading-[1.15] tracking-tight">
            <span className="gradient-text">{report.title}</span>
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm" style={{ color: 'var(--rs-text-secondary)' }}>
            <time dateTime={report.published_at} className="font-semibold text-white">
              {new Date(report.published_at).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </time>
            <span>•</span>
            <span className="flex items-center gap-1.5 bg-white/[0.03] border border-white/[0.06] px-2.5 py-0.5 rounded-full text-xs font-medium">
              <span className="rs-badge-dot bg-purple-400" />
              AI Generated
            </span>
          </div>
        </header>

        <div className="prose prose-invert max-w-none prose-headings:font-bold prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4 prose-h3:text-xl prose-p:leading-relaxed prose-p:text-slate-300" style={{ color: 'var(--rs-text-secondary)' }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {report.content_md}
          </ReactMarkdown>
        </div>

        {/* Custom Report CTA */}
        <div className="mt-16 p-8 sm:p-10 rs-card text-center border rounded-2xl relative overflow-hidden group transition-all duration-300 hover:border-blue-500/50" style={{ borderColor: 'var(--rs-border)' }}>
           <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 opacity-50 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
           <div className="relative z-10 flex flex-col items-center">
             <div className="w-12 h-12 mb-4 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 text-xl">
               📊
             </div>
             <h3 className="text-2xl font-bold text-white mb-3">Need Deeper Insights?</h3>
             <p className="mb-8 max-w-lg mx-auto text-sm sm:text-base" style={{ color: 'var(--rs-text-secondary)' }}>
                Get a comprehensive, customized AI visibility report tailored specifically to your brand, competitors, and industry niche.
             </p>
             <a 
               href="mailto:hey@rashscore.live?subject=Custom%20Report%20Inquiry" 
               className="inline-flex items-center justify-center px-6 py-3 rounded-lg font-medium transition-all duration-300 bg-white text-black hover:bg-gray-100 hover:scale-105 shadow-lg shadow-white/10"
             >
                Contact for Custom Reports
             </a>
           </div>
        </div>
      </article>
    </div>
  );
}
