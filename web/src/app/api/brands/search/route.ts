/**
 * GET /api/brands/search?q=flipkart
 * Search brands across all industries from BigQuery.
 */
import { NextRequest, NextResponse } from 'next/server';
import { searchBrands } from '@/lib/bq';

export async function GET(request: NextRequest) {
  try {
    const q = new URL(request.url).searchParams.get('q') || '';
    if (q.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const results = await searchBrands(q);
    return NextResponse.json({ results });
  } catch (error) {
    console.error('Error in /api/brands/search:', error);
    return NextResponse.json({ results: [] });
  }
}
