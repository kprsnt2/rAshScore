/**
 * rAsh Score v2.0 — BigQuery Client
 * Replaces the old db.ts (sql.js/better-sqlite3).
 * All dashboard data now comes from BigQuery.
 */

import { BigQuery } from '@google-cloud/bigquery';

const bq = new BigQuery({ projectId: process.env.GCP_PROJECT_ID || 'rashscore' });
const DATASET = process.env.BQ_DATASET || 'brand_intelligence';
const FQ = `${process.env.GCP_PROJECT_ID || 'rashscore'}.${DATASET}`;

// ─── In-memory Cache (60s TTL) ──────────────────────────────────────────────
const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 60_000;

function cached<T>(key: string): T | null {
  const e = cache.get(key);
  if (e && Date.now() - e.ts < CACHE_TTL) return e.data as T;
  return null;
}
function setCache(key: string, data: unknown) {
  cache.set(key, { data, ts: Date.now() });
}

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface BrandScore {
  brand: string;
  score: number;
  recommendation: number;
  sentiment: number;
  prominence: number;
  accuracy: number;
  category: string;
  model: string;
  rank: number;
  score_delta?: number | null;
  rank_delta?: number | null;
}

export interface PipelineRun {
  run_id: string;
  run_date: string;
  provider: string;
  model: string;
  total_brands: number;
  successful_brands: number;
  average_score: number;
  status: string;
}

export interface IndustryInsight {
  insight_id: string;
  industry_id: string;
  insight_date: string;
  insight_text: string;
  generated_by: string;
}

// ─── Queries ────────────────────────────────────────────────────────────────

/** Get the most recent run date */
export async function getLatestRunDate(): Promise<string | null> {
  const ck = 'latest_run_date';
  const c = cached<string>(ck);
  if (c) return c;

  const [rows] = await bq.query({
    query: `SELECT MAX(run_date) as latest FROM \`${FQ}.pipeline_runs\` WHERE status IN ('success','partial')`,
  });
  const d = rows[0]?.latest?.value ?? null;
  if (d) setCache(ck, d);
  return d;
}

/** Get available run dates (last 30) */
export async function getAvailableDates(): Promise<string[]> {
  const ck = 'available_dates';
  const c = cached<string[]>(ck);
  if (c) return c;

  const [rows] = await bq.query({
    query: `SELECT DISTINCT run_date FROM \`${FQ}.pipeline_runs\` WHERE status IN ('success','partial') ORDER BY run_date DESC LIMIT 30`,
  });
  const dates = rows.map((r: { run_date: { value: string } }) => r.run_date.value);
  setCache(ck, dates);
  return dates;
}

/** Get available models for a date + industry */
export async function getAvailableModels(date: string, industryId: string): Promise<string[]> {
  const ck = `models:${date}:${industryId}`;
  const c = cached<string[]>(ck);
  if (c) return c;

  const [rows] = await bq.query({
    query: `SELECT DISTINCT model FROM \`${FQ}.brand_scores\` WHERE run_date = @date AND industry_id = @industryId AND score > 0 ORDER BY model`,
    params: { date, industryId },
  });
  const models = rows.map((r: { model: string }) => r.model);
  setCache(ck, models);
  return models;
}

/** Get brand scores for an industry, date, and model */
export async function getBrandResults(
  date: string,
  industryId: string,
  model: string = 'all',
): Promise<BrandScore[]> {
  const ck = `brands:${date}:${industryId}:${model}`;
  const c = cached<BrandScore[]>(ck);
  if (c) return c;

  let query: string;
  const params: Record<string, string> = { date, industryId };

  if (model === 'all') {
    // Use aggregated view
    query = `
      SELECT brand, score, recommendation, sentiment, prominence, accuracy,
             category, 'all' as model,
             ROW_NUMBER() OVER (ORDER BY score DESC) as rank
      FROM \`${FQ}.brand_scores_aggregated\`
      WHERE run_date = @date AND industry_id = @industryId
      ORDER BY score DESC
    `;
  } else {
    query = `
      SELECT brand, score, recommendation, sentiment, prominence, accuracy,
             category, model,
             ROW_NUMBER() OVER (ORDER BY score DESC) as rank
      FROM \`${FQ}.brand_scores\`
      WHERE run_date = @date AND industry_id = @industryId AND model = @model AND score > 0
      ORDER BY score DESC
    `;
    params.model = model;
  }

  const [rows] = await bq.query({ query, params });

  // Fetch previous day scores for deltas
  const prevScores = await getPreviousDayScores(date, industryId, model);
  const prevMap = new Map(prevScores.map((p) => [p.brand, p]));

  const results: BrandScore[] = rows.map((r: Record<string, unknown>, _i: number) => {
    const prev = prevMap.get(r.brand as string);
    return {
      brand: r.brand as string,
      score: r.score as number,
      recommendation: r.recommendation as number,
      sentiment: r.sentiment as number,
      prominence: r.prominence as number,
      accuracy: r.accuracy as number,
      category: (r.category as string) || industryId,
      model: r.model as string,
      rank: r.rank as number,
      score_delta: prev ? (r.score as number) - prev.score : null,
      rank_delta: prev ? prev.rank - (r.rank as number) : null,
    };
  });

  setCache(ck, results);
  return results;
}

