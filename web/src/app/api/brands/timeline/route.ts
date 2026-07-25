/**
 * GET /api/brands/timeline?industry=technology
 * Returns historical score data from BigQuery.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getTimeline } from '@/lib/bq';
import { INDUSTRIES } from '@/lib/industry-data';

export const revalidate = 3600;

export async function GET(request: NextRequest) {
  try {
    const industryId = new URL(request.url).searchParams.get('industry') || 'technology';

    const industryMeta = INDUSTRIES.find(i => i.id === industryId);
    if (!industryMeta) {
      return NextResponse.json({ error: 'Invalid industry' }, { status: 400 });
    }

    const { dates, avgScores, brandData } = await getTimeline(industryId);

    // Convert to format expected by dashboard
    const brands: Record<string, { date: string; score: number; rank: number }[]> = {};
    for (const [brand, data] of Object.entries(brandData)) {
      brands[brand] = dates.map((d, i) => ({
        date: d,
        score: data.scores[i],
        rank: data.ranks[i],
      })).filter(e => e.score > 0);
    }

    return NextResponse.json({
      dates,
      avgScores,
      brands,
    }, {
      headers: {
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error in /api/brands/timeline:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
