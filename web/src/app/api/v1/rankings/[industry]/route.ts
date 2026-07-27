/**
 * Public API v1 — Industry Rankings
 * GET /api/v1/rankings/:industry
 *
 * Returns top ranked brands for an industry.
 * Query params: ?limit=10
 */
import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const projectId = process.env.GCP_PROJECT_ID || 'rashscore';
const dataset = 'brand_intelligence';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ industry: string }> }
) {
  try {
    const { industry } = await params;
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '10');

    const bq = new BigQuery({ projectId });

    const [dateRows] = await bq.query({
      query: `SELECT MAX(run_date) as latest FROM \`${projectId}.${dataset}.pipeline_runs\` WHERE status IN ('success','partial')`,
    });
    const latestDate = dateRows[0]?.latest?.value;
    if (!latestDate) {
      return NextResponse.json({ error: 'No data available' }, { status: 404 });
    }

    const [rows] = await bq.query({
      query: `
        SELECT brand, score, recommendation, sentiment, prominence, accuracy, category
        FROM \`${projectId}.${dataset}.brand_scores_aggregated\`
        WHERE run_date = @date AND industry_id = @industry
        ORDER BY score DESC
        LIMIT @limit
      `,
      params: { date: latestDate, industry, limit },
    });

    return NextResponse.json({
      industry,
      run_date: latestDate,
      count: rows.length,
      brands: (rows as any[]).map((r, i) => ({
        rank: i + 1,
        brand: r.brand,
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
    console.error('API v1 rankings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
