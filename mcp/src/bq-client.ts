import { BigQuery } from '@google-cloud/bigquery';

const projectId = process.env.GCP_PROJECT_ID || 'rashscore';
const dataset = process.env.BQ_DATASET || 'brand_intelligence';
const FQ = `${projectId}.${dataset}`;

const bq = new BigQuery({ projectId });

export async function getLatestRunDate(): Promise<string | null> {
  const [rows] = await bq.query({
    query: `SELECT MAX(run_date) as latest FROM \`${FQ}.pipeline_runs\` WHERE status IN ('success','partial')`,
  });
  return rows[0]?.latest?.value ?? null;
}

export async function getBrandScore(brand: string, date: string) {
  const [rows] = await bq.query({
    query: `
      SELECT brand, score, recommendation, sentiment, prominence, accuracy, category, industry_id,
             ROW_NUMBER() OVER (PARTITION BY industry_id ORDER BY score DESC) as rank
      FROM \`${FQ}.brand_scores_aggregated\`
      WHERE run_date = @date AND LOWER(brand) = LOWER(@brand)
    `,
    params: { date, brand },
  });
  return rows[0] || null;
}

export async function searchBrands(query: string, date: string) {
  const [rows] = await bq.query({
    query: `
      SELECT brand, score, recommendation, sentiment, prominence, accuracy, category, industry_id,
             ROW_NUMBER() OVER (PARTITION BY industry_id ORDER BY score DESC) as rank
      FROM \`${FQ}.brand_scores_aggregated\`
      WHERE run_date = @date AND LOWER(brand) LIKE CONCAT('%', LOWER(@query), '%')
      ORDER BY score DESC
      LIMIT 20
    `,
    params: { date, query },
  });
  return rows;
}

export async function getIndustryRankings(industryId: string, date: string, limit: number = 10) {
  const [rows] = await bq.query({
    query: `
      SELECT brand, score, recommendation, sentiment, prominence, accuracy, category
      FROM \`${FQ}.brand_scores_aggregated\`
      WHERE run_date = @date AND industry_id = @industryId
      ORDER BY score DESC
      LIMIT @limit
    `,
    params: { date, industryId, limit },
  });
  return rows;
}

export async function getBrandInsight(industryId: string) {
  const [rows] = await bq.query({
    query: `
      SELECT insight_id, industry_id, insight_date, insight_text, generated_by
      FROM \`${FQ}.industry_insights\`
      WHERE industry_id = @industryId
      ORDER BY insight_date DESC
      LIMIT 1
    `,
    params: { industryId },
  });
  return rows[0] || null;
}

export async function getIndustriesList() {
    // Just hardcoding for now, or could pull from DB. We'll return a static list for the resource
    return [
        { id: "technology", name: "Technology & IT" },
        { id: "automotive", name: "Automotive (Cars & Bikes)" },
        { id: "ecommerce", name: "Retail & E-Commerce" },
        { id: "fashion", name: "Fashion & Apparel" },
        { id: "food-beverage", name: "Food & Beverage" },
        { id: "healthcare", name: "Healthcare & Pharma" },
        { id: "finance", name: "Finance & Banking" },
        { id: "telecom", name: "Telecommunications" },
        { id: "entertainment", name: "Entertainment & Media" },
        { id: "travel", name: "Travel & Hospitality" },
        { id: "energy", name: "Energy & Oil" },
        { id: "fmcg", name: "Consumer Goods (FMCG)" },
        { id: "realestate", name: "Real Estate & Construction" },
        { id: "edtech", name: "Education & EdTech" },
        { id: "logistics", name: "Logistics & Supply Chain" },
        { id: "consumer-electronics", name: "Consumer Electronics" },
        { id: "mobile-phones", name: "Mobile Phones" },
        { id: "home-appliances", name: "Home Appliances" }
    ];
}
