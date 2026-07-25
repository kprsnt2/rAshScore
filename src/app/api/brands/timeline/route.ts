/**
 * GET /api/brands/timeline?industry=technology
 *
 * Returns historical score/rank data for brands in an industry,
 * computed from all pipeline runs in the SQLite database.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getTimeline } from '@/lib/db';
import { INDUSTRIES } from '@/lib/industry-data';

export const revalidate = 3600;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const industryId = searchParams.get('industry') || 'technology';

    // Validate industry
    if (!INDUSTRIES.find(i => i.id === industryId)) {
      return NextResponse.json({ error: 'Invalid industry' }, { status: 400 });
    }

    const timeline = await getTimeline(industryId);

    return NextResponse.json(timeline, {
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