/** Get previous day's scores for delta computation */
async function getPreviousDayScores(
  currentDate: string,
  industryId: string,
  model: string,
): Promise<{ brand: string; score: number; rank: number }[]> {
  const table = model === 'all' ? 'brand_scores_aggregated' : 'brand_scores';
  const modelClause = model === 'all' ? '' : 'AND model = @model';

  const query = `
    SELECT brand, score,
           ROW_NUMBER() OVER (ORDER BY score DESC) as rank
    FROM \`${FQ}.${table}\`
    WHERE industry_id = @industryId
      AND run_date = (
        SELECT MAX(run_date) FROM \`${FQ}.${table}\`
        WHERE industry_id = @industryId AND run_date < @currentDate
        ${modelClause}
      )
      ${modelClause}
      AND score > 0
    ORDER BY score DESC
  `;

  const params: Record<string, string> = { industryId, currentDate };
  if (model !== 'all') params.model = model;

  try {
    const [rows] = await bq.query({ query, params });
    return rows.map((r: Record<string, unknown>) => ({
      brand: r.brand as string,
      score: r.score as number,
      rank: r.rank as number,
    }));
  } catch {
    return [];
  }
}

/** Get score timeline for an industry (up to 30 days) */
export async function getTimeline(industryId: string): Promise<{
  dates: string[];
  avgScores: number[];
  brandData: Record<string, { scores: number[]; ranks: number[] }>;
}> {
  const ck = `timeline:${industryId}`;
  const c = cached<ReturnType<typeof getTimeline> extends Promise<infer T> ? T : never>(ck);
  if (c) return c;

  const [rows] = await bq.query({
    query: `
      SELECT run_date, brand, score,
             ROW_NUMBER() OVER (PARTITION BY run_date ORDER BY score DESC) as rank
      FROM \`${FQ}.brand_scores_aggregated\`
      WHERE industry_id = @industryId
      ORDER BY run_date ASC, score DESC
    `,
    params: { industryId },
  });

  const dateSet = new Set<string>();
  const brandMap: Record<string, Map<string, { score: number; rank: number }>> = {};

  for (const r of rows as Record<string, unknown>[]) {
    const d = (r.run_date as { value: string }).value;
    const brand = r.brand as string;
    dateSet.add(d);

    if (!brandMap[brand]) brandMap[brand] = new Map();
    brandMap[brand].set(d, { score: r.score as number, rank: r.rank as number });
  }

  const dates = Array.from(dateSet).sort();

  // Compute daily averages
  const dateAvgs: Record<string, number[]> = {};
  for (const d of dates) dateAvgs[d] = [];
  for (const [, dateScores] of Object.entries(brandMap)) {
    for (const [d, { score }] of dateScores) {
      dateAvgs[d].push(score);
    }
  }
  const avgScores = dates.map((d) => {
    const arr = dateAvgs[d];
    return arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
  });

  // Brand-level time series
  const brandData: Record<string, { scores: number[]; ranks: number[] }> = {};
  for (const [brand, dateScores] of Object.entries(brandMap)) {
    brandData[brand] = {
      scores: dates.map((d) => dateScores.get(d)?.score ?? 0),
      ranks: dates.map((d) => dateScores.get(d)?.rank ?? 0),
    };
  }

  const result = { dates, avgScores, brandData };
  setCache(ck, result);
  return result;
}

