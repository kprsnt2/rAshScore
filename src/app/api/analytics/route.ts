/**
 * GET /api/analytics
 *
 * Advanced analytics endpoint providing:
 * 1. Anomaly Detection — brands with unusual score changes (z-score method)
 * 2. Trend Forecasting — linear regression on historical scores
 * 3. Weekly Summary — this week vs last week performance
 * 4. Volatility Index — which brands/industries are most volatile
 * 5. Industry Momentum — trending up vs trending down industries
 *
 * Demonstrates: Statistical methods, time-series analysis, regression
 */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { INDUSTRIES } from '@/lib/industry-data';

export const revalidate = 3600;

function rowsToObjects<T>(result: ReturnType<import('sql.js').Database['exec']>): T[] {
  if (result.length === 0) return [];
  const cols = result[0].columns;
  return result[0].values.map(vals => {
    const obj: Record<string, unknown> = {};
    cols.forEach((c, i) => obj[c] = vals[i]);
    return obj as T;
  });
}

/** Simple linear regression: y = mx + b */
function linearRegression(points: { x: number; y: number }[]): { slope: number; intercept: number; r2: number } {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.y || 0, r2: 0 };

  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // R² (coefficient of determination)
  const meanY = sumY / n;
  const ssRes = points.reduce((s, p) => s + Math.pow(p.y - (slope * p.x + intercept), 2), 0);
  const ssTot = points.reduce((s, p) => s + Math.pow(p.y - meanY, 2), 0);
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

  return { slope: Math.round(slope * 1000) / 1000, intercept: Math.round(intercept * 10) / 10, r2: Math.round(r2 * 1000) / 1000 };
}

