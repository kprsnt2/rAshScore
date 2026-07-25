/**
 * GET /api/brands?industry=technology&model=all
 *
 * Returns ranked brands for a given industry from the SQLite database.
 * Supports model filtering and previous-day comparison data.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getRun, getBrandResults, getAvailableModels, getIndustryResult, getAllRunDates } from '@/lib/db';
import { INDUSTRIES } from '@/lib/industry-data';

export const revalidate = 3600;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const industryId = searchParams.get('industry') || 'technology';
    const model = searchParams.get('model') || 'all';
    const topN = searchParams.get('top') ? parseInt(searchParams.get('top')!, 10) : null;

    // Validate industry
    const industryMeta = INDUSTRIES.find(i => i.id === industryId);
    if (!industryMeta) {
      return NextResponse.json({ error: 'Invalid industry' }, { status: 400 });
    }

    // Get latest run
    const latestRun = await getRun();
    if (!latestRun) {
      return NextResponse.json({ error: 'No pipeline data available' }, { status: 404 });
    }

    // Get brand results
    const db = await import('@/lib/db').then(m => m.getDb());
    
    // Find distinct dates that have data for this industry, ordered by newest first.
    // We use dates (not run_ids) because multiple runs can share the same date
    // (one per model), and we need to compare across genuinely different days.
    const industryDatesQuery = db.exec(`
      SELECT DISTINCT pr.run_date
      FROM brand_results br
      JOIN pipeline_runs pr ON pr.id = br.run_id
      WHERE br.industry_id = '${industryId}'
      ORDER BY pr.run_date DESC
    `);

    if (industryDatesQuery.length === 0 || industryDatesQuery[0].values.length === 0) {
      return NextResponse.json({ error: 'No pipeline data available for this industry' }, { status: 404 });
    }

    const currentDate = industryDatesQuery[0].values[0][0] as string;

    // Get the latest run_id on the current date for this industry
    const currentRunResult = db.exec(`
      SELECT pr.id FROM pipeline_runs pr
      JOIN brand_results br ON br.run_id = pr.id
      WHERE pr.run_date = '${currentDate}' AND br.industry_id = '${industryId}'
      ORDER BY pr.id DESC LIMIT 1
    `);
    const currentRunId = currentRunResult[0].values[0][0] as number;

    const brands = await getBrandResults(currentRunId, industryId, model);
    const availableModels = await getAvailableModels(currentRunId, industryId);
    const industryResult = await getIndustryResult(currentRunId, industryId);

    // Get previous day's data for change calculations
    let prevBrands: typeof brands = [];
    if (industryDatesQuery[0].values.length > 1) {
      const prevDate = industryDatesQuery[0].values[1][0] as string;
      // Get any run_id from the previous date — getBrandResults will find
      // all runs on that date when looking for a specific model
      const prevRunResult = db.exec(`
        SELECT pr.id FROM pipeline_runs pr
        JOIN brand_results br ON br.run_id = pr.id
        WHERE pr.run_date = '${prevDate}' AND br.industry_id = '${industryId}'
        ORDER BY pr.id DESC LIMIT 1
      `);
      if (prevRunResult.length > 0 && prevRunResult[0].values.length > 0) {
        const prevRunId = prevRunResult[0].values[0][0] as number;
        prevBrands = await getBrandResults(prevRunId, industryId, model);
      }
    }

    // Build prev lookup
    const prevMap: Record<string, { score: number; rank: number }> = {};
    prevBrands.forEach((b, i) => {
      prevMap[b.brand] = { score: b.score, rank: i + 1 };
    });

    // Format response
    const rankedBrands = brands.map((b, index) => {
      const prev = prevMap[b.brand];
      return {
        brand: b.brand,
        score: b.score,
        breakdown: {
          recommendation: b.recommendation,
          sentiment: b.sentiment,
          prominence: b.prominence,
          accuracy: b.accuracy,
        },
        rank: index + 1,
        scoreChange: prev ? b.score - prev.score : null,
        rankChange: prev ? prev.rank - (index + 1) : null,
      };
    });

    return NextResponse.json({
      industry: {
        id: industryId,
        name: industryMeta.name,
        category: industryMeta.category,
      },
      brands: topN ? rankedBrands.slice(0, topN) : rankedBrands,
      industryAverage: {
        score: industryResult?.avg_score || 0,
        recommendation: industryResult?.avg_recommendation || 0,
        sentiment: industryResult?.avg_sentiment || 0,
        prominence: industryResult?.avg_prominence || 0,
        accuracy: industryResult?.avg_accuracy || 0,
      },
      availableModels,
      selectedModel: model,
      totalBrands: rankedBrands.length,
      runDate: latestRun.run_date,
      timestamp: latestRun.created_at,
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
