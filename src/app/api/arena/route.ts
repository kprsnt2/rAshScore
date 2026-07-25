import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateInsight } from '@/lib/insights';

export const revalidate = 3600; // Cache for 1 hour

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const brandA = searchParams.get('brandA');
    const brandB = searchParams.get('brandB');

    if (!brandA || !brandB) {
      return NextResponse.json({ error: 'Missing brandA or brandB' }, { status: 400 });
    }

    const db = await getDb();
    
    // Fetch historical data for both brands
    const safeBrandA = brandA.replace(/'/g, "''");
    const safeBrandB = brandB.replace(/'/g, "''");

    const historyResult = db.exec(`
      SELECT br.brand, br.score, br.recommendation, br.sentiment, pr.run_date
      FROM brand_results br
      JOIN pipeline_runs pr ON br.run_id = pr.id
      WHERE (br.brand COLLATE NOCASE = '${safeBrandA}' OR br.brand COLLATE NOCASE = '${safeBrandB}') AND br.model IS NULL AND br.score > 0
      ORDER BY pr.run_date ASC
    `);

    if (historyResult.length === 0) {
      return NextResponse.json({ error: 'No data found for these brands' }, { status: 404 });
    }

    const cols = historyResult[0].columns;
    const history = historyResult[0].values.map(row => {
      const obj: any = {};
      cols.forEach((c, i) => obj[c] = row[i]);
      return obj as { brand: string; score: number; recommendation: number; sentiment: number; run_date: string };
    });

    const dataA = history.filter(h => h.brand.toLowerCase() === brandA.toLowerCase());
    const dataB = history.filter(h => h.brand.toLowerCase() === brandB.toLowerCase());

    if (dataA.length === 0 || dataB.length === 0) {
      return NextResponse.json({ error: 'One or both brands have no data' }, { status: 404 });
    }

    const latestA = dataA[dataA.length - 1];
    const latestB = dataB[dataB.length - 1];

    const prompt = `You are hosting an AI Battle Arena where two brands are compared based on their visibility in Large Language Models (LLMs).
We have Brand A: ${brandA} and Brand B: ${brandB}.

Current Stats for ${brandA}:
- Score: ${latestA.score}/100
- Recommendation: ${latestA.recommendation}%
- Sentiment: ${latestA.sentiment}%
- Trend over last runs: ${dataA.map(d => d.score).join(' -> ')}

Current Stats for ${brandB}:
- Score: ${latestB.score}/100
- Recommendation: ${latestB.recommendation}%
- Sentiment: ${latestB.sentiment}%
- Trend over last runs: ${dataB.map(d => d.score).join(' -> ')}

Write a 3-part debate formatted in Markdown:
### Agent Pro-${brandA}
(Write a short, punchy argument for why ${brandA} is doing better or has more potential based on the data. Max 4 sentences.)

### Agent Pro-${brandB}
(Write a short, punchy counter-argument for why ${brandB} is actually superior or will overtake soon. Max 4 sentences.)

### The Judge's Verdict
(Declare a winner based purely on the LLM visibility stats provided and give a short concluding reason. Max 4 sentences.)

Keep the tone highly analytical but entertaining. Output ONLY the markdown.`;

    const { text, generatedBy } = await generateInsight(prompt);

    return NextResponse.json({
      historyA: dataA,
      historyB: dataB,
      debateMarkdown: text,
      generatedBy,
    });
  } catch (error) {
    console.error('Arena API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
