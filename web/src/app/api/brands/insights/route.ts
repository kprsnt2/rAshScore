/**
 * GET /api/brands/insights?industry=technology
 * Returns latest AI insight for an industry from BigQuery.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getLatestInsight, getLatestRunDate } from '@/lib/bq';
import { INDUSTRIES } from '@/lib/industry-data';

export const revalidate = 3600;

export async function GET(request: NextRequest) {
  try {
    const industryId = new URL(request.url).searchParams.get('industry') || 'technology';

    const industryMeta = INDUSTRIES.find(i => i.id === industryId);
    if (!industryMeta) {
      return NextResponse.json({ error: 'Invalid industry' }, { status: 400 });
    }

    const insight = await getLatestInsight(industryId);
    const latestRunDate = await getLatestRunDate();

    if (!insight) {
      return NextResponse.json({
        industryId,
        insight: null,
        message: 'AI insights generate daily after the pipeline run.',
      });
    }

    // Check if insight is from today
    const isToday = insight.insight_date === latestRunDate;
    const staleWarning = !isToday
      ? `This insight is from ${insight.insight_date}. A fresh insight will generate after the next pipeline run.`
      : null;

    return NextResponse.json({
      industryId,
      insight: insight.insight_text,
      generatedBy: insight.generated_by,
      date: insight.insight_date,
      isToday,
      staleWarning,
    }, {
      headers: {
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error in /api/brands/insights:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
