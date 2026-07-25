/**
 * GET /api/health
 * Health check endpoint for Cloud Run.
 */
import { NextResponse } from 'next/server';
import { healthCheck } from '@/lib/bq';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { ok, latency } = await healthCheck();
  return NextResponse.json(
    {
      status: ok ? 'healthy' : 'degraded',
      bigquery: ok ? 'connected' : 'error',
      latency_ms: latency,
      timestamp: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 }
  );
}
