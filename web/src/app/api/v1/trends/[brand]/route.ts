/**
 * Public API v1 — Brand Trend
 * GET /api/v1/trends/:brand
 *
 * Returns score history for a brand over the last N days.
 * Query params: ?days=30
 */
import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const projectId = process.env.GCP_PROJECT_ID || 'rashscore';
const dataset = 'brand_intelligence';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ brand: string }> }
) {
  try {
    const { brand } = await params;
    const days = parseInt(req.nextUrl.searchParams.get('days') || '30');

    const bq = new BigQuery({ projectId });

    const [rows] = await bq.query({
      query: `
        SELECT run_date, score, recommendation, sentiment, prominence, accuracy
        FROM \`${projectId}.${dataset}.brand_scores_aggregated\`
        WHERE LOWER(brand) = LOWER(@brand)
          AND run_date >= DATE_SUB(CURRENT_DATE(), INTERVAL @days DAY)
        ORDER BY run_date ASC
      `,
      params: { brand: decodeURIComponent(brand), days },
    });

    if (rows.length === 0) {
      return NextResponse.json({ error: `No trend data found for '${brand}'` }, { status: 404 });
    }

    const typedRows = rows as any[];
    const first = typedRows[0].score;
    const last = typedRows[typedRows.length - 1].score;
    const delta = last - first;

    return NextResponse.json({
      brand: decodeURIComponent(brand),
      period_days: days,
      data_points: rows.length,
      trend: delta > 2 ? "improving" : delta < -2 ? "declining" : "stable",
      score_change: delta,
      current_score: last,
      avg_score: Math.round(typedRows.reduce((s, r) => s + r.score, 0) / rows.length),
      history: typedRows.map(r => ({
        date: r.run_date?.value || r.run_date,
        score: r.score,
        breakdown: {
          recommendation: r.recommendation,
          sentiment: r.sentiment,
          prominence: r.prominence,
          accuracy: r.accuracy,
        },
      })),
      api_version: "v1",
    });
  } catch (error: any) {
    console.error('API v1 trends error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
