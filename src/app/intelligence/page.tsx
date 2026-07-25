"use client";

import { useState, useEffect, useRef } from 'react';
import { INDUSTRIES } from '@/lib/industry-data';
import Link from 'next/link';
import { scoreColor, scoreGradient } from '@/lib/ui-utils';

// ── Types ───────────────────────────────────────────────────────────
interface IndustryLeaderboardItem {
  industry_id: string;
  industry_name: string;
  avg_score: number;
  avg_recommendation: number;
  avg_sentiment: number;
  avg_prominence: number;
  avg_accuracy: number;
  total_brands: number;
  top_brand: string;
  top_score: number;
}

interface TopMover {
  brand: string;
  industry_id: string;
  score: number;
  prev_score: number;
  change: number;
}

interface ScoreDistItem {
  industry_id: string;
  min: number;
  max: number;
  avg: number;
  median: number;
  stddev: number;
  count: number;
  scores: number[];
}

interface IntelligenceData {
  industryLeaderboard: IndustryLeaderboardItem[];
  modelBias: Record<string, Record<string, { avg_score: number; avg_recommendation: number; avg_sentiment: number; avg_prominence: number; avg_accuracy: number; brand_count: number }>>;
  models: string[];
  topMovers: { gainers: TopMover[]; decliners: TopMover[] };
  scoreDistribution: ScoreDistItem[];
  correlationMatrix: Record<string, Record<string, number>>;
  coverage: {
    totalBrands: number;
    totalIndustries: number;
    totalRuns: number;
    daysOfData: number;
    latestRunDate: string;
    latestRunTimestamp: string;
    firstRunDate: string;
  };
}

// ── Helpers ──────────────────────────────────────────────────────────


const INDUSTRY_EMOJIS: Record<string, string> = {
  technology: '💻', automotive: '🚗', ecommerce: '🛒', fashion: '👗',
  food: '🍔', healthcare: '🏥', finance: '💰', telecom: '📱',
  entertainment: '🎬', travel: '✈️', energy: '⚡', fmcg: '🧴',
  realestate: '🏠', edtech: '📚', logistics: '📦',
  consumer_electronics: '📺', mobile_phones: '📱', home_appliances: '🏠',
  two_wheelers: '🏍️',
};

function getIndustryEmoji(id: string): string {
  return INDUSTRY_EMOJIS[id] || '📊';
}

function shortenModel(model: string): string {
  if (model.includes('nemotron')) return 'Nemotron';
  if (model.includes('step-3')) return 'Step 3.7';
  if (model.includes('glm')) return 'GLM 5.1';
  if (model.includes('gpt-oss')) return 'GPT-OSS';
  if (model.includes('compound')) return 'Compound';
  if (model.includes('llama-3.3')) return 'Llama 3.3';
  if (model.includes('llama-3.1')) return 'Llama 3.1';
  if (model.includes('gemma')) return 'Gemma';
  // Fallback: last segment
  const parts = model.split('/');
  return parts[parts.length - 1].slice(0, 16);
}