export async function GET() {
  try {
    const db = await getDb();

    // ── Get all runs ────────────────────────────────────────────────
    const runs = rowsToObjects<{ id: number; run_date: string }>(
      db.exec('SELECT id, run_date FROM pipeline_runs ORDER BY run_date ASC')
    );

    if (runs.length < 2) {
      return NextResponse.json({ error: 'Need at least 2 pipeline runs for analytics' }, { status: 404 });
    }

    const latestRun = runs[runs.length - 1];
    const prevRun = runs[runs.length - 2];

    // ── 1. Anomaly Detection (Z-Score Method) ───────────────────────
    // For each brand, compute their historical score changes and flag
    // any brand where the latest change is > 2 standard deviations
    const anomalies: {
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
    }[] = [];

    // Get all brands with data in latest 2 runs
    const brandChanges = rowsToObjects<{
      brand: string;
      industry_id: string;
      current_score: number;
      prev_score: number;
    }>(db.exec(`
      WITH RankedBrands AS (
        SELECT brand, industry_id, score,
               ROW_NUMBER() OVER(PARTITION BY industry_id ORDER BY score DESC) as rn
        FROM brand_results
        WHERE run_id = ${latestRun.id} AND model IS NULL AND score > 0
      )
      SELECT 
        c.brand, c.industry_id, c.score as current_score, p.score as prev_score
      FROM RankedBrands c
      INNER JOIN brand_results p 
        ON p.run_id = ${prevRun.id} AND p.brand = c.brand AND p.industry_id = c.industry_id AND p.model IS NULL
      WHERE c.rn <= 10 AND p.score > 0
    `));

    // For each brand, get historical changes across all runs
    for (const bc of brandChanges) {
      const safeBrand = bc.brand.replace(/'/g, "''");
      const history = rowsToObjects<{ score: number; run_date: string }>(db.exec(
        `SELECT br.score, pr.run_date 
         FROM brand_results br 
         JOIN pipeline_runs pr ON br.run_id = pr.id
         WHERE br.brand = '${safeBrand}' AND br.industry_id = '${bc.industry_id}' AND br.model IS NULL AND br.score > 0
         ORDER BY pr.run_date ASC`
      ));

      if (history.length < 4) continue; // Need enough history for meaningful stats

      // Compute run-to-run changes
      const changes: number[] = [];
      for (let i = 1; i < history.length; i++) {
        changes.push(history[i].score - history[i - 1].score);
      }

      const latestChange = bc.current_score - bc.prev_score;
      const mean = changes.reduce((a, b) => a + b, 0) / changes.length;
      const variance = changes.reduce((s, c) => s + Math.pow(c - mean, 2), 0) / changes.length;
      const std = Math.sqrt(variance);

      if (std === 0) continue;

      const zScore = Math.abs((latestChange - mean) / std);

      if (zScore > 2) {
        const meta = INDUSTRIES.find(i => i.id === bc.industry_id);
        anomalies.push({
          brand: bc.brand,
          industry_id: bc.industry_id,
          industry_name: meta?.name || bc.industry_id,
          current_score: bc.current_score,
          prev_score: bc.prev_score,
          change: latestChange,
          avg_change: Math.round(mean * 10) / 10,
          std_change: Math.round(std * 10) / 10,
          z_score: Math.round(zScore * 100) / 100,
          type: latestChange > 0 ? 'spike' : 'drop',
          severity: zScore > 3 ? 'critical' : 'warning',
        });
      }
    }

    anomalies.sort((a, b) => b.z_score - a.z_score);

    // ── 2. Trend Forecasting (Linear Regression) ────────────────────
    // For each industry, fit linear regression on avg scores over time
    // and predict next 3 data points
    const industryForecasts: {
      industry_id: string;
      industry_name: string;
      historical: { date: string; avg_score: number }[];
      slope: number;
      r2: number;
      forecast: { date: string; predicted_score: number }[];
      trend: 'rising' | 'falling' | 'stable';
      weekly_momentum: number;
    }[] = [];

    const activeIndustries = rowsToObjects<{ industry_id: string }>(db.exec(
      `SELECT DISTINCT industry_id FROM industry_results WHERE run_id = ${latestRun.id} AND avg_score > 0`
    ));

    for (const { industry_id } of activeIndustries) {
      const safeId = industry_id.replace(/'/g, "''");
      const histData = rowsToObjects<{ run_date: string; avg_score: number }>(db.exec(
        `SELECT pr.run_date, ir.avg_score 
         FROM industry_results ir 
         JOIN pipeline_runs pr ON ir.run_id = pr.id
         WHERE ir.industry_id = '${safeId}' AND ir.avg_score > 0
         ORDER BY pr.run_date ASC`
      ));

      if (histData.length < 3) continue;

      // Convert dates to numeric indices for regression
      const points = histData.map((d, i) => ({ x: i, y: d.avg_score }));
      const { slope, intercept, r2 } = linearRegression(points);

      // Forecast next 3 data points
      const lastDate = new Date(histData[histData.length - 1].run_date + 'T00:00:00');
      const forecast = [1, 2, 3].map(i => {
        const futureDate = new Date(lastDate);
        futureDate.setDate(futureDate.getDate() + i);
        const predicted = slope * (points.length - 1 + i) + intercept;
        return {
          date: futureDate.toISOString().split('T')[0],
          predicted_score: Math.round(Math.max(0, Math.min(100, predicted)) * 10) / 10,
        };
      });

      // Weekly momentum: avg of last 7 points vs prev 7 points
      let weeklyMomentum = 0;
      if (histData.length >= 14) {
        const recent7 = histData.slice(-7).reduce((s, d) => s + d.avg_score, 0) / 7;
        const prev7 = histData.slice(-14, -7).reduce((s, d) => s + d.avg_score, 0) / 7;
        weeklyMomentum = Math.round((recent7 - prev7) * 10) / 10;
      } else if (histData.length >= 4) {
        const half = Math.floor(histData.length / 2);
        const recentHalf = histData.slice(-half).reduce((s, d) => s + d.avg_score, 0) / half;
        const prevHalf = histData.slice(0, half).reduce((s, d) => s + d.avg_score, 0) / half;
        weeklyMomentum = Math.round((recentHalf - prevHalf) * 10) / 10;
      }

      const meta = INDUSTRIES.find(i => i.id === industry_id);
      industryForecasts.push({
        industry_id,
        industry_name: meta?.name || industry_id,
        historical: histData.map(h => ({ date: h.run_date, avg_score: h.avg_score })),
        slope: Math.round(slope * 1000) / 1000,
        r2,
        forecast,
        trend: slope > 0.1 ? 'rising' : slope < -0.1 ? 'falling' : 'stable',
        weekly_momentum: weeklyMomentum,
      });
    }

    industryForecasts.sort((a, b) => b.slope - a.slope);

    // ── 3. Brand Volatility Index ───────────────────────────────────
    // Brands with highest score variance across all runs
    const volatilityData = rowsToObjects<{
      brand: string;
      industry_id: string;
      avg_score: number;
      min_score: number;
      max_score: number;
      score_range: number;
      run_count: number;
    }>(db.exec(`
      WITH TopBrands AS (
        SELECT brand, industry_id
        FROM (
          SELECT brand, industry_id,
                 ROW_NUMBER() OVER(PARTITION BY industry_id ORDER BY score DESC) as rn
          FROM brand_results
          WHERE run_id = ${latestRun.id} AND model IS NULL AND score > 0
        ) WHERE rn <= 10
      )
      SELECT 
        br.brand, br.industry_id,
        ROUND(AVG(br.score), 1) as avg_score,
        MIN(br.score) as min_score,
        MAX(br.score) as max_score,
        (MAX(br.score) - MIN(br.score)) as score_range,
        COUNT(br.score) as run_count
      FROM brand_results br
      INNER JOIN TopBrands tb ON br.brand = tb.brand AND br.industry_id = tb.industry_id
      WHERE br.model IS NULL AND br.score > 0
      GROUP BY br.brand, br.industry_id
      HAVING COUNT(br.score) >= 5
      ORDER BY score_range DESC
      LIMIT 20
    `));

    // Compute stddev for each volatile brand
    const volatilityIndex = volatilityData.map(v => {
      const safeBrand = v.brand.replace(/'/g, "''");
      const safeId = v.industry_id.replace(/'/g, "''");
      const scores = rowsToObjects<{ score: number }>(db.exec(
        `SELECT score FROM brand_results WHERE brand = '${safeBrand}' AND industry_id = '${safeId}' AND model IS NULL AND score > 0`
      )).map(s => s.score);

      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      const variance = scores.reduce((s, x) => s + Math.pow(x - mean, 2), 0) / scores.length;
      const stddev = Math.round(Math.sqrt(variance) * 10) / 10;
      const cv = Math.round((stddev / mean) * 100 * 10) / 10; // Coefficient of variation %

      const meta = INDUSTRIES.find(i => i.id === v.industry_id);
      return {
        brand: v.brand,
        industry_id: v.industry_id,
        industry_name: meta?.name || v.industry_id,
        avg_score: v.avg_score,
        min_score: v.min_score,
        max_score: v.max_score,
        range: v.score_range,
        stddev,
        cv,
        data_points: v.run_count,
      };
    });

    volatilityIndex.sort((a, b) => b.cv - a.cv);

    // ── 4. Weekly Summary ───────────────────────────────────────────
    // Compare latest 7 runs vs previous 7 runs
    const recentRuns = runs.slice(-7);
    const prevRuns = runs.length >= 14 ? runs.slice(-14, -7) : runs.slice(0, Math.min(7, runs.length - 7));

    const recentRunIds = recentRuns.map(r => r.id);
    const prevRunIds = prevRuns.map(r => r.id);

    let weeklyAvgRecent = 0, weeklyAvgPrev = 0;
    let weeklyBrandsRecent = 0, weeklyBrandsPrev = 0;

    if (recentRunIds.length > 0) {
      const recent = rowsToObjects<{ avg_s: number; cnt: number }>(db.exec(
        `WITH TopBrands AS (
          SELECT brand, industry_id FROM (
            SELECT brand, industry_id, ROW_NUMBER() OVER(PARTITION BY industry_id ORDER BY score DESC) as rn
            FROM brand_results WHERE run_id = ${latestRun.id} AND model IS NULL AND score > 0
          ) WHERE rn <= 10
         )
         SELECT ROUND(AVG(br.score), 1) as avg_s, COUNT(DISTINCT br.brand) as cnt 
         FROM brand_results br
         INNER JOIN TopBrands tb ON br.brand = tb.brand AND br.industry_id = tb.industry_id
         WHERE br.run_id IN (${recentRunIds.join(',')}) AND br.model IS NULL AND br.score > 0`
      ));
      if (recent[0]) { weeklyAvgRecent = recent[0].avg_s; weeklyBrandsRecent = recent[0].cnt; }
    }
    if (prevRunIds.length > 0) {
      const prev = rowsToObjects<{ avg_s: number; cnt: number }>(db.exec(
        `WITH TopBrands AS (
          SELECT brand, industry_id FROM (
            SELECT brand, industry_id, ROW_NUMBER() OVER(PARTITION BY industry_id ORDER BY score DESC) as rn
            FROM brand_results WHERE run_id = ${latestRun.id} AND model IS NULL AND score > 0
          ) WHERE rn <= 10
         )
         SELECT ROUND(AVG(br.score), 1) as avg_s, COUNT(DISTINCT br.brand) as cnt 
         FROM brand_results br
         INNER JOIN TopBrands tb ON br.brand = tb.brand AND br.industry_id = tb.industry_id
         WHERE br.run_id IN (${prevRunIds.join(',')}) AND br.model IS NULL AND br.score > 0`
      ));
      if (prev[0]) { weeklyAvgPrev = prev[0].avg_s; weeklyBrandsPrev = prev[0].cnt; }
    }

    // Top improvers/decliners this week
    const weeklyMovers = recentRunIds.length > 0 && prevRunIds.length > 0 ? rowsToObjects<{
      brand: string;
      industry_id: string;
      recent_avg: number;
      prev_avg: number;
      change: number;
    }>(db.exec(`
      WITH TopBrands AS (
        SELECT brand, industry_id FROM (
          SELECT brand, industry_id, ROW_NUMBER() OVER(PARTITION BY industry_id ORDER BY score DESC) as rn
          FROM brand_results WHERE run_id = ${latestRun.id} AND model IS NULL AND score > 0
        ) WHERE rn <= 10
      )
      SELECT 
        r.brand, r.industry_id,
        ROUND(r.avg_score, 1) as recent_avg,
        ROUND(p.avg_score, 1) as prev_avg,
        ROUND(r.avg_score - p.avg_score, 1) as change
      FROM (
        SELECT br.brand, br.industry_id, AVG(br.score) as avg_score 
        FROM brand_results br
        INNER JOIN TopBrands tb ON br.brand = tb.brand AND br.industry_id = tb.industry_id
        WHERE br.run_id IN (${recentRunIds.join(',')}) AND br.model IS NULL AND br.score > 0 
        GROUP BY br.brand, br.industry_id
      ) r
      INNER JOIN (
        SELECT br.brand, br.industry_id, AVG(br.score) as avg_score 
        FROM brand_results br
        INNER JOIN TopBrands tb ON br.brand = tb.brand AND br.industry_id = tb.industry_id
        WHERE br.run_id IN (${prevRunIds.join(',')}) AND br.model IS NULL AND br.score > 0 
        GROUP BY br.brand, br.industry_id
      ) p ON r.brand = p.brand AND r.industry_id = p.industry_id
      ORDER BY change DESC
    `)) : [];

    const weeklySummary = {
      period: {
        recent: { from: recentRuns[0]?.run_date, to: recentRuns[recentRuns.length - 1]?.run_date, runs: recentRuns.length },
        previous: { from: prevRuns[0]?.run_date, to: prevRuns[prevRuns.length - 1]?.run_date, runs: prevRuns.length },
      },
      avgScore: { recent: weeklyAvgRecent, previous: weeklyAvgPrev, change: Math.round((weeklyAvgRecent - weeklyAvgPrev) * 10) / 10 },
      brandsTracked: { recent: weeklyBrandsRecent, previous: weeklyBrandsPrev },
      topImprovers: weeklyMovers.filter(m => m.change > 0).slice(0, 5),
      topDecliners: weeklyMovers.filter(m => m.change < 0).sort((a, b) => a.change - b.change).slice(0, 5),
    };

    // ── 5. Score Stability Report ───────────────────────────────────
    // How many brands maintained their score vs changed
    const stabilityBuckets = { stable: 0, minor: 0, moderate: 0, major: 0 };
    for (const bc of brandChanges) {
      const absChange = Math.abs(bc.current_score - bc.prev_score);
      if (absChange <= 1) stabilityBuckets.stable++;
      else if (absChange <= 5) stabilityBuckets.minor++;
      else if (absChange <= 10) stabilityBuckets.moderate++;
      else stabilityBuckets.major++;
    }
    const totalBrands = brandChanges.length || 1;

    return NextResponse.json({
      anomalies,
      forecasts: industryForecasts,
      volatilityIndex: volatilityIndex.slice(0, 15),
      weeklySummary,
      stability: {
        stable: { count: stabilityBuckets.stable, pct: Math.round(stabilityBuckets.stable / totalBrands * 100) },
        minor: { count: stabilityBuckets.minor, pct: Math.round(stabilityBuckets.minor / totalBrands * 100) },
        moderate: { count: stabilityBuckets.moderate, pct: Math.round(stabilityBuckets.moderate / totalBrands * 100) },
        major: { count: stabilityBuckets.major, pct: Math.round(stabilityBuckets.major / totalBrands * 100) },
      },
      meta: {
        totalRuns: runs.length,
        latestRunDate: latestRun.run_date,
        brandsAnalyzed: brandChanges.length,
        anomaliesDetected: anomalies.length,
        industriesForecasted: industryForecasts.length,
      },
    }, {
      headers: { 'Cache-Control': 'public, max-age=3600' },
    });
  } catch (error) {
    console.error('Error in /api/analytics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
