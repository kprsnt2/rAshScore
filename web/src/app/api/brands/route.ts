/**
 * GET /api/brands?industry=technology&model=all
 * Returns ranked brands from BigQuery (replaces SQLite queries).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getBrandResults, getAvailableModels, getLatestRunDate, getAvailableDates } from '@/lib/bq';
import { INDUSTRIES } from '@/lib/industry-data';

export const revalidate = 3600;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const industryId = searchParams.get('industry') || 'technology';
    const model = searchParams.get('model') || 'all';
    const topN = searchParams.get('top') ? parseInt(searchParams.get('top')!, 10) : null;
    const dateParam = searchParams.get('date');

    // Validate industry
    const industryMeta = INDUSTRIES.find(i => i.id === industryId);
    if (!industryMeta) {
      return NextResponse.json({ error: 'Invalid industry' }, { status: 400 });
    }

    // Determine run date
    const runDate = dateParam || await getLatestRunDate();
    if (!runDate) {
      return NextResponse.json({ error: 'No pipeline data available' }, { status: 404 });
    }

    // Get brand results from BigQuery
    const brands = await getBrandResults(runDate, industryId, model);
    const availableModels = await getAvailableModels(runDate, industryId);

    if (brands.length === 0) {
      return NextResponse.json({ error: 'No data available for this industry' }, { status: 404 });
    }

    // Compute industry average
    const avgScore = Math.round(brands.reduce((s, b) => s + b.score, 0) / brands.length);
    const avgRec = Math.round(brands.reduce((s, b) => s + b.recommendation, 0) / brands.length);
    const avgSent = Math.round(brands.reduce((s, b) => s + b.sentiment, 0) / brands.length);
    const avgProm = Math.round(brands.reduce((s, b) => s + b.prominence, 0) / brands.length);
    const avgAcc = Math.round(brands.reduce((s, b) => s + b.accuracy, 0) / brands.length);

    // Format response (matches old API shape for dashboard compatibility)
    const rankedBrands = brands.map((b) => ({
      brand: b.brand,
      score: b.score,
      breakdown: {
        recommendation: b.recommendation,
        sentiment: b.sentiment,
        prominence: b.prominence,
        accuracy: b.accuracy,
      },
      rank: b.rank,
      scoreChange: b.score_delta ?? null,
      rankChange: b.rank_delta ?? null,
    }));

    return NextResponse.json({
      industry: {
        id: industryId,
        name: industryMeta.name,
        category: industryMeta.category,
      },
      brands: topN ? rankedBrands.slice(0, topN) : rankedBrands,
      industryAverage: {
        score: avgScore,
        recommendation: avgRec,
        sentiment: avgSent,
        prominence: avgProm,
        accuracy: avgAcc,
      },
      availableModels,
      selectedModel: model,
      totalBrands: rankedBrands.length,
      runDate,
      timestamp: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error in /api/brands:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