// ── Heatmap Component ───────────────────────────────────────────────
function ModelBiasHeatmap({
  modelBias,
  models,
  industries,
}: {
  modelBias: IntelligenceData['modelBias'];
  models: string[];
  industries: IndustryLeaderboardItem[];
}) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  if (models.length === 0 || industries.length === 0) {
    return <p style={{ color: 'var(--rs-text-muted)' }} className="text-sm">No per-model data available yet.</p>;
  }

  const cellW = 80;
  const cellH = 32;
  const labelW = 160;
  const headerH = 60;
  const W = labelW + models.length * cellW;
  const H = headerH + industries.length * cellH;

  // Find score range for color scaling
  const allScores = Object.values(modelBias).flatMap(m => Object.values(m).map(v => v.avg_score));
  const minScore = Math.min(...allScores);
  const maxScore = Math.max(...allScores);
  const range = maxScore - minScore || 1;

  function heatColor(score: number): string {
    const t = (score - minScore) / range;
    // Interpolate from dark purple (low) to bright cyan (high)
    const r = Math.round(30 + (34 - 30) * t);
    const g = Math.round(20 + (211 - 20) * t);
    const b = Math.round(80 + (238 - 80) * t);
    return `rgb(${r}, ${g}, ${b})`;
  }

  return (
    <div className="relative overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ minHeight: 300 }}>
        {/* Column headers (model names) */}
        {models.map((model, mi) => (
          <text
            key={model}
            x={labelW + mi * cellW + cellW / 2}
            y={headerH - 8}
            textAnchor="middle"
            fill="rgba(255,255,255,0.5)"
            fontSize="9"
            fontWeight="500"
          >
            {shortenModel(model)}
          </text>
        ))}

        {/* Row labels + cells */}
        {industries.map((ind, ri) => {
          const meta = INDUSTRIES.find(i => i.id === ind.industry_id);
          const displayName = meta?.name || ind.industry_id;
          const y = headerH + ri * cellH;

          return (
            <g key={ind.industry_id}>
              {/* Industry label */}
              <text
                x={labelW - 10}
                y={y + cellH / 2 + 4}
                textAnchor="end"
                fill="rgba(255,255,255,0.4)"
                fontSize="10"
              >
                {displayName.length > 20 ? displayName.slice(0, 18) + '…' : displayName}
              </text>

              {/* Cells */}
              {models.map((model, mi) => {
                const data = modelBias[ind.industry_id]?.[model];
                const score = data?.avg_score || 0;
                const x = labelW + mi * cellW;

                return (
                  <g key={model}>
                    <rect
                      x={x + 1}
                      y={y + 1}
                      width={cellW - 2}
                      height={cellH - 2}
                      rx={4}
                      fill={score > 0 ? heatColor(score) : 'rgba(255,255,255,0.02)'}
                      opacity={score > 0 ? 0.85 : 1}
                      className="cursor-pointer transition-opacity hover:opacity-100"
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltip({
                          x: rect.left + rect.width / 2,
                          y: rect.top,
                          text: `${displayName} × ${shortenModel(model)}: ${score}`,
                        });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                    {score > 0 && (
                      <text
                        x={x + cellW / 2}
                        y={y + cellH / 2 + 4}
                        textAnchor="middle"
                        fill="white"
                        fontSize="10"
                        fontWeight="600"
                        className="pointer-events-none"
                      >
                        {score}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed pointer-events-none bg-gray-900 border border-white/10 rounded-lg px-3 py-2 text-xs shadow-xl z-50"
          style={{ left: tooltip.x, top: tooltip.y - 40, transform: 'translate(-50%, 0)' }}
        >
          {tooltip.text}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-3 mt-4 justify-center">
        <span className="text-[10px]" style={{ color: 'var(--rs-text-muted)' }}>Low</span>
        <div className="flex gap-0.5">
          {[0, 0.2, 0.4, 0.6, 0.8, 1].map(t => (
            <div key={t} className="w-6 h-3 rounded-sm" style={{
              backgroundColor: `rgb(${Math.round(30 + (34 - 30) * t)}, ${Math.round(20 + (211 - 20) * t)}, ${Math.round(80 + (238 - 80) * t)})`,
            }} />
          ))}
        </div>
        <span className="text-[10px]" style={{ color: 'var(--rs-text-muted)' }}>High</span>
      </div>
    </div>
  );
}

// ── Correlation Matrix Component ────────────────────────────────────
function CorrelationMatrix({ matrix }: { matrix: Record<string, Record<string, number>> }) {
  const dims = ['recommendation', 'sentiment', 'prominence', 'accuracy'];
  const labels = ['Rec', 'Sent', 'Prom', 'Acc'];
  const cellSize = 60;
  const labelOffset = 70;
  const W = labelOffset + dims.length * cellSize;
  const H = labelOffset + dims.length * cellSize;

  function corrColor(r: number): string {
    const abs = Math.abs(r);
    if (r >= 0) {
      return `rgba(34, 211, 238, ${abs * 0.8})`;
    }
    return `rgba(248, 113, 113, ${abs * 0.8})`;
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-w-sm mx-auto" style={{ minHeight: 200 }}>
      {/* Column headers */}
      {dims.map((d, i) => (
        <text key={`col-${d}`} x={labelOffset + i * cellSize + cellSize / 2} y={labelOffset - 10}
          textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="10" fontWeight="500">
          {labels[i]}
        </text>
      ))}

      {/* Rows */}
      {dims.map((d1, ri) => (
        <g key={d1}>
          {/* Row label */}
          <text x={labelOffset - 10} y={labelOffset + ri * cellSize + cellSize / 2 + 4}
            textAnchor="end" fill="rgba(255,255,255,0.4)" fontSize="10">
            {labels[ri]}
          </text>

          {dims.map((d2, ci) => {
            const val = matrix[d1]?.[d2] ?? 0;
            return (
              <g key={d2}>
                <rect
                  x={labelOffset + ci * cellSize + 2}
                  y={labelOffset + ri * cellSize + 2}
                  width={cellSize - 4}
                  height={cellSize - 4}
                  rx={6}
                  fill={corrColor(val)}
                />
                <text
                  x={labelOffset + ci * cellSize + cellSize / 2}
                  y={labelOffset + ri * cellSize + cellSize / 2 + 4}
                  textAnchor="middle"
                  fill="white"
                  fontSize="11"
                  fontWeight="600"
                >
                  {val.toFixed(2)}
                </text>
              </g>
            );
          })}
        </g>
      ))}
    </svg>
  );
}

// ── Score Distribution Bar ──────────────────────────────────────────
function ScoreDistributionChart({ distributions }: { distributions: ScoreDistItem[] }) {
  if (distributions.length === 0) return null;

  const W = 700;
  const barH = 24;
  const gap = 8;
  const labelW = 160;
  const chartW = W - labelW - 60;
  const H = distributions.length * (barH + gap) + 20;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ minHeight: 200 }}>
      {distributions.map((d, i) => {
        const meta = INDUSTRIES.find(ind => ind.id === d.industry_id);
        const displayName = meta?.name || d.industry_id;
        const y = i * (barH + gap) + 10;

        // Scale scores to chart width (0-100 range)
        const xScale = (v: number) => labelW + (v / 100) * chartW;

        return (
          <g key={d.industry_id}>
            {/* Label */}
            <text x={labelW - 10} y={y + barH / 2 + 4} textAnchor="end"
              fill="rgba(255,255,255,0.4)" fontSize="10">
              {displayName.length > 22 ? displayName.slice(0, 20) + '…' : displayName}
            </text>

            {/* Range bar (min to max) */}
            <rect
              x={xScale(d.min)}
              y={y + 4}
              width={Math.max(xScale(d.max) - xScale(d.min), 2)}
              height={barH - 8}
              rx={4}
              fill="rgba(255,255,255,0.06)"
            />

            {/* IQR-ish bar (avg ± stddev) */}
            <rect
              x={xScale(Math.max(0, d.avg - d.stddev))}
              y={y + 6}
              width={Math.max(xScale(Math.min(100, d.avg + d.stddev)) - xScale(Math.max(0, d.avg - d.stddev)), 2)}
              height={barH - 12}
              rx={3}
              fill={scoreColor(d.avg)}
              opacity={0.4}
            />

            {/* Average marker */}
            <circle cx={xScale(d.avg)} cy={y + barH / 2} r={4}
              fill={scoreColor(d.avg)} stroke="#0a0a0f" strokeWidth={2} />

            {/* Median marker */}
            <line
              x1={xScale(d.median)} y1={y + 4}
              x2={xScale(d.median)} y2={y + barH - 4}
              stroke="white" strokeWidth={1.5} opacity={0.4}
            />

            {/* Score label */}
            <text x={W - 10} y={y + barH / 2 + 4} textAnchor="end"
              fill={scoreColor(d.avg)} fontSize="11" fontWeight="600">
              {d.avg}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Main Page ───────────────────────────────────────────────────────
export default function IntelligencePage() {
  const [data, setData] = useState<IntelligenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/intelligence');
        if (!res.ok) throw new Error('Failed to fetch intelligence data');
        setData(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 border-[3px] border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-6" />
          <p className="text-sm font-medium" style={{ color: 'var(--rs-text-secondary)' }}>Loading cross-industry intelligence...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <span className="text-4xl mb-4 block">⚠️</span>
          <p className="text-sm font-medium" style={{ color: 'var(--rs-text-secondary)' }}>{error || 'No data available'}</p>
        </div>
      </div>
    );
  }

  const { industryLeaderboard, modelBias, models, topMovers, scoreDistribution, correlationMatrix, coverage } = data;

  return (
    <div className="min-h-screen rs-page">
      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-12 pb-10 sm:pt-20 sm:pb-14">

        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-purple-500/5 rounded-full blur-[120px]" />
        <div className="absolute top-20 right-1/4 w-[300px] h-[200px] bg-cyan-500/[0.03] rounded-full blur-[100px]" />

        <div className="max-w-5xl mx-auto px-4 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-medium tracking-widest uppercase mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            Cross-Industry Intelligence
          </div>
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold text-white mb-4 leading-[1.1] tracking-tight">
            The Big Picture<br />
            <span className="text-indigo-400">
              AI Visibility Across India
            </span>
          </h1>
          <p className="text-base sm:text-lg max-w-xl mx-auto leading-relaxed" style={{ color: 'var(--rs-text-secondary)' }}>
            {coverage.totalBrands} brands · {coverage.totalIndustries} industries · {coverage.daysOfData} days of data
          </p>
          {coverage.latestRunDate && (
            <p className="text-xs mt-5" style={{ color: 'var(--rs-text-muted)' }}>
              Latest data from {new Date(coverage.latestRunDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          )}
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 pb-16 space-y-10">

        {/* ── Data Coverage Stats ─────────────────────────────── */}
        <section>
          <h2 className="text-[10px] font-medium uppercase tracking-[0.2em] mb-4" style={{ color: 'var(--rs-text-muted)' }}>
            Data Coverage
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: 'Brands Tracked', value: coverage.totalBrands, icon: '🏢' },
              { label: 'Industries', value: coverage.totalIndustries, icon: '🏭' },
              { label: 'Pipeline Runs', value: coverage.totalRuns, icon: '⚙️' },
              { label: 'Days of Data', value: coverage.daysOfData, icon: '📅' },
              { label: 'AI Models', value: models.length, icon: '🤖' },
            ].map(stat => (
              <div key={stat.label} className="rs-card p-4 text-center">
                <span className="text-lg block mb-1">{stat.icon}</span>
                <div className="text-2xl font-bold text-white tabular-nums">{stat.value}</div>
                <div className="text-[10px] uppercase tracking-widest mt-1" style={{ color: 'var(--rs-text-muted)' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Industry Leaderboard ────────────────────────────── */}
        <section>
          <h2 className="text-[10px] font-medium uppercase tracking-[0.2em] mb-4" style={{ color: 'var(--rs-text-muted)' }}>
            Industry Leaderboard — Ranked by AI Visibility
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {industryLeaderboard.map((ind, index) => (
              <Link
                key={ind.industry_id}
                href={`/dashboard?industry=${ind.industry_id}`}
                className="group relative rounded-xl border border-white/[0.04] bg-white/[0.015] p-5 hover:bg-white/[0.04] hover:border-white/[0.08] transition-all duration-300"
              >
                {/* Rank badge */}
                <div className={`absolute -right-2 -top-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                  ${index < 3 ? 'bg-rs-elevated text-rs-primary border border-rs' : 'bg-rs-surface border border-rs'}`} style={{ color: index < 3 ? 'var(--rs-text-primary)' : 'var(--rs-text-muted)' }}>
                  {index + 1}
                </div>

                {/* Industry info */}
                <div className="flex items-center gap-2.5 mb-4">
                  <span className="text-lg">{getIndustryEmoji(ind.industry_id)}</span>
                  <h3 className="text-sm font-semibold text-white group-hover:text-primary-400 transition-colors truncate">
                    {ind.industry_name}
                  </h3>
                </div>

                {/* Score */}
                <div className="flex items-baseline gap-2 mb-3">
                  <span className={`text-3xl font-bold tabular-nums bg-gradient-to-r ${scoreGradient(ind.avg_score)} bg-clip-text text-transparent`}>
                    {ind.avg_score}
                  </span>
                  <span className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--rs-text-muted)' }}>avg score</span>
                </div>

                {/* Mini breakdown bar */}
                <div className="flex gap-[2px] h-2 rounded-full overflow-hidden bg-white/[0.03] mb-3">
                  <div className="rounded-l-full" style={{ width: `${(ind.avg_recommendation / 40) * 100}%`, backgroundColor: scoreColor(ind.avg_score), opacity: 1 }} />
                  <div style={{ width: `${(ind.avg_sentiment / 30) * 100}%`, backgroundColor: scoreColor(ind.avg_score), opacity: 0.65 }} />
                  <div style={{ width: `${(ind.avg_prominence / 20) * 100}%`, backgroundColor: scoreColor(ind.avg_score), opacity: 0.4 }} />
                  <div className="rounded-r-full" style={{ width: `${(ind.avg_accuracy / 10) * 100}%`, backgroundColor: scoreColor(ind.avg_score), opacity: 0.2 }} />
                </div>

                {/* Details */}
                <div className="flex items-center justify-between text-[10px]" style={{ color: 'var(--rs-text-muted)' }}>
                  <span>👑 {ind.top_brand} ({ind.top_score})</span>
                  <span>{ind.total_brands} brands</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Model Bias Heatmap ──────────────────────────────── */}
        <section>
          <div className="rounded-xl border border-white/[0.04] bg-white/[0.015] p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-[10px] font-medium uppercase tracking-[0.2em] mb-1" style={{ color: 'var(--rs-text-muted)' }}>
                  Model Bias Heatmap
                </h2>
                <p className="text-xs" style={{ color: 'var(--rs-text-muted)' }}>How different AI models perceive each industry</p>
              </div>
              <span className="text-xs bg-white/[0.03] px-2 py-1 rounded-md border border-white/[0.04]" style={{ color: 'var(--rs-text-muted)' }}>
                {models.length} models × {industryLeaderboard.length} industries
              </span>
            </div>
            <ModelBiasHeatmap
              modelBias={modelBias}
              models={models}
              industries={industryLeaderboard}
            />
          </div>
        </section>

        {/* ── Top Movers ─────────────────────────────────────── */}
        {(topMovers.gainers.length > 0 || topMovers.decliners.length > 0) && (
          <section>
            <h2 className="text-[10px] font-medium uppercase tracking-[0.2em] mb-4" style={{ color: 'var(--rs-text-muted)' }}>
              Top Movers — Across All Industries
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Gainers */}
              <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/[0.02] p-5">
                <h3 className="text-xs font-semibold text-emerald-400 mb-4 flex items-center gap-2">
                  <span>🔥</span> Biggest Gainers
                </h3>
                <div className="space-y-2">
                  {topMovers.gainers.map(m => {
                    const meta = INDUSTRIES.find(i => i.id === m.industry_id);
                    return (
                      <div key={m.brand + m.industry_id} className="flex items-center gap-3 py-1.5">
                        <span className="text-emerald-400 font-bold text-xs tabular-nums w-10 text-right">+{m.change}</span>
                        <div className="flex-1 min-w-0">
                          <Link href={`/brand/${encodeURIComponent(m.brand)}`} className="text-xs font-medium text-white hover:text-primary-400 transition-colors truncate block">
                            {m.brand}
                          </Link>
                          <span className="text-[10px]" style={{ color: 'var(--rs-text-muted)' }}>{meta?.name || m.industry_id}</span>
                        </div>
                        <span className="text-xs tabular-nums" style={{ color: scoreColor(m.score) }}>{m.score}</span>
                      </div>
                    );
                  })}
                  {topMovers.gainers.length === 0 && (
                    <p className="text-xs" style={{ color: 'var(--rs-text-muted)' }}>No gainers in latest run</p>
                  )}
                </div>
              </div>

              {/* Decliners */}
              <div className="rounded-xl border border-red-500/10 bg-red-500/[0.02] p-5">
                <h3 className="text-xs font-semibold text-red-400 mb-4 flex items-center gap-2">
                  <span>📉</span> Biggest Decliners
                </h3>
                <div className="space-y-2">
                  {topMovers.decliners.map(m => {
                    const meta = INDUSTRIES.find(i => i.id === m.industry_id);
                    return (
                      <div key={m.brand + m.industry_id} className="flex items-center gap-3 py-1.5">
                        <span className="text-red-400 font-bold text-xs tabular-nums w-10 text-right">{m.change}</span>
                        <div className="flex-1 min-w-0">
                          <Link href={`/brand/${encodeURIComponent(m.brand)}`} className="text-xs font-medium text-white hover:text-primary-400 transition-colors truncate block">
                            {m.brand}
                          </Link>
                          <span className="text-[10px]" style={{ color: 'var(--rs-text-muted)' }}>{meta?.name || m.industry_id}</span>
                        </div>
                        <span className="text-xs tabular-nums" style={{ color: scoreColor(m.score) }}>{m.score}</span>
                      </div>
                    );
                  })}
                  {topMovers.decliners.length === 0 && (
                    <p className="text-xs" style={{ color: 'var(--rs-text-muted)' }}>No decliners in latest run</p>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── Score Distribution ──────────────────────────────── */}
        <section>
          <div className="rounded-xl border border-white/[0.04] bg-white/[0.015] p-5">
            <div className="mb-4">
              <h2 className="text-[10px] font-medium uppercase tracking-[0.2em] mb-1" style={{ color: 'var(--rs-text-muted)' }}>
                Score Distribution by Industry
              </h2>
              <p className="text-xs" style={{ color: 'var(--rs-text-muted)' }}>Range (min–max), average (●), and median (|) per industry</p>
            </div>
            <ScoreDistributionChart distributions={scoreDistribution} />
          </div>
        </section>

        {/* ── Correlation Matrix ──────────────────────────────── */}
        <section>
          <div className="rounded-xl border border-white/[0.04] bg-white/[0.015] p-5">
            <div className="mb-4">
              <h2 className="text-[10px] font-medium uppercase tracking-[0.2em] mb-1" style={{ color: 'var(--rs-text-muted)' }}>
                Score Dimension Correlations
              </h2>
              <p className="text-xs" style={{ color: 'var(--rs-text-muted)' }}>Pearson correlation between scoring dimensions across all brands</p>
            </div>
            <CorrelationMatrix matrix={correlationMatrix} />
            <div className="flex items-center justify-center gap-4 mt-4 text-[10px]" style={{ color: 'var(--rs-text-muted)' }}>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-cyan-500/60" /> Positive correlation</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-400/60" /> Negative correlation</span>
            </div>
          </div>
        </section>

        {/* ── Footer ─────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-center justify-between text-xs pt-6 border-t border-white/[0.04]" style={{ color: 'var(--rs-text-muted)' }}>
          <div className="flex items-center gap-3">
            <span>Data range: {coverage.firstRunDate} → {coverage.latestRunDate}</span>
            <span style={{ color: 'var(--rs-text-faint)' }}>|</span>
            <span>Powered by NVIDIA + Groq</span>
          </div>
          <Link href="/dashboard" className="text-primary-400 hover:text-primary-300 mt-2 sm:mt-0 transition-colors">
            ← Back to India rAsh Index
          </Link>
        </div>
      </main>
    </div>
  );
}
