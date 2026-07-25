import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateInsight } from '@/lib/insights';

export const revalidate = 3600;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const brand = searchParams.get('brand');
    const industry = searchParams.get('industry');

    if (!brand || !industry) {
      return NextResponse.json({ error: 'Missing brand or industry parameter' }, { status: 400 });
    }

    const db = await getDb();
    
    // Fetch latest metrics for this brand
    const safeBrand = brand.replace(/'/g, "''");
    
    const result = db.exec(`
      SELECT score, recommendation, sentiment, prominence, accuracy
      FROM brand_results
      WHERE brand = '${safeBrand}' AND model IS NULL AND score > 0
      ORDER BY run_id DESC
      LIMIT 1
    `);

    if (result.length === 0 || result[0].values.length === 0) {
      return NextResponse.json({ error: 'Brand data not found' }, { status: 404 });
    }

    const row = result[0].values[0];
    const score = row[0] as number;
    const recommendation = row[1] as number;
    const sentiment = row[2] as number;
    const prominence = row[3] as number;
    const accuracy = row[4] as number;

    const prompt = `You are the "rAsh Engine", an elite SEO and LLMO (Large Language Model Optimization) strategist.
Your client is the brand "${brand}" in the "${industry}" industry.

Their current AI Visibility Metrics:
- Overall Score: ${score}/100
- Recommendation Rate: ${recommendation}% (how often AI models recommend this brand)
- Sentiment Score: ${sentiment}% (overall reputation & tone in AI responses)
- Prominence Score: ${prominence}% (brand visibility & recognition in AI)
- Accuracy Score: ${accuracy}% (data confidence level)

Write a highly actionable, 3-step action plan on how this brand can manipulate or improve its visibility in Large Language Models.
Consider these rules:
- If sentiment is low (<50%), prioritize reputation management and PR strategies.
- If recommendation is low (<50%), suggest product comparison positioning and review seeding.
- If prominence is low (<50%), suggest content marketing and knowledge graph optimization.
- If accuracy is low (<50%), suggest authoritative source building and structured data improvements.
- If everything is high (>70%), suggest defensive moat strategies to maintain dominance.

Output ONLY the action plan formatted in clean Markdown. Start directly with the first step (e.g., "### Step 1: ..."). Use bold text for emphasis. Do not include introductory text.`;

    const { text, generatedBy } = await generateInsight(prompt);

    return NextResponse.json({
      plan: text,
      metrics: { score, recommendation, sentiment, prominence, accuracy },
      generatedBy,
    });
  } catch (error) {
    console.error('rAsh Engine API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
