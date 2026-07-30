/**
 * GET /api/health
 * Health check endpoint for Cloud Run & BigQuery.
 */
import { NextResponse } from 'next/server';
import { healthCheck, getLatestRunDate } from '@/lib/bq';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { ok, latency, error } = await healthCheck();
  const latestDate = ok ? await getLatestRunDate() : null;

  return NextResponse.json(
    {
      status: ok ? 'healthy' : 'degraded',
      bigquery: ok ? 'connected' : 'error',
      latency_ms: latency,
      latest_data_date: latestDate,
      error: error || null,
      timestamp: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 }
  );
}
