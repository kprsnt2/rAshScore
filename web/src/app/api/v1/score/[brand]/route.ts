/**
 * Public API v1 — Brand Score
 * GET /api/v1/score/:brand
 *
 * Returns the latest rAsh Score for a brand.
 * Rate limited by API key (future: Cloudflare).
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
    if (!brand) {
      return NextResponse.json({ error: 'Brand name is required' }, { status: 400 });
    }

    const bq = new BigQuery({ projectId });

    // Get latest run date
    const [dateRows] = await bq.query({
      query: `SELECT MAX(run_date) as latest FROM \`${projectId}.${dataset}.pipeline_runs\` WHERE status IN ('success','partial')`,
    });
    const latestDate = dateRows[0]?.latest?.value;
    if (!latestDate) {
      return NextResponse.json({ error: 'No data available' }, { status: 404 });
    }

    // Get brand score
    const [rows] = await bq.query({
      query: `
        SELECT brand, score, recommendation, sentiment, prominence, accuracy,
               category, industry_id, run_date,
               ROW_NUMBER() OVER (PARTITION BY industry_id ORDER BY score DESC) as rank
        FROM \`${projectId}.${dataset}.brand_scores_aggregated\`
        WHERE run_date = @date AND LOWER(brand) = LOWER(@brand)
      `,
      params: { date: latestDate, brand: decodeURIComponent(brand) },
    });

    if (rows.length === 0) {
      return NextResponse.json({ error: `Brand '${brand}' not found` }, { status: 404 });
    }

    const row = rows[0] as any;
    return NextResponse.json({
      brand: row.brand,
      score: row.score,
      rank: Number(row.rank),
      industry: row.industry_id,
      category: row.category,
      breakdown: {
        recommendation: row.recommendation,
        sentiment: row.sentiment,
        prominence: row.prominence,
        accuracy: row.accuracy,
      },
      run_date: row.run_date?.value || latestDate,
      api_version: "v1",
    });
  } catch (error: any) {
    console.error('API v1 score error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
