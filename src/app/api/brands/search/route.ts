import { NextRequest, NextResponse } from 'next/server';

export const revalidate = 3600;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    
    if (!query || query.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const db = await import('@/lib/db').then(m => m.getDb());
    const safeQuery = query.replace(/'/g, "''");
    
    const runResult = db.exec('SELECT id FROM pipeline_runs ORDER BY id DESC LIMIT 1');
    if (runResult.length === 0) return NextResponse.json({ results: [] });
    const runId = runResult[0].values[0][0];

    const results = db.exec(`
      SELECT DISTINCT brand, industry_id, score 
      FROM brand_results 
      WHERE run_id = ${runId} 
      AND brand LIKE '%${safeQuery}%' 
      AND model IS NULL 
      ORDER BY score DESC 
      LIMIT 10
    `);

    if (results.length === 0) return NextResponse.json({ results: [] }, {
      headers: { 'Cache-Control': 'public, max-age=3600' }
    });

    const cols = results[0].columns;
    const items = results[0].values.map(vals => {
      const obj: any = {};
      cols.forEach((c, i) => obj[c] = vals[i]);
      return obj;
    });

    return NextResponse.json({ results: items }, {
      headers: {
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error in search:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
