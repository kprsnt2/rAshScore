"use client";

import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { INDUSTRIES } from '@/lib/industry-data';
import BrandLogo from '@/components/BrandLogo';
import Link from 'next/link';
import { scoreColor, scoreGradient } from '@/lib/ui-utils';

interface BrandData {
  brand: string;
  score: number;
  breakdown: { recommendation: number; sentiment: number; prominence: number; accuracy: number };
  rank: number;
  scoreChange: number | null;
  rankChange: number | null;
}

interface IndustryResponse {
  industry: { id: string; name: string; category: string };
  brands: BrandData[];
  industryAverage: { score: number; recommendation: number; sentiment: number; prominence: number; accuracy: number };
  availableModels: string[];
  selectedModel: string;
  totalBrands: number;
  runDate: string;
  timestamp: string;
}

interface InsightResponse {
  industryId: string;
  insight: string | null;
  generatedBy?: string;
  date?: string;
  isToday?: boolean;
  staleWarning?: string | null;
  message?: string;
}

interface TimelineEntry { date: string; score: number; rank: number }
interface TimelineResponse {
  dates: string[];
  brands: { [brand: string]: TimelineEntry[] };
}

// Brand colors for chart lines
const CHART_COLORS = [
  '#22d3ee', '#a78bfa', '#f472b6', '#34d399', '#fbbf24',
  '#fb923c', '#60a5fa', '#e879f9', '#4ade80', '#f87171',
];

/** Map raw model strings to clean display names */
function getModelDisplayName(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes('grok')) return 'Grok';
  if (s.includes('gpt') || s.includes('openai')) return 'ChatGPT';
  if (s.includes('gemini')) return 'Gemini';
  if (s.includes('claude') || s.includes('anthropic')) return 'Claude';
  if (s.includes('llama') || s.includes('groq')) return 'Groq';
  if (s.includes('deepseek')) return 'DeepSeek';
  if (s.includes('mistral')) return 'Mistral';
  if (s.includes('nvidia') || s.includes('nemotron')) return 'NVIDIA';
  if (s.includes('minimax')) return 'MiniMax';
  return raw;
}