/** Search brands across all industries */
export async function searchBrands(query: string, date?: string): Promise<BrandScore[]> {
  const dateClause = date
    ? 'WHERE run_date = @date'
    : 'WHERE run_date = (SELECT MAX(run_date) FROM `' + FQ + '.brand_scores_aggregated`)';

  const [rows] = await bq.query({
    query: `
      SELECT brand, score, recommendation, sentiment, prominence, accuracy,
             category, model, industry_id,
             ROW_NUMBER() OVER (PARTITION BY industry_id ORDER BY score DESC) as rank
      FROM \`${FQ}.brand_scores_aggregated\`
      ${dateClause}
        AND LOWER(brand) LIKE CONCAT('%', LOWER(@q), '%')
      ORDER BY score DESC
      LIMIT 20
    `,
    params: date ? { q: query, date } : { q: query },
  });

  return rows.map((r: Record<string, unknown>) => ({
    brand: r.brand as string,
    score: r.score as number,
    recommendation: r.recommendation as number,
    sentiment: r.sentiment as number,
    prominence: r.prominence as number,
    accuracy: r.accuracy as number,
    category: (r.category as string) || '',
    model: 'all',
    rank: r.rank as number,
  }));
}

/** Get latest insight for an industry */
export async function getLatestInsight(industryId: string): Promise<IndustryInsight | null> {
  const ck = `insight:${industryId}`;
  const c = cached<IndustryInsight>(ck);
  if (c) return c;

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

  if (!rows.length) return null;
  const r = rows[0] as Record<string, unknown>;
  const insight: IndustryInsight = {
    insight_id: r.insight_id as string,
    industry_id: r.industry_id as string,
    insight_date: (r.insight_date as { value: string }).value,
    insight_text: r.insight_text as string,
    generated_by: r.generated_by as string,
  };
  setCache(ck, insight);
  return insight;
}

/** Get pipeline run history */
export async function getPipelineRuns(limit: number = 10): Promise<PipelineRun[]> {
  const [rows] = await bq.query({
    query: `
      SELECT run_id, run_date, provider, model, total_brands, successful_brands,
             average_score, status
      FROM \`${FQ}.pipeline_runs\`
      ORDER BY run_date DESC, created_at DESC
      LIMIT @limit
    `,
    params: { limit },
  });

  return rows.map((r: Record<string, unknown>) => ({
    run_id: r.run_id as string,
    run_date: (r.run_date as { value: string }).value,
    provider: r.provider as string,
    model: r.model as string,
    total_brands: r.total_brands as number,
    successful_brands: r.successful_brands as number,
    average_score: r.average_score as number,
    status: r.status as string,
  }));
}

/** Health check — verify BigQuery connectivity */
export async function healthCheck(): Promise<{ ok: boolean; latency: number }> {
  const start = Date.now();
  try {
    await bq.query({ query: 'SELECT 1' });
    return { ok: true, latency: Date.now() - start };
  } catch {
    return { ok: false, latency: Date.now() - start };
  }
}

/** Get a specific brand's score for the chat assistant */
export async function getBrandScore(brand: string, date: string): Promise<BrandScore | null> {
  const [rows] = await bq.query({
    query: `
      SELECT brand, score, recommendation, sentiment, prominence, accuracy,
             category, model, industry_id,
             ROW_NUMBER() OVER (PARTITION BY industry_id ORDER BY score DESC) as rank
      FROM \`${FQ}.brand_scores_aggregated\`
      WHERE run_date = @date
        AND LOWER(brand) = LOWER(@brand)
      LIMIT 1
    `,
    params: { date, brand },
  });

  if (!rows.length) return null;
  const r = rows[0] as Record<string, unknown>;
  return {
    brand: r.brand as string,
    score: r.score as number,
    recommendation: r.recommendation as number,
    sentiment: r.sentiment as number,
    prominence: r.prominence as number,
    accuracy: r.accuracy as number,
    category: (r.category as string) || '',
    model: 'all',
    rank: r.rank as number,
  };
}

/** Get top ranked brands for an industry for the chat assistant */
export async function getIndustryRankings(industryId: string, date: string, limit: number = 5): Promise<BrandScore[]> {
  const [rows] = await bq.query({
    query: `
      SELECT brand, score, recommendation, sentiment, prominence, accuracy,
             category, model, industry_id,
             ROW_NUMBER() OVER (ORDER BY score DESC) as rank
      FROM \`${FQ}.brand_scores_aggregated\`
      WHERE run_date = @date AND industry_id = @industryId
      ORDER BY score DESC
      LIMIT @limit
    `,
    params: { date, industryId, limit },
  });

  return rows.map((r: Record<string, unknown>) => ({
    brand: r.brand as string,
    score: r.score as number,
    recommendation: r.recommendation as number,
    sentiment: r.sentiment as number,
    prominence: r.prominence as number,
    accuracy: r.accuracy as number,
    category: (r.category as string) || '',
    model: 'all',
    rank: r.rank as number,
  }));
}
