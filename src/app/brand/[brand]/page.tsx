import { Metadata } from 'next';
import { getBrandHistory, getDb, BrandRow } from '@/lib/db';
import { INDUSTRIES } from '@/lib/industry-data';
import BrandLogo from '@/components/BrandLogo';
import Link from 'next/link';
import RashEngineButton from './RashEngineButton';
import ShareBrandButton from './ShareBrandButton';
import { notFound } from 'next/navigation';
import { scoreColor, scoreGradient, scoreLabel } from '@/lib/ui-utils';

interface Props {
  params: Promise<{
    brand: string;
  }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  const decodedBrand = decodeURIComponent(resolvedParams.brand);
  const formattedBrand = decodedBrand.charAt(0).toUpperCase() + decodedBrand.slice(1);

  return {
    title: `${formattedBrand} AI Visibility Score | India rAsh Score Index`,
    description: `Deep dive into the AI search visibility score, sentiment, and recommendation trends for ${formattedBrand}.`,
  };
}



export const revalidate = 3600;

export default async function BrandPage({ params }: Props) {
  const resolvedParams = await params;
  const decodedBrand = decodeURIComponent(resolvedParams.brand);
  const data = await getBrandHistory(decodedBrand);

  if (!data.latestBreakdown) {
    notFound();
  }

  const { history, latestBreakdown, industryIds } = data;
  const industries = industryIds.map(id => INDUSTRIES.find(i => i.id === id)).filter(Boolean);
  
  // ===== Per-model scores =====
  let perModelScores: { model: string; score: number; recommendation: number; sentiment: number; prominence: number; accuracy: number }[] = [];
  try {
    const db = await getDb();
    const safeBrand = decodedBrand.replace(/'/g, "''");
    // Get per-model scores from the latest run
    const modelResults = db.exec(
      `SELECT model, score, recommendation, sentiment, prominence, accuracy
       FROM brand_results
       WHERE run_id = ${latestBreakdown.run_id} AND brand COLLATE NOCASE = '${safeBrand}' AND model IS NOT NULL AND score > 0
       ORDER BY score DESC`
    );
    if (modelResults.length > 0) {
      const cols = modelResults[0].columns;
      perModelScores = modelResults[0].values.map(vals => {
        const obj: Record<string, unknown> = {};
        cols.forEach((c, i) => obj[c] = vals[i]);
        return {
          model: String(obj.model),
          score: Number(obj.score),
          recommendation: Number(obj.recommendation),
          sentiment: Number(obj.sentiment),
          prominence: Number(obj.prominence),
          accuracy: Number(obj.accuracy),
        };
      });
    }
  } catch {
    // Per-model data not available, that's fine
  }

  // ===== Industry ranking context =====
  let rankingContext: { rank: number; total: number; above: { brand: string; score: number }[]; below: { brand: string; score: number }[] } | null = null;
  try {
    const db = await getDb();
    const industryId = industryIds[0];
    if (industryId) {
      const allBrands = db.exec(
        `SELECT brand, score FROM brand_results
         WHERE run_id = ${latestBreakdown.run_id} AND industry_id = '${industryId}' AND model IS NULL AND score > 0
         ORDER BY score DESC`
      );
      if (allBrands.length > 0) {
        const cols = allBrands[0].columns;
        const brands = allBrands[0].values.map(vals => {
          const obj: Record<string, unknown> = {};
          cols.forEach((c, i) => obj[c] = vals[i]);
          return { brand: String(obj.brand), score: Number(obj.score) };
        });
        const myIndex = brands.findIndex(b => b.brand.toLowerCase() === decodedBrand.toLowerCase());
        if (myIndex >= 0) {
          rankingContext = {
            rank: myIndex + 1,
            total: brands.length,
            above: brands.slice(Math.max(0, myIndex - 2), myIndex),
            below: brands.slice(myIndex + 1, myIndex + 3),
          };
        }
      }
    }
  } catch {
    // Ranking context not available
  }

  // Format history for chart
  const dates = Array.from(new Set(history.map(h => h.date))).sort();
  const W = 900, H = 260;
  const PAD = { top: 20, right: 20, bottom: 35, left: 40 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  
  const allScores = history.map(h => h.score);
  const minScore = Math.max(0, Math.min(...allScores) - 5);
  const maxScore = Math.min(100, Math.max(...allScores) + 5);
  const scoreRange = maxScore - minScore || 1;

  const xScale = (i: number) => PAD.left + (dates.length === 1 ? chartW / 2 : (i / (dates.length - 1)) * chartW);
  const yScale = (v: number) => PAD.top + chartH - ((v - minScore) / scoreRange) * chartH;

  const yTicks: number[] = [];
  const step = scoreRange <= 20 ? 5 : scoreRange <= 50 ? 10 : 20;
  for (let v = Math.ceil(minScore / step) * step; v <= maxScore; v += step) yTicks.push(v);

  const points = dates.map((d, di) => {
    const entry = history.find(e => e.date === d);
    return entry ? { x: xScale(di), y: yScale(entry.score), score: entry.score, date: d } : null;
  }).filter(Boolean) as { x: number; y: number; score: number; date: string }[];
  
  const pathD = points.length > 0 ? points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') : '';

  return (
    <div className="min-h-screen pt-24 pb-16" style={{ background: 'var(--rs-bg-base)' }}>
      <div className="max-w-5xl mx-auto px-4">
        <Link href="/dashboard" className="inline-flex items-center gap-2 hover:text-white transition-colors mb-8 text-sm" style={{ color: 'var(--rs-text-muted)' }}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Dashboard
        </Link>

        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 sm:p-12 mb-8">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                {industries.map(ind => ind && (
                  <span key={ind.id} className="px-3 py-1 text-[10px] font-semibold tracking-widest uppercase bg-white/[0.05] rounded-full border border-white/[0.05]" style={{ color: 'var(--rs-text-secondary)' }}>
                    {ind.name}
                  </span>
                ))}
                {rankingContext && (
                  <span className="px-3 py-1 text-[10px] font-semibold tracking-widest uppercase bg-primary-500/10 text-primary-400 rounded-full border border-primary-500/20">
                    Rank #{rankingContext.rank} of {rankingContext.total}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 mb-2">
                <BrandLogo brand={latestBreakdown.brand} size={48} />
                <h1 className="text-4xl sm:text-6xl font-bold text-white tracking-tight">
                  {latestBreakdown.brand}
                </h1>
                <ShareBrandButton brand={latestBreakdown.brand} score={latestBreakdown.score} />
              </div>
              <p style={{ color: 'var(--rs-text-secondary)' }}>AI Visibility Deep Dive</p>
            </div>
            
            <div className="flex flex-col items-start md:items-end">
              <span className="text-[10px] font-medium uppercase tracking-[0.2em] mb-2" style={{ color: 'var(--rs-text-muted)' }}>Overall Score</span>
              <div className="flex items-baseline gap-2">
                <span className={`text-6xl sm:text-7xl font-black bg-gradient-to-r ${scoreGradient(latestBreakdown.score)} bg-clip-text text-transparent leading-none`}>
                  {latestBreakdown.score}
                </span>
                <span className="text-xl font-light" style={{ color: 'var(--rs-text-muted)' }}>/100</span>
              </div>
              <span className={`text-xs font-medium mt-1`} style={{ color: scoreColor(latestBreakdown.score) }}>
                {scoreLabel(latestBreakdown.score)}
              </span>
              <RashEngineButton brand={latestBreakdown.brand} industry={latestBreakdown.industry_id} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Breakdown Stats */}
          <div className="md:col-span-1 space-y-4">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-500"></span>
              Score Breakdown
            </h3>
            
            {[
              { label: 'Recommendation', value: latestBreakdown.recommendation, max: 40, color: '#22d3ee', desc: 'Would AI recommend this brand?' },
              { label: 'Sentiment', value: latestBreakdown.sentiment, max: 30, color: '#a78bfa', desc: 'Overall reputation & tone' },
              { label: 'Prominence', value: latestBreakdown.prominence, max: 20, color: '#f472b6', desc: 'Brand visibility & recognition' },
              { label: 'Accuracy', value: latestBreakdown.accuracy, max: 10, color: '#34d399', desc: 'Data confidence level' },
            ].map((metric) => (
              <div key={metric.label} className="bg-white/[0.015] border border-white/[0.04] rounded-xl p-4">
                <div className="flex justify-between items-end mb-1">
                  <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--rs-text-secondary)' }}>{metric.label}</span>
                  <span className="text-lg font-bold text-white tabular-nums">{metric.value}<span className="text-sm font-normal" style={{ color: 'var(--rs-text-muted)' }}>/{metric.max}</span></span>
                </div>
                <p className="text-[10px] mb-2" style={{ color: 'var(--rs-text-muted)' }}>{metric.desc}</p>
                <div className="h-1.5 bg-white/[0.03] rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-1000 ease-out" 
                    style={{ width: `${(metric.value / metric.max) * 100}%`, backgroundColor: metric.color }} 
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Timeline Chart */}
          <div className="md:col-span-2 bg-white/[0.015] border border-white/[0.04] rounded-xl p-6 relative">
            <h3 className="text-sm font-semibold text-white mb-6 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
              Historical Trend
            </h3>
            
            {points.length > 0 ? (
              <div className="w-full overflow-x-auto pb-4">
                <div className="min-w-[600px]">
                  <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ minHeight: 200 }} aria-label="Score Trend">
                    {/* Grid lines */}
                    {yTicks.map(v => (
                      <g key={v}>
                        <line x1={PAD.left} y1={yScale(v)} x2={W - PAD.right} y2={yScale(v)} stroke="rgba(255,255,255,0.04)" />
                        <text x={PAD.left - 8} y={yScale(v) + 4} textAnchor="end" fill="rgba(255,255,255,0.25)" fontSize="10">{v}</text>
                      </g>
                    ))}

                    {/* X-axis labels */}
                    {dates.map((d, i) => (
                      <text key={d} x={xScale(i)} y={H - 8} textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize="10">
                        {new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                      </text>
                    ))}

                    {/* Line */}
                    <path d={pathD} fill="none" stroke="url(#lineGradient)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    
                    {/* Gradient definition */}
                    <defs>
                      <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#22d3ee" />
                        <stop offset="100%" stopColor="#a78bfa" />
                      </linearGradient>
                    </defs>

                    {/* Dots */}
                    {points.map((p, pi) => (
                      <g key={pi}>
                        <circle cx={p.x} cy={p.y} r="5" fill="#a78bfa" stroke="#0a0a0f" strokeWidth="2" />
                        <text x={p.x} y={p.y - 12} textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">{p.score}</text>
                      </g>
                    ))}
                  </svg>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-48" style={{ color: 'var(--rs-text-muted)' }}>
                Not enough historical data yet.
              </div>
            )}
          </div>
        </div>

        {/* Per-Model Comparison */}
        {perModelScores.length > 0 && (
          <div className="rounded-xl border border-white/[0.04] bg-white/[0.015] p-6 mb-8">
            <h3 className="text-sm font-semibold text-white mb-6 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
              Per-Model Scores
            </h3>
            <p className="text-[11px] mb-5 -mt-3" style={{ color: 'var(--rs-text-muted)' }}>How each AI model scored this brand independently</p>

            <div className="space-y-4">
              {perModelScores.map((ms, idx) => {
                const barColors = ['#22d3ee', '#a78bfa', '#f472b6', '#34d399', '#fbbf24'];
                const c = barColors[idx % barColors.length];
                return (
                  <div key={ms.model} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <div className="flex justify-between items-center sm:w-56 shrink-0">
                      <span className="text-xs font-medium truncate" style={{ color: 'var(--rs-text-secondary)' }}>{ms.model}</span>
                      <span className="text-sm font-bold tabular-nums sm:hidden" style={{ color: scoreColor(ms.score) }}>{ms.score}</span>
                    </div>
                    <div className="flex-1 flex gap-[2px] h-3 rounded-full overflow-hidden bg-white/[0.03] w-full">
                      <div className="rounded-l-full transition-all duration-500" style={{ width: `${(ms.recommendation / 40) * 100}%`, backgroundColor: c, opacity: 1 }} title={`Rec: ${ms.recommendation}/40`} />
                      <div className="transition-all duration-500" style={{ width: `${(ms.sentiment / 30) * 100}%`, backgroundColor: c, opacity: 0.65 }} title={`Sent: ${ms.sentiment}/30`} />
                      <div className="transition-all duration-500" style={{ width: `${(ms.prominence / 20) * 100}%`, backgroundColor: c, opacity: 0.4 }} title={`Prom: ${ms.prominence}/20`} />
                      <div className="rounded-r-full transition-all duration-500" style={{ width: `${(ms.accuracy / 10) * 100}%`, backgroundColor: c, opacity: 0.2 }} title={`Acc: ${ms.accuracy}/10`} />
                    </div>
                    <span className="text-sm font-bold w-12 text-right tabular-nums hidden sm:block" style={{ color: scoreColor(ms.score) }}>{ms.score}</span>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-2 mt-5 text-[10px] tracking-wide pt-3 border-t border-white/[0.04]" style={{ color: 'var(--rs-text-secondary)' }}>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{backgroundColor: '#22d3ee', opacity:1}}></span> Recommendation</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{backgroundColor: '#22d3ee', opacity:0.65}}></span> Sentiment</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{backgroundColor: '#22d3ee', opacity:0.4}}></span> Prominence</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{backgroundColor: '#22d3ee', opacity:0.25}}></span> Accuracy</span>
            </div>
          </div>
        )}

        {/* Industry Ranking Context */}
        {rankingContext && (
          <div className="rounded-xl border border-white/[0.04] bg-white/[0.015] p-6 mb-8">
            <h3 className="text-sm font-semibold text-white mb-5 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
              Industry Ranking
            </h3>

            <div className="space-y-1">
              {/* Brands above */}
              {rankingContext.above.map((b, i) => (
                <Link key={b.brand} href={`/brand/${encodeURIComponent(b.brand)}`}
                  className="flex items-center justify-between px-4 py-2.5 rounded-lg hover:bg-white/[0.03] transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium w-6 text-right tabular-nums" style={{ color: 'var(--rs-text-muted)' }}>#{rankingContext!.rank - rankingContext!.above.length + i}</span>
                    <BrandLogo brand={b.brand} size={20} />
                    <span className="text-sm" style={{ color: 'var(--rs-text-secondary)' }}>{b.brand}</span>
                  </div>
                  <span className="text-sm font-medium tabular-nums" style={{ color: scoreColor(b.score) }}>{b.score}</span>
                </Link>
              ))}

              {/* Current brand (highlighted) */}
              <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-primary-500/[0.08] border border-primary-500/20">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-primary-400 font-bold w-6 text-right tabular-nums">#{rankingContext.rank}</span>
                  <BrandLogo brand={latestBreakdown.brand} size={24} />
                  <span className="text-sm text-white font-semibold">{latestBreakdown.brand}</span>
                </div>
                <span className={`text-lg font-bold tabular-nums bg-gradient-to-r ${scoreGradient(latestBreakdown.score)} bg-clip-text text-transparent`}>{latestBreakdown.score}</span>
              </div>

              {/* Brands below */}
              {rankingContext.below.map((b, i) => (
                <Link key={b.brand} href={`/brand/${encodeURIComponent(b.brand)}`}
                  className="flex items-center justify-between px-4 py-2.5 rounded-lg hover:bg-white/[0.03] transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium w-6 text-right tabular-nums" style={{ color: 'var(--rs-text-muted)' }}>#{rankingContext!.rank + i + 1}</span>
                    <BrandLogo brand={b.brand} size={20} />
                    <span className="text-sm" style={{ color: 'var(--rs-text-secondary)' }}>{b.brand}</span>
                  </div>
                  <span className="text-sm font-medium tabular-nums" style={{ color: scoreColor(b.score) }}>{b.score}</span>
                </Link>
              ))}
            </div>

            <p className="text-[10px] mt-4 pt-3 border-t border-white/[0.04]" style={{ color: 'var(--rs-text-muted)' }}>
              Showing brands ranked around {latestBreakdown.brand} in the {industries[0]?.name || 'industry'} category
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
