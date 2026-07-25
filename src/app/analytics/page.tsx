"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { scoreColor } from '@/lib/ui-utils';
import { INDUSTRIES } from '@/lib/industry-data';

// ── Types ───────────────────────────────────────────────────────────
interface Anomaly {
  brand: string;
  industry_id: string;
  industry_name: string;
  current_score: number;
  prev_score: number;
  change: number;
  avg_change: number;
  std_change: number;
  z_score: number;
  type: 'spike' | 'drop';
  severity: 'warning' | 'critical';
}

interface Forecast {
  industry_id: string;
  industry_name: string;
  historical: { date: string; avg_score: number }[];
  slope: number;
  r2: number;
  forecast: { date: string; predicted_score: number }[];
  trend: 'rising' | 'falling' | 'stable';
  weekly_momentum: number;
}

interface VolatilityItem {
  brand: string;
  industry_id: string;
  industry_name: string;
  avg_score: number;
  min_score: number;
  max_score: number;
  range: number;
  stddev: number;
  cv: number;
  data_points: number;
}

interface WeeklySummary {
  period: {
    recent: { from: string; to: string; runs: number };
    previous: { from: string; to: string; runs: number };
  };
  avgScore: { recent: number; previous: number; change: number };
  brandsTracked: { recent: number; previous: number };
  topImprovers: { brand: string; industry_id: string; recent_avg: number; prev_avg: number; change: number }[];
  topDecliners: { brand: string; industry_id: string; recent_avg: number; prev_avg: number; change: number }[];
}

interface StabilityData {
  stable: { count: number; pct: number };
  minor: { count: number; pct: number };
  moderate: { count: number; pct: number };
  major: { count: number; pct: number };
}

interface AnalyticsData {
  anomalies: Anomaly[];
  forecasts: Forecast[];
  volatilityIndex: VolatilityItem[];
  weeklySummary: WeeklySummary;
  stability: StabilityData;
  meta: {
    totalRuns: number;
    latestRunDate: string;
    brandsAnalyzed: number;
    anomaliesDetected: number;
    industriesForecasted: number;
  };
}

