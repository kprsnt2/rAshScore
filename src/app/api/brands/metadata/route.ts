/**
 * GET /api/brands/metadata
 *
 * Returns summary stats: last run info, available industries,
 * total brands, run dates, etc.
 */
import { NextResponse } from 'next/server';
import { getRun, getAllRunDates, getAllIndustryResults } from '@/lib/db';
import { INDUSTRIES } from '@/lib/industry-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const latestRun = await getRun();
    if (!latestRun) {
      return NextResponse.json({ error: 'No pipeline data available' }, { status: 404 });
    }

    const allDates = await getAllRunDates();
    const industryResults = await getAllIndustryResults(latestRun.id);

    // Industries with data in latest run
    const industriesWithData = industryResults
      .filter(ir => ir.successful_brands > 0)
      .map(ir => ({
        id: ir.industry_id,
        name: ir.industry_name,
        brandCount: ir.successful_brands,
        avgScore: Math.round(ir.avg_score),
      }));

    return NextResponse.json({
      latestRun: {
        date: latestRun.run_date,
        totalBrands: latestRun.total_brands,
        successfulBrands: latestRun.successful_brands,
        averageScore: latestRun.average_score,
        highestScore: latestRun.highest_score,
        lowestScore: latestRun.lowest_score,
        timestamp: latestRun.created_at,
      },
      totalRuns: allDates.length,
      runDates: allDates,
      industries: industriesWithData,
      totalIndustries: INDUSTRIES.length,
    });
  } catch (error) {
    console.error('Error in /api/brands/metadata:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