// ========== SVG Line Chart Component ==========
function TimelineChart({ data, brands, dates }: { data: { [brand: string]: TimelineEntry[] }; brands: string[]; dates: string[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; brand: string; score: number; date: string } | null>(null);

  if (dates.length === 0 || brands.length === 0) return null;

  if (dates.length <= 1) {
    return (
      <div className="flex flex-col items-center justify-center h-[260px] border border-dashed rounded-xl" style={{ borderColor: 'var(--rs-border-hover)', background: 'var(--rs-bg-surface)' }}>
        <span className="px-3 py-1 bg-purple-500/20 text-purple-300 text-xs font-semibold rounded-full mb-3 uppercase tracking-widest border border-purple-500/30">New Industry</span>
        <p className="text-sm" style={{ color: 'var(--rs-text-secondary)' }}>Historical trends will appear after the next pipeline run.</p>
      </div>
    );
  }

  const W = 900, H = 260;
  const PAD = { top: 20, right: 20, bottom: 35, left: 40 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  // Score range
  const allScores = brands.flatMap(b => (data[b] || []).map(e => e.score));
  const minScore = Math.max(0, Math.min(...allScores) - 5);
  const maxScore = Math.min(100, Math.max(...allScores) + 5);
  const scoreRange = maxScore - minScore || 1;

  const xScale = (i: number) => PAD.left + (dates.length === 1 ? chartW / 2 : (i / (dates.length - 1)) * chartW);
  const yScale = (v: number) => PAD.top + chartH - ((v - minScore) / scoreRange) * chartH;

  // Y-axis ticks
  const yTicks: number[] = [];
  const step = scoreRange <= 20 ? 5 : scoreRange <= 50 ? 10 : 20;
  for (let v = Math.ceil(minScore / step) * step; v <= maxScore; v += step) yTicks.push(v);

  return (
    <div ref={containerRef} className="relative" role="region" aria-label="Score Trend Timeline Chart">
      {/* Invisible semantic data for LLMs */}
      <div className="sr-only">
        {dates.map(d => `Date: ${d}. ` + brands.slice(0, 5).map(b => {
          const entry = data[b]?.find(e => e.date === d);
          return entry ? `${b}: ${entry.score}` : '';
        }).filter(Boolean).join(', ')).join(' | ')}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ minHeight: 200 }} aria-hidden="true">
        {/* Grid lines */}
        {yTicks.map(v => (
          <g key={v}>
            <line x1={PAD.left} y1={yScale(v)} x2={W - PAD.right} y2={yScale(v)} stroke="rgba(255,255,255,0.04)" />
            <text x={PAD.left - 8} y={yScale(v) + 4} textAnchor="end" fill="rgba(255,255,255,0.25)" fontSize="10">{v}</text>
          </g>
        ))}

        {/* X-axis labels */}
        {dates.map((d, i) => {
          // Show label if it's first, last, or every 6th date
          const showLabel = i === 0 || i === dates.length - 1 || i % 6 === 0;
          if (!showLabel) return null;
          return (
            <text key={d} x={xScale(i)} y={H - 8} textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize="10">
              {new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
            </text>
          );
        })}

        {/* Lines + dots for each brand */}
        {brands.slice(0, 5).map((brand, bi) => {
          const entries = data[brand] || [];
          const color = CHART_COLORS[bi % CHART_COLORS.length];
          const points = dates.map((d, di) => {
            const e = entries.find(e => e.date === d);
            return e ? { x: xScale(di), y: yScale(e.score), score: e.score, date: d } : null;
          }).filter(Boolean) as { x: number; y: number; score: number; date: string }[];

          if (points.length === 0) return null;

          const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

          return (
            <g key={brand}>
              {/* Line */}
              <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              {/* Dots */}
              {points.map((p, pi) => (
                <circle
                  key={pi} cx={p.x} cy={p.y} r="4" fill={color} stroke="#0a0a0f" strokeWidth="2"
                  className="cursor-pointer" style={{ stroke: 'var(--rs-bg-base)' }}
                  onMouseEnter={() => setTooltip({ x: p.x, y: p.y, brand, score: p.score, date: p.date })}
                  onMouseLeave={() => setTooltip(null)}
                />
              ))}
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none rounded-lg px-3 py-2 text-xs shadow-xl z-10"
          style={{ background: 'var(--rs-bg-elevated)', border: '1px solid var(--rs-border-hover)', left: `${(tooltip.x / W) * 100}%`, top: `${(tooltip.y / H) * 100 - 15}%`, transform: 'translate(-50%, -100%)' }}
        >
          <div style={{ color: 'var(--rs-text-secondary)' }}>{new Date(tooltip.date + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
          <div className="text-white font-semibold">{tooltip.brand}: {tooltip.score}</div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 px-1">
        {brands.slice(0, 5).map((b, i) => (
          <div key={b} className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--rs-text-secondary)' }}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
            {b}
          </div>
        ))}
      </div>
    </div>
  );
}

// ========== Score Breakdown Stacked Chart ==========
function ScoreBreakdownChart({ brands }: { brands: BrandData[] }) {
  const top3 = brands.slice(0, 3);
  if (top3.length === 0) return null;

  return (
    <div className="space-y-4" role="region" aria-label="Score Breakdown Top 3 Brands">
      {/* Hidden semantic text for LLMs and Screen Readers */}
      <div className="sr-only">
        {top3.map(b => `Brand: ${b.brand}. Total Score: ${b.score}. Breakdown: Recommendation ${Math.round(b.breakdown.recommendation)} out of 40, Sentiment ${Math.round(b.breakdown.sentiment)} out of 30, Prominence ${Math.round(b.breakdown.prominence)} out of 20, Accuracy ${Math.round(b.breakdown.accuracy)} out of 10. `).join(' | ')}
      </div>
      {top3.map((brand, index) => {
        const barColors = ['#22d3ee', '#a78bfa', '#f472b6'];
        const c = barColors[index];
        return (
          <div key={brand.brand} className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
            <div className="flex justify-between items-center sm:w-52 shrink-0">
              <div className="flex items-center gap-2 min-w-0"><BrandLogo brand={brand.brand} size={20} rank={index} /><span className="text-xs pr-2 truncate font-medium" style={{ color: 'var(--rs-text-secondary)' }}>{brand.brand}</span></div>
              <span className="text-sm font-bold sm:hidden tabular-nums" style={{ color: scoreColor(brand.score) }}>{brand.score}</span>
            </div>
            <div className="flex-1 flex gap-[2px] h-3 rounded-full overflow-hidden bg-white/[0.03] w-full">
              <div className="rounded-l-full transition-all duration-500 hover:brightness-125 cursor-help" style={{ width: `${(brand.breakdown.recommendation / 40) * 100}%`, backgroundColor: c, opacity: 1 }} title={`Recommendation: ${Math.round(brand.breakdown.recommendation)}/40`} />
              <div className="transition-all duration-500 hover:brightness-125 cursor-help" style={{ width: `${(brand.breakdown.sentiment / 30) * 100}%`, backgroundColor: c, opacity: 0.65 }} title={`Sentiment: ${Math.round(brand.breakdown.sentiment)}/30`} />
              <div className="transition-all duration-500 hover:brightness-125 cursor-help" style={{ width: `${(brand.breakdown.prominence / 20) * 100}%`, backgroundColor: c, opacity: 0.4 }} title={`Prominence: ${Math.round(brand.breakdown.prominence)}/20`} />
              <div className="rounded-r-full transition-all duration-500 hover:brightness-125 cursor-help" style={{ width: `${(brand.breakdown.accuracy / 10) * 100}%`, backgroundColor: c, opacity: 0.2 }} title={`Accuracy: ${Math.round(brand.breakdown.accuracy)}/10`} />
            </div>
            <span className="text-sm font-bold w-12 text-right tabular-nums hidden sm:block" style={{ color: scoreColor(brand.score) }}>{brand.score}</span>
          </div>
        );
      })}
      <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4 text-[10px] tracking-wide pt-2" style={{ color: 'var(--rs-text-secondary)' }}>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{backgroundColor: '#22d3ee', opacity:1}}></span> Recommendation</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{backgroundColor: '#22d3ee', opacity:0.65}}></span> Sentiment</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{backgroundColor: '#22d3ee', opacity:0.4}}></span> Prominence</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{backgroundColor: '#22d3ee', opacity:0.25}}></span> Accuracy</span>
      </div>
    </div>
  );
}

// ========== AI Insight Card ==========
interface AIInsightCardProps {
  insight: {
    industryId: string;
    insight: string | null;
    generatedBy?: string;
    date?: string;
    isToday?: boolean;
    staleWarning?: string | null;
    message?: string;
  } | null;
  loading: boolean;
  industryName: string;
}

function AIInsightCard({ insight, loading, industryName }: AIInsightCardProps) {
  if (loading) {
    return (
      <div className="rs-card rounded-xl p-5 mb-8 animate-pulse" style={{ borderColor: 'rgba(var(--rs-accent-rgb), 0.1)' }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-4 h-4 rounded-full bg-primary-500/20" />
          <div className="h-3 w-32 bg-white/[0.06] rounded" />
          <div className="ml-auto h-3 w-16 bg-white/[0.04] rounded" />
        </div>
        <div className="space-y-2.5">
          <div className="h-3 bg-white/[0.04] rounded w-full" />
          <div className="h-3 bg-white/[0.04] rounded w-[90%]" />
          <div className="h-3 bg-white/[0.04] rounded w-[95%]" />
          <div className="h-3 bg-white/[0.04] rounded w-[80%]" />
        </div>
      </div>
    );
  }

  // No insight at all
  if (!insight || !insight.insight) {
    return (
      <div className="rounded-xl border border-dashed px-5 py-4 mb-8 flex items-center gap-3" style={{ borderColor: 'var(--rs-border)', background: 'var(--rs-bg-surface)' }}>
        <span className="text-lg">🤖</span>
        <p className="text-xs" style={{ color: 'var(--rs-text-muted)' }}>
          {insight?.message || 'AI insights generate daily after the pipeline run.'}
        </p>
      </div>
    );
  }

  // Parse bullet points from the insight text
  const bullets = insight.insight
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  const modelLabel = insight.generatedBy ? getModelDisplayName(insight.generatedBy) : 'AI';

  const dateLabel = insight.date
    ? new Date(insight.date + 'T00:00:00').toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
      })
    : null;

  return (
    <div className="rs-card p-5 mb-8 relative overflow-hidden" style={{ borderColor: 'rgba(var(--rs-accent-rgb), 0.12)', background: 'linear-gradient(135deg, rgba(var(--rs-accent-rgb), 0.03), rgba(139,92,246,0.02))' }}>
      {/* Subtle glow */}
      <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl pointer-events-none" style={{ background: 'rgba(var(--rs-accent-rgb), 0.05)' }} />

      {/* Header */}
      <div className="relative flex items-center gap-2.5 mb-4 flex-wrap">
        <span className="text-base">🤖</span>
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: 'var(--rs-text-secondary)' }}>
          AI Insight · {industryName}
        </h3>
        <div className="ml-auto flex items-center gap-2">
          {/* Stale warning badge */}
          {insight.staleWarning && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[9px] text-amber-400 font-medium">
              ⚠️ Not today
            </span>
          )}
          {/* Model badge */}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.07] text-[9px] font-medium" style={{ color: 'var(--rs-text-muted)' }}>
            ✨ {modelLabel}
          </span>
        </div>
      </div>

      {/* Stale warning message */}
      {insight.staleWarning && (
        <p className="text-[10px] text-amber-500/70 mb-3 leading-relaxed">
          {insight.staleWarning}
        </p>
      )}

      {/* Bullet Points */}
      <ul className="relative space-y-2.5">
        {bullets.map((bullet, i) => (
          <li key={i} className="text-sm leading-relaxed" style={{ color: 'var(--rs-text-secondary)' }}>
            {bullet}
          </li>
        ))}
      </ul>

      {/* Footer */}
      {dateLabel && (
        <p className="relative text-[10px] mt-4 pt-3 border-t border-white/[0.04]" style={{ color: 'var(--rs-text-muted)' }}>
          Generated {insight.isToday ? 'today' : 'on'} · {dateLabel}
        </p>
      )}
    </div>
  );
}

// ========== Main Dashboard ==========
function DashboardInner() {
  const [industryData, setIndustryData] = useState<IndustryResponse | null>(null);
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const [selectedIndustry, setSelectedIndustry] = useState<string>(
    searchParams.get('industry') || 'technology'
  );
  const [selectedModel, setSelectedModel] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [compareMode, setCompareMode] = useState(false);
  const [brand1, setBrand1] = useState<string>('');
  const [brand2, setBrand2] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [insight, setInsight] = useState<InsightResponse | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const delay = setTimeout(async () => {
      try {
        const res = await fetch(`/api/brands/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results || []);
        }
      } catch (e) {}
    }, 300);
    return () => clearTimeout(delay);
  }, [searchQuery]);

  const handleShare = () => {
    if (!industryData) return;
    const industryMeta = INDUSTRIES.find(i => i.id === selectedIndustry);
    const top3Text = industryData.brands.slice(0, 3).map((b, i) => `${i+1}. ${b.brand} (${b.score})`).join('\n');
    const url = `${window.location.origin}/dashboard?industry=${selectedIndustry}`;
    const text = `🏆 Top 3 ${industryMeta?.name} Brands in India AI Search:\n\n${top3Text}\n\n📊 ${url}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Fetch brand data when industry or model changes
  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      setLoading(true);
      try {
        const [brandsRes, timelineRes] = await Promise.all([
          fetch(`/api/brands?industry=${selectedIndustry}&model=${encodeURIComponent(selectedModel)}&top=10`),
          fetch(`/api/brands/timeline?industry=${selectedIndustry}`),
        ]);

        if (!cancelled && brandsRes.ok) {
          setIndustryData(await brandsRes.json());
        }
        if (!cancelled && timelineRes.ok) {
          setTimeline(await timelineRes.json());
        }
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, [selectedIndustry, selectedModel]);

  // Fetch AI insight when industry changes
  useEffect(() => {
    let cancelled = false;
    async function fetchInsight() {
      setInsightLoading(true);
      setInsight(null);
      try {
        const res = await fetch(`/api/brands/insights?industry=${selectedIndustry}`);
        if (!cancelled && res.ok) {
          setInsight(await res.json());
        }
      } catch (err) {
        console.error('Failed to fetch insight:', err);
      } finally {
        if (!cancelled) setInsightLoading(false);
      }
    }
    fetchInsight();
    return () => { cancelled = true; };
  }, [selectedIndustry]);

  const rankedBrands = industryData?.brands || [];
  const top3 = rankedBrands.slice(0, 3);
  const industryMeta = INDUSTRIES.find(i => i.id === selectedIndustry);
  const lastUpdated = industryData?.timestamp ? new Date(industryData.timestamp) : null;
  const filteredTimeline = useMemo(() => {
    if (!timeline) return null;
    const dates = timeline.dates || [];
    const last30Dates = dates.slice(-30);
    const dateSet = new Set(last30Dates);
    
    const brands: { [brand: string]: TimelineEntry[] } = {};
    for (const [brand, entries] of Object.entries(timeline.brands || {})) {
      brands[brand] = entries.filter(e => dateSet.has(e.date));
    }
    
    return {
      dates: last30Dates,
      brands
    };
  }, [timeline]);

  const timelineBrands = filteredTimeline?.brands || {};
  const timelineDates = filteredTimeline?.dates || [];

  if (loading && !industryData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 border-[3px] border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-6"></div>
          <p className="text-sm" style={{ color: 'var(--rs-text-muted)' }}>Loading India rAsh Index...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rs-page">
      {/* Hero */}
      <section className="rs-hero">


        <div className="max-w-5xl mx-auto px-4 text-center relative z-10">
          <div className="rs-badge mb-6">
            <span className="rs-badge-dot"></span>
            India rAsh Index
          </div>
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold text-white mb-4 leading-[1.1] tracking-tight">
            See who is winning<br />
            <span className="text-indigo-400">AI Search in India</span>
          </h1>
          <p className="text-base sm:text-lg max-w-xl mx-auto leading-relaxed" style={{ color: 'var(--rs-text-secondary)' }}>
            AI visibility rankings for top Indian brands across 19 industries.
          </p>
          {lastUpdated && (
            <p className="text-xs mt-5" style={{ color: 'var(--rs-text-faint)' }}>
              Last updated {lastUpdated.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          )}
        </div>
      </section>

      {/* Filters */}
      <section className="rs-filter-bar">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0 w-full md:w-auto">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium text-white whitespace-nowrap">
                Top <span className="text-primary-400">{industryMeta?.name}</span> brands
              </h2>
              <span className="text-xs hidden sm:inline" style={{ color: 'var(--rs-text-muted)' }}>· Top 10</span>
            </div>
            
            <button onClick={handleShare} className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.05] rounded-lg text-xs font-medium transition-colors" style={{ color: 'var(--rs-text-secondary)' }}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-5.368m0 5.368l5.662 3.397m-5.662-3.397a3 3 0 110-5.368m0 5.368l5.662-3.397" /></svg>
              {copied ? "? Copied!" : "Share"}
            </button>
            {copied && (
              <span className="text-[11px] text-emerald-400 font-medium animate-pulse">Copied to clipboard!</span>
            )}
            <button onClick={() => setCompareMode(!compareMode)} className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-medium transition-colors ${compareMode ? 'bg-primary-500/20 text-primary-400 border-primary-500/30' : 'bg-white/[0.05] hover:bg-white/[0.1] border-white/[0.05]'}`} style={!compareMode ? { color: 'var(--rs-text-secondary)' } : undefined}>
              ⚔️ Compare
            </button>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-48">
              <input
                type="text"
                placeholder="Search brands..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500/50"
                style={{ color: 'var(--rs-text-secondary)' }}
              />
              {searchQuery.length >= 2 && (
                <div className="absolute top-full left-0 right-0 mt-1 rounded-lg shadow-xl overflow-hidden z-50" style={{ background: 'var(--rs-bg-elevated)', border: '1px solid var(--rs-border-hover)' }}>
                  {searchResults.length > 0 ? (
                    <>
                      {searchResults.map(res => (
                        <Link key={res.brand + res.industry_id} href={`/brand/${encodeURIComponent(res.brand)}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 text-sm transition-colors" style={{ color: 'var(--rs-text-secondary)' }}>
                          <BrandLogo brand={res.brand} size={20} />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-white truncate">{res.brand}</div>
                            <div className="text-xs flex justify-between mt-0.5" style={{ color: 'var(--rs-text-muted)' }}>
                              <span>{INDUSTRIES.find(i => i.id === res.industry_id)?.name || res.industry_id}</span>
                              <span className="text-primary-400 font-medium">{res.score}/100</span>
                            </div>
                          </div>
                        </Link>
                      ))}
                      <Link href={`/?brand=${encodeURIComponent(searchQuery)}`} className="flex items-center gap-2 px-4 py-2.5 border-t border-white/[0.06] hover:bg-primary-500/10 text-xs hover:text-primary-400 transition-colors" style={{ color: 'var(--rs-text-muted)' }}>
                        <span>🤖</span>
                        <span>Analyze &quot;{searchQuery}&quot; with AI →</span>
                      </Link>
                    </>
                  ) : (
                    <div className="px-4 py-3">
                      <p className="text-xs mb-2" style={{ color: 'var(--rs-text-muted)' }}>No brands found in database</p>
                      <Link href={`/?brand=${encodeURIComponent(searchQuery)}`} className="flex items-center gap-2 text-sm text-primary-400 hover:text-primary-300 font-medium transition-colors">
                        <span>🤖</span>
                        <span>Analyze &quot;{searchQuery}&quot; with AI →</span>
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="relative flex-none hidden sm:block">
              <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)}
                className="appearance-none bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 pr-8 text-sm w-full cursor-pointer hover:bg-white/[0.07] transition-all focus:outline-none focus:ring-1 focus:ring-primary-500/50" style={{ color: 'var(--rs-text-secondary)' }}>
                <option value="all" className="bg-rs-elevated text-white">All Models</option>
                {(industryData?.availableModels || []).map(m => <option key={m} value={m} className="bg-rs-elevated text-white">{getModelDisplayName(m)}</option>)}
              </select>
              <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: 'var(--rs-text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
            <div className="relative flex-none">
              <select value={selectedIndustry} onChange={e => { setSelectedIndustry(e.target.value); setSelectedModel('all'); router.replace('/dashboard?industry=' + e.target.value, { scroll: false }); }}
                className="appearance-none bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 pr-8 text-sm w-full cursor-pointer hover:bg-white/[0.07] transition-all focus:outline-none focus:ring-1 focus:ring-primary-500/50" style={{ color: 'var(--rs-text-secondary)' }}>
                {INDUSTRIES.map(i => <option key={i.id} value={i.id} className="bg-rs-elevated text-white">{i.name}</option>)}
              </select>
              <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: 'var(--rs-text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <main id="main-content" className="max-w-7xl mx-auto px-4 py-8">
        {!industryData || rankedBrands.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-5">
              <span className="text-3xl">📊</span>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">No data available</h2>
            <p className="text-sm max-w-sm mx-auto" style={{ color: 'var(--rs-text-muted)' }}>Pipeline hasn&apos;t run yet for this industry.</p>
          </div>
        ) : (
          <>
            {compareMode && rankedBrands.length >= 2 && (
              <div className="rs-card mb-8 p-5" style={{ borderColor: 'rgba(var(--rs-accent-rgb), 0.15)' }}>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <select className="flex-1 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary-500" style={{ background: 'var(--rs-bg-elevated)', border: '1px solid var(--rs-border-hover)' }}
                    value={brand1} onChange={e => setBrand1(e.target.value)}>
                    <option value="">Select Brand 1</option>
                    {rankedBrands.map(b => <option key={b.brand} value={b.brand}>{b.brand} (Score: {b.score})</option>)}
                  </select>
                  <span className="font-bold italic text-xl" style={{ color: 'var(--rs-text-muted)' }}>VS</span>
                  <select className="flex-1 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary-500" style={{ background: 'var(--rs-bg-elevated)', border: '1px solid var(--rs-border-hover)' }}
                    value={brand2} onChange={e => setBrand2(e.target.value)}>
                    <option value="">Select Brand 2</option>
                    {rankedBrands.map(b => <option key={b.brand} value={b.brand}>{b.brand} (Score: {b.score})</option>)}
                  </select>
                </div>
                {brand1 && brand2 && brand1 !== brand2 && (() => {
                  const b1 = rankedBrands.find(b => b.brand === brand1)!;
                  const b2 = rankedBrands.find(b => b.brand === brand2)!;
                  if (!b1 || !b2) return null;
                  const diff = b1.score - b2.score;
                  const metrics = [
                    { label: 'Recommendation', key: 'recommendation' as const, max: 40, color1: '#22d3ee', color2: '#a78bfa' },
                    { label: 'Sentiment', key: 'sentiment' as const, max: 30, color1: '#22d3ee', color2: '#a78bfa' },
                    { label: 'Prominence', key: 'prominence' as const, max: 20, color1: '#22d3ee', color2: '#a78bfa' },
                    { label: 'Accuracy', key: 'accuracy' as const, max: 10, color1: '#22d3ee', color2: '#a78bfa' },
                  ];
                  return (
                    <div className="mt-6 pt-6 border-t border-white/5">
                      {/* Score advantage badge */}
                      <div className="text-center mb-6">
                        <div className="inline-block px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm font-medium">
                          Advantage: <span className={diff > 0 ? 'text-primary-400' : diff < 0 ? 'text-purple-400' : ''} style={diff === 0 ? { color: 'var(--rs-text-secondary)' } : undefined}>{Math.abs(diff)} points to {diff > 0 ? b1.brand : diff < 0 ? b2.brand : 'Tie'}</span>
                        </div>
                      </div>

                      {/* Overall Score comparison */}
                      <div className="grid grid-cols-3 items-center gap-4 mb-6 px-2">
                        <div className="text-right">
                          <div className="text-3xl font-bold tabular-nums" style={{ color: scoreColor(b1.score) }}>{b1.score}</div>
                          <div className="text-xs font-medium truncate" style={{ color: 'var(--rs-text-secondary)' }}>{b1.brand}</div>
                        </div>
                        <div className="text-center text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--rs-text-muted)' }}>Overall</div>
                        <div className="text-left">
                          <div className="text-3xl font-bold tabular-nums" style={{ color: scoreColor(b2.score) }}>{b2.score}</div>
                          <div className="text-xs font-medium truncate" style={{ color: 'var(--rs-text-secondary)' }}>{b2.brand}</div>
                        </div>
                      </div>

                      {/* Visual metric bars */}
                      <div className="space-y-3">
                        {metrics.map(m => {
                          const v1 = b1.breakdown[m.key];
                          const v2 = b2.breakdown[m.key];
                          const pct1 = (v1 / m.max) * 100;
                          const pct2 = (v2 / m.max) * 100;
                          return (
                            <div key={m.key} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                              {/* Brand 1 bar (right-aligned) */}
                              <div className="flex items-center gap-2 justify-end">
                                <span className="text-xs tabular-nums font-semibold text-white">{v1}<span style={{ color: 'var(--rs-text-muted)' }}>/{m.max}</span></span>
                                <div className="w-28 sm:w-40 h-2 bg-white/[0.03] rounded-full overflow-hidden flex justify-end">
                                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct1}%`, backgroundColor: m.color1 }} />
                                </div>
                              </div>
                              {/* Label */}
                              <span className="text-[10px] uppercase tracking-wider font-medium w-24 text-center" style={{ color: 'var(--rs-text-muted)' }}>{m.label}</span>
                              {/* Brand 2 bar (left-aligned) */}
                              <div className="flex items-center gap-2">
                                <div className="w-28 sm:w-40 h-2 bg-white/[0.03] rounded-full overflow-hidden">
                                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct2}%`, backgroundColor: m.color2 }} />
                                </div>
                                <span className="text-xs tabular-nums font-semibold text-white">{v2}<span style={{ color: 'var(--rs-text-muted)' }}>/{m.max}</span></span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Arena CTA */}
                      <div className="mt-6 pt-4 border-t border-white/[0.04] text-center">
                        <Link
                          href={`/arena`}
                          className="inline-flex items-center gap-2 px-5 py-2 bg-rs-surface border border-rs hover:border-rs-hover text-rs-secondary hover:text-rs-primary text-xs font-bold uppercase tracking-wider rounded-xl transition-all"
                        >
                          <span>⚔️</span>
                          <span>Take to Battle Arena for AI Debate</span>
                        </Link>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
            {/* Top 3 Podium */}
            {top3.length >= 3 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
                {top3.map((brand, index) => {
                  const accents = [
                    { border: 'border-yellow-500/20', glow: 'shadow-yellow-500/5', badge: 'bg-yellow-500/15 text-yellow-400', num: 'text-yellow-500/[0.07]' },
                    { border: 'border-gray-400/15', glow: 'shadow-gray-400/5', badge: 'bg-gray-400/15 text-gray-300', num: 'text-gray-400/[0.07]' },
                    { border: 'border-orange-500/15', glow: 'shadow-orange-500/5', badge: 'bg-orange-500/15 text-orange-400', num: 'text-orange-500/[0.07]' },
                  ];
                  const a = accents[index];

                  return (
                    <div key={brand.brand} className={`relative overflow-hidden rounded-rs-lg border ${a.border} p-5 transition-all duration-300 shadow-lg ${a.glow}`} style={{ background: 'var(--rs-bg-surface)' }}>
                      <div className={`absolute -right-3 -top-6 text-[140px] font-black ${a.num} leading-none select-none pointer-events-none`}>{index + 1}</div>
                      <div className="relative z-10">
                        <div className="flex items-center gap-1.5 mb-5">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary-400"></div>
                          <span className="text-[10px] font-medium uppercase tracking-[0.15em]" style={{ color: 'var(--rs-text-muted)' }}>rAsh Score</span>
                        </div>
                        <div className="flex items-baseline gap-2 mb-7">
                          <span className={`text-4xl font-bold tracking-tight bg-gradient-to-r ${scoreGradient(brand.score)} bg-clip-text text-transparent`}>{brand.score}</span>
                          {brand.scoreChange !== null && brand.scoreChange !== 0 && (
                            <span className={`text-xs font-semibold ${brand.scoreChange > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {brand.scoreChange > 0 ? '+' : ''}{brand.scoreChange}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2.5">
                          <BrandLogo brand={brand.brand} size={28} rank={index} />
                          <h3 className="text-sm font-semibold text-white truncate">{brand.brand}</h3>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* AI Insight Card */}
            <AIInsightCard
              insight={insight}
              loading={insightLoading}
              industryName={industryMeta?.name || selectedIndustry}
            />

            {/* Score Breakdown Chart */}
            {rankedBrands.length >= 3 && (
              <div className="rs-card p-5 mb-8">
                <h3 className="rs-section-label mb-5">
                  Score Breakdown — Top 3
                </h3>
                <ScoreBreakdownChart brands={rankedBrands} />
              </div>
            )}

            {/* Timeline Chart */}
            {Object.keys(timelineBrands).length > 0 && (
              <div className="rs-card p-5 mb-8">
                <h3 className="rs-section-label mb-4">
                  Score Trend — Top 5
                </h3>
                <TimelineChart
                  data={timelineBrands}
                  brands={rankedBrands.slice(0, 5).map(b => b.brand)}
                  dates={timelineDates}
                />
              </div>
            )}

            {/* Rankings Table */}
            <div className="rs-card overflow-hidden">
              <div className="grid grid-cols-12 px-4 sm:px-5 py-3 border-b text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ borderColor: 'var(--rs-border)', color: 'var(--rs-text-muted)' }}>
                <div className="col-span-1">#</div>
                <div className="col-span-7 sm:col-span-5">Company</div>
                <div className="col-span-4 sm:col-span-2 text-right">Score</div>
                <div className="col-span-2 text-right hidden sm:block">Score Δ</div>
                <div className="col-span-2 text-right hidden sm:block">Rank Δ</div>
              </div>

              {rankedBrands.slice(0, 10).map((brand, index) => (
                <div key={brand.brand}
                  className={`grid grid-cols-12 px-4 sm:px-5 py-3.5 items-center border-b transition-colors duration-150 hover:bg-white/[0.02]`} style={{ borderColor: 'var(--rs-border)' }}>
                  <div className="col-span-1">
                    <span className={`text-xs font-medium tabular-nums ${index < 3 ? 'text-primary-400' : ''}`} style={index >= 3 ? { color: 'var(--rs-text-muted)' } : undefined}>{index + 1}</span>
                  </div>
                  <div className="col-span-7 sm:col-span-5 flex items-center gap-2.5 overflow-hidden pr-2">
                    <BrandLogo brand={brand.brand} size={24} rank={index} />
                    <Link href={`/brand/${encodeURIComponent(brand.brand)}`} className={`text-xs sm:text-sm truncate hover:text-primary-400 transition-colors ${index < 3 ? 'font-semibold text-white' : 'font-medium'}`} style={index >= 3 ? { color: 'var(--rs-text-secondary)' } : undefined}>
                      {brand.brand}
                    </Link>
                  </div>
                  <div className="col-span-4 sm:col-span-2 text-right">
                    <span className="text-sm font-semibold tabular-nums" style={{ color: scoreColor(brand.score) }}>{brand.score}</span>
                  </div>
                  <div className="col-span-2 text-right hidden sm:block">
                    {brand.scoreChange !== null && brand.scoreChange !== 0 ? (
                      <span className={`text-xs font-semibold tabular-nums ${brand.scoreChange > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {brand.scoreChange > 0 ? '+' : ''}{brand.scoreChange}
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--rs-text-faint)' }}>—</span>
                    )}
                  </div>
                  <div className="col-span-2 text-right hidden sm:block">
                    {brand.rankChange !== null && brand.rankChange !== 0 ? (
                      <span className={`inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums ${brand.rankChange > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        <svg className={`w-3 h-3 ${brand.rankChange < 0 ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clipRule="evenodd" />
                        </svg>
                        {Math.abs(brand.rankChange)}
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--rs-text-faint)' }}>—</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between px-1 gap-4 text-xs" style={{ color: 'var(--rs-text-muted)' }}>
              <div className="flex items-center gap-3">
                <span>Industry Avg: <span className="font-medium" style={{ color: 'var(--rs-text-secondary)' }}>{industryData.industryAverage.score.toFixed(1)}</span></span>
                <span style={{ color: 'var(--rs-text-faint)' }}>|</span>
                <span>All scores /100</span>
              </div>
              <div className="flex flex-col sm:items-end gap-1">
                <span>{selectedModel === 'all' ? 'All Models' : selectedModel} · Powered by NVIDIA + Groq</span>
                <span className="text-[10px]" style={{ color: 'var(--rs-text-muted)' }}>New data loads daily at 00:00 UTC</span>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// Suspense wrapper required for useSearchParams in Next.js
export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-14 h-14 border-[3px] border-primary-500/30 border-t-primary-500 rounded-full animate-spin" /></div>}>
      <DashboardInner />
    </Suspense>
  );
}
