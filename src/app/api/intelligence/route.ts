/**
 * GET /api/intelligence
 *
 * Cross-industry analytics endpoint for the Intelligence page.
 * Returns industry leaderboard, model bias analysis, top movers,
 * score distributions, correlation data, and coverage stats.
 *
 * Demonstrates: SQL window functions, CTEs, cross-model aggregation
 */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { INDUSTRIES } from '@/lib/industry-data';

export const revalidate = 3600; // ISR: revalidate every hour

// Helper to convert sql.js result rows to objects
function rowsToObjects<T>(result: ReturnType<import('sql.js').Database['exec']>): T[] {
  if (result.length === 0) return [];
  const cols = result[0].columns;
  return result[0].values.map(vals => {
    const obj: Record<string, unknown> = {};
    cols.forEach((c, i) => obj[c] = vals[i]);
    return obj as T;
  });
}

export async function GET() {
  try {
    const db = await getDb();

    // ── 1. Get latest two runs ──────────────────────────────────────
    const runs = rowsToObjects<{ id: number; run_date: string; created_at: string }>(
      db.exec('SELECT id, run_date, created_at FROM pipeline_runs ORDER BY id DESC LIMIT 2')
    );

    if (runs.length === 0) {
      return NextResponse.json({ error: 'No pipeline data available' }, { status: 404 });
    }

    const latestRunId = runs[0].id;
    const prevRunId = runs.length > 1 ? runs[1].id : null;

    // ── 2. Industry Leaderboard ─────────────────────────────────────
    // Rank industries by average score from latest run
    const industryLeaderboard = rowsToObjects<{
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
    }>(db.exec(`
      SELECT
        ir.industry_id,
        ir.industry_name,
        ROUND(ir.avg_score, 1) as avg_score,
        ROUND(ir.avg_recommendation, 1) as avg_recommendation,
        ROUND(ir.avg_sentiment, 1) as avg_sentiment,
        ROUND(ir.avg_prominence, 1) as avg_prominence,
        ROUND(ir.avg_accuracy, 1) as avg_accuracy,
        ir.total_brands,
        tb.brand as top_brand,
        tb.score as top_score
      FROM industry_results ir
      LEFT JOIN (
        SELECT industry_id, brand, score,
          ROW_NUMBER() OVER (PARTITION BY industry_id ORDER BY score DESC) as rn
        FROM brand_results
        WHERE run_id = ${latestRunId} AND model IS NULL AND score > 0
      ) tb ON tb.industry_id = ir.industry_id AND tb.rn = 1
      WHERE ir.run_id = ${latestRunId}
      ORDER BY ir.avg_score DESC
    `));

    // ── 3. Model Bias Analysis ──────────────────────────────────────
    // For each industry × model, compute average scores
    const modelBiasRaw = rowsToObjects<{
      industry_id: string;
      model: string;
      avg_score: number;
      avg_recommendation: number;
      avg_sentiment: number;
      avg_prominence: number;
      avg_accuracy: number;
      brand_count: number;
    }>(db.exec(`
      SELECT
        industry_id,
        model,
        ROUND(AVG(score), 1) as avg_score,
        ROUND(AVG(recommendation), 1) as avg_recommendation,
        ROUND(AVG(sentiment), 1) as avg_sentiment,
        ROUND(AVG(prominence), 1) as avg_prominence,
        ROUND(AVG(accuracy), 1) as avg_accuracy,
        COUNT(*) as brand_count
      FROM brand_results
      WHERE run_id = ${latestRunId}
        AND model IS NOT NULL
        AND score > 0
      GROUP BY industry_id, model
      ORDER BY industry_id, model
    `));

    // Get unique models
    const models = [...new Set(modelBiasRaw.map(r => r.model))].sort();

    // Structure: { industry_id: { model: { avg_score, ... } } }
    const modelBias: Record<string, Record<string, {
      avg_score: number;
      avg_recommendation: number;
      avg_sentiment: number;
      avg_prominence: number;
      avg_accuracy: number;
      brand_count: number;
    }>> = {};

    for (const row of modelBiasRaw) {
      if (!modelBias[row.industry_id]) modelBias[row.industry_id] = {};
      modelBias[row.industry_id][row.model] = {
        avg_score: row.avg_score,
        avg_recommendation: row.avg_recommendation,
        avg_sentiment: row.avg_sentiment,
        avg_prominence: row.avg_prominence,
        avg_accuracy: row.avg_accuracy,
        brand_count: row.brand_count,
      };
    }

    // ── 4. Top Movers ───────────────────────────────────────────────
    // Brands with biggest score changes between latest 2 runs
    let topGainers: { brand: string; industry_id: string; score: number; prev_score: number; change: number }[] = [];
    let topDecliners: { brand: string; industry_id: string; score: number; prev_score: number; change: number }[] = [];

    if (prevRunId) {
      const movers = rowsToObjects<{
        brand: string;
        industry_id: string;
        score: number;
        prev_score: number;
        change: number;
      }>(db.exec(`
        SELECT
          curr.brand,
          curr.industry_id,
          curr.score,
          prev.score as prev_score,
          (curr.score - prev.score) as change
        FROM brand_results curr
        INNER JOIN brand_results prev
          ON prev.run_id = ${prevRunId}
          AND prev.brand = curr.brand
          AND prev.industry_id = curr.industry_id
          AND prev.model IS NULL
        WHERE curr.run_id = ${latestRunId}
          AND curr.model IS NULL
          AND curr.score > 0
          AND prev.score > 0
        ORDER BY change DESC
      `));

      topGainers = movers.filter(m => m.change > 0).slice(0, 10);
      topDecliners = movers.filter(m => m.change < 0).sort((a, b) => a.change - b.change).slice(0, 10);
    }

    // ── 5. Score Distribution ───────────────────────────────────────
    // Per-industry distribution stats from latest run
    const distributions = rowsToObjects<{
      industry_id: string;
      min_score: number;
      max_score: number;
      avg_score: number;
      brand_count: number;
    }>(db.exec(`
      SELECT
        industry_id,
        MIN(score) as min_score,
        MAX(score) as max_score,
        ROUND(AVG(score), 1) as avg_score,
        COUNT(*) as brand_count
      FROM brand_results
      WHERE run_id = ${latestRunId}
        AND model IS NULL
        AND score > 0
      GROUP BY industry_id
      ORDER BY avg_score DESC
    `));

    // Compute median and stddev per industry (SQLite doesn't have built-in median/stddev)
    const scoreDistribution = distributions.map(d => {
      const scores = rowsToObjects<{ score: number }>(db.exec(
        `SELECT score FROM brand_results WHERE run_id = ${latestRunId} AND industry_id = '${d.industry_id.replace(/'/g, "''")}' AND model IS NULL AND score > 0 ORDER BY score ASC`
      )).map(s => s.score);

      const median = scores.length > 0
        ? scores.length % 2 === 0
          ? (scores[scores.length / 2 - 1] + scores[scores.length / 2]) / 2
          : scores[Math.floor(scores.length / 2)]
        : 0;

      const mean = scores.reduce((a, b) => a + b, 0) / (scores.length || 1);
      const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / (scores.length || 1);
      const stddev = Math.round(Math.sqrt(variance) * 10) / 10;

      return {
        industry_id: d.industry_id,
        min: d.min_score,
        max: d.max_score,
        avg: d.avg_score,
        median: Math.round(median * 10) / 10,
        stddev,
        count: d.brand_count,
        scores, // raw scores for histogram
      };
    });

    // ── 6. Correlation Data ─────────────────────────────────────────
    // All brand scores for correlation analysis
    const correlationRaw = rowsToObjects<{
      recommendation: number;
      sentiment: number;
      prominence: number;
      accuracy: number;
    }>(db.exec(`
      SELECT recommendation, sentiment, prominence, accuracy
      FROM brand_results
      WHERE run_id = ${latestRunId} AND model IS NULL AND score > 0
    `));

    // Compute correlation matrix
    const dims = ['recommendation', 'sentiment', 'prominence', 'accuracy'] as const;
    const correlationMatrix: Record<string, Record<string, number>> = {};

    for (const d1 of dims) {
      correlationMatrix[d1] = {};
      for (const d2 of dims) {
        const arr1 = correlationRaw.map(r => r[d1]);
        const arr2 = correlationRaw.map(r => r[d2]);
        correlationMatrix[d1][d2] = pearsonCorrelation(arr1, arr2);
      }
    }

    // ── 7. Coverage Stats ───────────────────────────────────────────
    const totalRuns = rowsToObjects<{ cnt: number }>(
      db.exec('SELECT COUNT(*) as cnt FROM pipeline_runs')
    )[0]?.cnt || 0;

    const totalBrandsTracked = rowsToObjects<{ cnt: number }>(
      db.exec(`SELECT COUNT(DISTINCT brand) as cnt FROM brand_results WHERE model IS NULL AND score > 0`)
    )[0]?.cnt || 0;

    const totalIndustries = rowsToObjects<{ cnt: number }>(
      db.exec(`SELECT COUNT(DISTINCT industry_id) as cnt FROM brand_results WHERE run_id = ${latestRunId} AND model IS NULL`)
    )[0]?.cnt || 0;

    const allDates = rowsToObjects<{ run_date: string }>(
      db.exec('SELECT run_date FROM pipeline_runs ORDER BY run_date ASC')
    ).map(r => r.run_date);

    // Enrich industry leaderboard with display names from INDUSTRIES constant
    const enrichedLeaderboard = industryLeaderboard.map(ind => {
      const meta = INDUSTRIES.find(i => i.id === ind.industry_id);
      return {
        ...ind,
        industry_name: meta?.name || ind.industry_name || ind.industry_id,
      };
    });

    return NextResponse.json({
      industryLeaderboard: enrichedLeaderboard,
      modelBias,
      models,
      topMovers: { gainers: topGainers, decliners: topDecliners },
      scoreDistribution,
      correlationMatrix,
      coverage: {
        totalBrands: totalBrandsTracked,
        totalIndustries,
        totalRuns,
        daysOfData: allDates.length,
        latestRunDate: runs[0].run_date,
        latestRunTimestamp: runs[0].created_at,
        firstRunDate: allDates[0] || runs[0].run_date,
      },
    }, {
      headers: { 'Cache-Control': 'public, max-age=3600' },
    });
  } catch (error) {
    console.error('Error in /api/intelligence:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Pearson correlation coefficient between two arrays.
 * Returns value between -1 and 1.
 */
function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0) return 0;

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
  const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);
  const sumY2 = y.reduce((acc, yi) => acc + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 100) / 100;
}