// ── Mini Sparkline ──────────────────────────────────────────────────
function Sparkline({ data, forecast, width = 200, height = 40 }: {
  data: number[];
  forecast?: number[];
  width?: number;
  height?: number;
}) {
  const allValues = [...data, ...(forecast || [])];
  const min = Math.min(...allValues) - 2;
  const max = Math.max(...allValues) + 2;
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = (i / (allValues.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  const forecastPoints = forecast ? forecast.map((v, i) => {
    const x = ((data.length + i) / (allValues.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }) : [];

  const lastDataPoint = points.split(' ').pop() || '';
  const forecastLine = forecastPoints.length > 0
    ? `${lastDataPoint} ${forecastPoints.join(' ')}`
    : '';

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke="rgba(99,102,241,0.6)" strokeWidth="1.5" />
      {forecastLine && (
        <polyline points={forecastLine} fill="none" stroke="rgba(168,85,247,0.5)" strokeWidth="1.5" strokeDasharray="4,3" />
      )}
      {/* Last data point */}
      {data.length > 0 && (() => {
        const lastX = ((data.length - 1) / (allValues.length - 1)) * width;
        const lastY = height - ((data[data.length - 1] - min) / range) * height;
        return <circle cx={lastX} cy={lastY} r="2.5" fill="#6366f1" />;
      })()}
    </svg>
  );
}

// ── Stability Donut ─────────────────────────────────────────────────
function StabilityDonut({ stability }: { stability: StabilityData }) {
  const size = 140;
  const cx = size / 2;
  const cy = size / 2;
  const r = 50;
  const strokeW = 16;

  const segments = [
    { key: 'stable', pct: stability.stable.pct, color: '#34d399', label: 'Stable (±1)' },
    { key: 'minor', pct: stability.minor.pct, color: '#a3e635', label: 'Minor (±2-5)' },
    { key: 'moderate', pct: stability.moderate.pct, color: '#facc15', label: 'Moderate (±6-10)' },
    { key: 'major', pct: stability.major.pct, color: '#f87171', label: 'Major (>10)' },
  ];

  const circ = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {segments.map(seg => {
          const dash = (seg.pct / 100) * circ;
          const el = (
            <circle
              key={seg.key}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeW}
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${cx} ${cy})`}
              opacity={0.8}
            />
          );
          offset += dash;
          return el;
        })}
        <text x={cx} y={cy - 4} textAnchor="middle" fill="white" fontSize="18" fontWeight="700">
          {stability.stable.pct}%
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="9">
          stable
        </text>
      </svg>
      <div className="space-y-1.5">
        {segments.map(seg => (
          <div key={seg.key} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: seg.color, opacity: 0.8 }} />
            <span style={{ color: 'var(--rs-text-secondary)' }}>{seg.label}</span>
            <span className="text-white font-medium ml-auto tabular-nums">{seg.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/analytics');
        if (!res.ok) throw new Error('Failed to fetch analytics data');
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
          <div className="w-14 h-14 border-[3px] border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-6" />
          <p className="text-sm" style={{ color: 'var(--rs-text-muted)' }}>Running anomaly detection & trend analysis...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <span className="text-4xl mb-4 block">⚠️</span>
          <p className="text-sm" style={{ color: 'var(--rs-text-secondary)' }}>{error || 'No data available'}</p>
        </div>
      </div>
    );
  }

  const { anomalies, forecasts, volatilityIndex, weeklySummary, stability, meta } = data;

  return (
    <div className="min-h-screen rs-page">
      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-12 pb-10 sm:pt-20 sm:pb-14">
        <div className="absolute inset-0 bg-gradient-to-b from-rose-500/[0.03] via-transparent to-transparent" />
        <div className="absolute top-0 left-1/3 w-[500px] h-[300px] bg-rose-500/5 rounded-full blur-[120px]" />
        <div className="absolute top-16 right-1/3 w-[400px] h-[200px] bg-purple-500/[0.04] rounded-full blur-[100px]" />

        <div className="max-w-5xl mx-auto px-4 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium tracking-widest uppercase mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
            Advanced Analytics
          </div>
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold text-white mb-4 leading-[1.1] tracking-tight">
            Anomaly Detection<br />
            <span className="bg-gradient-to-r from-rose-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
              & Trend Forecasting
            </span>
          </h1>
          <p className="text-base sm:text-lg max-w-xl mx-auto leading-relaxed" style={{ color: 'var(--rs-text-muted)' }}>
            Statistical analysis of {meta.brandsAnalyzed} brands across {meta.totalRuns} pipeline runs
          </p>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 pb-16 space-y-10">

        {/* ── Summary Cards ──────────────────────────────────── */}
        <section>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Anomalies Detected', value: meta.anomaliesDetected, icon: '🚨', color: meta.anomaliesDetected > 5 ? '#f87171' : '#facc15' },
              { label: 'Industries Forecasted', value: meta.industriesForecasted, icon: '📈', color: '#a855f7' },
              { label: 'Pipeline Runs', value: meta.totalRuns, icon: '⚙️', color: '#6366f1' },
              { label: 'Weekly Score Δ', value: (weeklySummary.avgScore.change > 0 ? '+' : '') + weeklySummary.avgScore.change, icon: weeklySummary.avgScore.change >= 0 ? '📊' : '📉', color: weeklySummary.avgScore.change >= 0 ? '#34d399' : '#f87171' },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-white/[0.04] bg-white/[0.015] p-4 text-center">
                <span className="text-lg block mb-1">{s.icon}</span>
                <div className="text-2xl font-bold tabular-nums" style={{ color: s.color }}>{s.value}</div>
                <div className="text-[10px] uppercase tracking-widest mt-1" style={{ color: 'var(--rs-text-muted)' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Anomaly Detection ───────────────────────────────── */}
        <section>
          <div className="rounded-xl border border-white/[0.04] bg-white/[0.015] p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-[10px] font-medium uppercase tracking-[0.2em] mb-1" style={{ color: 'var(--rs-text-muted)' }}>
                  🚨 Anomaly Detection — Z-Score Method
                </h2>
                <p className="text-xs" style={{ color: 'var(--rs-text-muted)' }}>Brands with score changes &gt;2 standard deviations from their historical mean</p>
              </div>
              <span className="text-xs bg-white/[0.03] px-2 py-1 rounded-md border border-white/[0.04]" style={{ color: 'var(--rs-text-muted)' }}>
                {anomalies.length} detected
              </span>
            </div>

            {anomalies.length === 0 ? (
              <div className="text-center py-8">
                <span className="text-3xl block mb-2">✅</span>
                <p className="text-sm" style={{ color: 'var(--rs-text-muted)' }}>No anomalies detected — all brands within normal variance</p>
              </div>
            ) : (
              <div className="space-y-2">
                {anomalies.slice(0, 12).map((a, i) => (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${
                    a.severity === 'critical'
                      ? 'border-red-500/20 bg-red-500/[0.03]'
                      : 'border-yellow-500/15 bg-yellow-500/[0.02]'
                  }`}>
                    <span className={`text-lg ${a.type === 'spike' ? '' : ''}`}>
                      {a.severity === 'critical' ? '🔴' : '🟡'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Link href={`/brand/${encodeURIComponent(a.brand)}`} className="text-sm font-medium text-white hover:text-primary-400 transition-colors truncate">
                          {a.brand}
                        </Link>
                        <span className="text-[10px] hidden sm:inline" style={{ color: 'var(--rs-text-muted)' }}>{a.industry_name}</span>
                      </div>
                      <div className="text-[10px] mt-0.5" style={{ color: 'var(--rs-text-muted)' }}>
                        z={a.z_score} · avg Δ={a.avg_change} · σ={a.std_change}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className={`text-sm font-bold tabular-nums ${a.type === 'spike' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {a.change > 0 ? '+' : ''}{a.change}
                      </div>
                      <div className="text-[10px] tabular-nums" style={{ color: 'var(--rs-text-muted)' }}>{a.prev_score} → {a.current_score}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── Trend Forecasting ──────────────────────────────── */}
        <section>
          <h2 className="text-[10px] font-medium uppercase tracking-[0.2em] mb-4" style={{ color: 'var(--rs-text-muted)' }}>
            📈 Industry Trend Forecasting — Linear Regression
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {forecasts.map(f => {
              const latestScore = f.historical[f.historical.length - 1]?.avg_score || 0;
              const trendIcon = f.trend === 'rising' ? '↗️' : f.trend === 'falling' ? '↘️' : '→';
              const trendColor = f.trend === 'rising' ? 'text-emerald-400' : f.trend === 'falling' ? 'text-red-400' : '';

              return (
                <div key={f.industry_id} className="rounded-xl border border-white/[0.04] bg-white/[0.015] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-white truncate">{f.industry_name}</h3>
                    <span className={`text-sm ${trendColor}`} style={!trendColor ? { color: 'var(--rs-text-secondary)' } : undefined}>{trendIcon}</span>
                  </div>

                  {/* Sparkline */}
                  <div className="h-10 mb-3">
                    <Sparkline
                      data={f.historical.map(h => h.avg_score)}
                      forecast={f.forecast.map(p => p.predicted_score)}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px]">
                    <div>
                      <span style={{ color: 'var(--rs-text-muted)' }}>Current </span>
                      <span className="font-medium" style={{ color: scoreColor(latestScore) }}>{latestScore}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--rs-text-muted)' }}>Forecast </span>
                      <span className="font-medium text-purple-400">{f.forecast[2]?.predicted_score || '—'}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] mt-1">
                    <span style={{ color: 'var(--rs-text-muted)' }}>slope={f.slope}/day</span>
                    <span style={{ color: 'var(--rs-text-muted)' }}>R²={f.r2}</span>
                    {f.weekly_momentum !== 0 && (
                      <span className={f.weekly_momentum > 0 ? 'text-emerald-500' : 'text-red-400'}>
                        {f.weekly_momentum > 0 ? '+' : ''}{f.weekly_momentum}/wk
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Weekly Summary + Stability ──────────────────────── */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Weekly Summary */}
          <div className="rounded-xl border border-white/[0.04] bg-white/[0.015] p-5">
            <h2 className="text-[10px] font-medium uppercase tracking-[0.2em] mb-4" style={{ color: 'var(--rs-text-muted)' }}>
              📊 Weekly Report
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--rs-text-secondary)' }}>Avg Score</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: 'var(--rs-text-muted)' }}>{weeklySummary.avgScore.previous}</span>
                  <span style={{ color: 'var(--rs-text-faint)' }}>→</span>
                  <span className="text-sm font-bold" style={{ color: scoreColor(weeklySummary.avgScore.recent) }}>
                    {weeklySummary.avgScore.recent}
                  </span>
                  <span className={`text-xs font-medium ${weeklySummary.avgScore.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    ({weeklySummary.avgScore.change > 0 ? '+' : ''}{weeklySummary.avgScore.change})
                  </span>
                </div>
              </div>

              {weeklySummary.topImprovers.length > 0 && (
                <div>
                  <h3 className="text-[10px] uppercase tracking-widest mb-2" style={{ color: 'var(--rs-text-muted)' }}>Weekly Improvers</h3>
                  {weeklySummary.topImprovers.map(m => {
                    const meta = INDUSTRIES.find(i => i.id === m.industry_id);
                    return (
                      <div key={m.brand + m.industry_id} className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Link href={`/brand/${encodeURIComponent(m.brand)}`} className="text-xs text-white hover:text-primary-400 truncate">{m.brand}</Link>
                          <span className="text-[9px]" style={{ color: 'var(--rs-text-faint)' }}>{meta?.name?.slice(0, 12)}</span>
                        </div>
                        <span className="text-xs text-emerald-400 font-bold tabular-nums">+{m.change}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {weeklySummary.topDecliners.length > 0 && (
                <div>
                  <h3 className="text-[10px] uppercase tracking-widest mb-2" style={{ color: 'var(--rs-text-muted)' }}>Weekly Decliners</h3>
                  {weeklySummary.topDecliners.map(m => {
                    const meta = INDUSTRIES.find(i => i.id === m.industry_id);
                    return (
                      <div key={m.brand + m.industry_id} className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Link href={`/brand/${encodeURIComponent(m.brand)}`} className="text-xs text-white hover:text-primary-400 truncate">{m.brand}</Link>
                          <span className="text-[9px]" style={{ color: 'var(--rs-text-faint)' }}>{meta?.name?.slice(0, 12)}</span>
                        </div>
                        <span className="text-xs text-red-400 font-bold tabular-nums">{m.change}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Score Stability */}
          <div className="rounded-xl border border-white/[0.04] bg-white/[0.015] p-5">
            <h2 className="text-[10px] font-medium uppercase tracking-[0.2em] mb-4" style={{ color: 'var(--rs-text-muted)' }}>
              🎯 Score Stability Report
            </h2>
            <p className="text-xs mb-4" style={{ color: 'var(--rs-text-muted)' }}>Distribution of score changes between latest runs</p>
            <StabilityDonut stability={stability} />
          </div>
        </section>

        {/* ── Volatility Index ───────────────────────────────── */}
        <section>
          <div className="rounded-xl border border-white/[0.04] bg-white/[0.015] p-5">
            <div className="mb-4">
              <h2 className="text-[10px] font-medium uppercase tracking-[0.2em] mb-1" style={{ color: 'var(--rs-text-muted)' }}>
                🌊 Brand Volatility Index
              </h2>
              <p className="text-xs" style={{ color: 'var(--rs-text-muted)' }}>Brands ranked by Coefficient of Variation (CV%) — higher CV = more unpredictable</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest border-b border-white/[0.04]" style={{ color: 'var(--rs-text-muted)' }}>
                    <th className="text-left py-2 pr-3">#</th>
                    <th className="text-left py-2 pr-3">Brand</th>
                    <th className="text-left py-2 pr-3 hidden sm:table-cell">Industry</th>
                    <th className="text-right py-2 px-2">Avg</th>
                    <th className="text-right py-2 px-2">Range</th>
                    <th className="text-right py-2 px-2">σ</th>
                    <th className="text-right py-2 px-2">CV%</th>
                    <th className="text-right py-2 pl-2">Runs</th>
                  </tr>
                </thead>
                <tbody>
                  {volatilityIndex.map((v, i) => (
                    <tr key={v.brand + v.industry_id} className="border-b border-white/[0.02] hover:bg-white/[0.02]">
                      <td className="py-2 pr-3" style={{ color: 'var(--rs-text-muted)' }}>{i + 1}</td>
                      <td className="py-2 pr-3">
                        <Link href={`/brand/${encodeURIComponent(v.brand)}`} className="text-white hover:text-primary-400 transition-colors">
                          {v.brand}
                        </Link>
                      </td>
                      <td className="py-2 pr-3 hidden sm:table-cell" style={{ color: 'var(--rs-text-muted)' }}>{v.industry_name}</td>
                      <td className="py-2 px-2 text-right tabular-nums" style={{ color: scoreColor(v.avg_score) }}>{v.avg_score}</td>
                      <td className="py-2 px-2 text-right tabular-nums" style={{ color: 'var(--rs-text-secondary)' }}>{v.min_score}–{v.max_score}</td>
                      <td className="py-2 px-2 text-right tabular-nums" style={{ color: 'var(--rs-text-secondary)' }}>{v.stddev}</td>
                      <td className="py-2 px-2 text-right tabular-nums font-medium" style={{ color: v.cv > 15 ? '#f87171' : v.cv > 10 ? '#facc15' : '#34d399' }}>
                        {v.cv}%
                      </td>
                      <td className="py-2 pl-2 text-right tabular-nums" style={{ color: 'var(--rs-text-muted)' }}>{v.data_points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── Footer ─────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-center justify-between text-xs pt-6 border-t border-white/[0.04]" style={{ color: 'var(--rs-text-muted)' }}>
          <div className="flex items-center gap-3">
            <span>Based on {meta.totalRuns} pipeline runs</span>
            <span style={{ color: 'var(--rs-text-faint)' }}>|</span>
            <span>Z-score threshold: σ &gt; 2.0</span>
          </div>
          <div className="flex gap-4 mt-2 sm:mt-0">
            <Link href="/intelligence" className="text-purple-400 hover:text-purple-300 transition-colors">
              Intelligence →
            </Link>
            <Link href="/dashboard" className="text-primary-400 hover:text-primary-300 transition-colors">
              Dashboard →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
