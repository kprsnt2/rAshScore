/**
 * GET /api/brands/insights?industry=technology
 *
 * Returns the latest AI-generated insight for a given industry.
 * Tries today's date first, falls back to the most recent available.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getLatestInsight } from '@/lib/db';
import { INDUSTRIES } from '@/lib/industry-data';

export const revalidate = 3600;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const industryId = searchParams.get('industry') || 'technology';

    // Validate industry
    const industryMeta = INDUSTRIES.find(i => i.id === industryId);
    if (!industryMeta) {
      return NextResponse.json({ error: 'Invalid industry' }, { status: 400 });
    }

    const insight = await getLatestInsight(industryId);

    if (!insight) {
      return NextResponse.json(
        {
          industryId,
          insight: null,
          message: 'No insight available yet. Insights are generated daily after the pipeline run.',
        },
        {
          headers: { 'Cache-Control': 'public, max-age=1800' },
        }
      );
    }

    const today = new Date().toISOString().split('T')[0];
    const isToday = insight.insight_date === today;

    return NextResponse.json(
      {
        industryId,
        insight: insight.insight_text,
        generatedBy: insight.generated_by,
        date: insight.insight_date,
        isToday,
        // Surface a warning if this is stale (not today's)
        staleWarning: isToday
          ? null
          : `Today's insight hasn't been generated yet. Showing insight from ${insight.insight_date}.`,
      },
      {
        headers: {
          'Cache-Control': isToday ? 'public, max-age=3600' : 'public, max-age=900',
        },
      }
    );
  } catch (error) {
    console.error('Error in /api/brands/insights:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
