/**
 * rAsh Score v2.0 — High-Performance Data Layer
 * Primary: Ultra-fast (15ms) Google Cloud Storage static JSON fetch
 * Fallback: BigQuery live queries
 */

import { BigQuery } from '@google-cloud/bigquery';

const bq = new BigQuery({ projectId: process.env.GCP_PROJECT_ID || 'rashscore' });
const DATASET = process.env.BQ_DATASET || 'brand_intelligence';
const FQ = `${process.env.GCP_PROJECT_ID || 'rashscore'}.${DATASET}`;
const GCS_URL = process.env.GCS_DATA_URL || 'https://storage.googleapis.com/rashscore-public-data/dashboard_latest.json';

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

function parseDate(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val !== null && 'value' in val) {
    return String((val as { value: unknown }).value);
  }
  return String(val);
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

// ─── GCS Fast-Fetch Cache ───────────────────────────────────────────────────

interface GCSDashboardPayload {
  run_date: string;
  timestamp: string;
  industries: Record<string, BrandScore[]>;
}

async function fetchGCSDashboard(): Promise<GCSDashboardPayload | null> {
  const ck = 'gcs_dashboard_payload';
  const c = cached<GCSDashboardPayload>(ck);
  if (c) return c;

  try {
    const res = await fetch(GCS_URL, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const data = (await res.json()) as GCSDashboardPayload;
    if (data && data.industries) {
      setCache(ck, data);
      return data;
    }
  } catch {
    // Silently ignore GCS fetch errors, fall back to BigQuery
  }
  return null;
}

// ─── Queries ────────────────────────────────────────────────────────────────

/** Get the most recent run date */
export async function getLatestRunDate(): Promise<string | null> {
  const ck = 'latest_run_date';
  const c = cached<string>(ck);
  if (c) return c;

  // Try GCS first (15ms)
  const gcs = await fetchGCSDashboard();
  if (gcs?.run_date) {
    setCache(ck, gcs.run_date);
    return gcs.run_date;
  }

  // Fallback to BigQuery
  try {
    const [rows] = await bq.query({
      query: `
        SELECT MAX(latest) as latest FROM (
          SELECT MAX(run_date) as latest FROM \`${FQ}.brand_scores_aggregated\`
          UNION ALL
          SELECT MAX(run_date) as latest FROM \`${FQ}.pipeline_runs\` WHERE status IN ('success','partial')
          UNION ALL
          SELECT MAX(run_date) as latest FROM \`${FQ}.brand_scores\` WHERE score > 0
        )
      `,
    });
    const d = parseDate(rows[0]?.latest);
    if (d) setCache(ck, d);
    return d || null;
  } catch (err) {
    console.error('Error fetching latest run date:', err);
    return null;
  }
}

/** Get available run dates (last 30) */
export async function getAvailableDates(): Promise<string[]> {
  const ck = 'available_dates';
  const c = cached<string[]>(ck);
  if (c) return c;

  try {
    const [rows] = await bq.query({
      query: `
        SELECT DISTINCT run_date FROM (
          SELECT run_date FROM \`${FQ}.brand_scores_aggregated\`
          UNION DISTINCT
          SELECT run_date FROM \`${FQ}.pipeline_runs\` WHERE status IN ('success','partial')
          UNION DISTINCT
          SELECT run_date FROM \`${FQ}.brand_scores\` WHERE score > 0
        ) ORDER BY run_date DESC LIMIT 30
      `,
    });
    const dates = rows.map((r: Record<string, unknown>) => parseDate(r.run_date)).filter(Boolean);
    setCache(ck, dates);
    return dates;
  } catch {
    return [];
  }
}

/** Get available models for a date + industry */
export async function getAvailableModels(date: string, industryId: string): Promise<string[]> {
  const ck = `models:${date}:${industryId}`;
  const c = cached<string[]>(ck);
  if (c) return c;

  try {
    const [rows] = await bq.query({
      query: `SELECT DISTINCT model FROM \`${FQ}.brand_scores\` WHERE run_date = CAST(@date AS DATE) AND industry_id = @industryId AND score > 0 ORDER BY model`,
      params: { date, industryId },
    });
    const models = rows.map((r: { model: string }) => r.model);
    setCache(ck, models);
    return models;
  } catch {
    return [];
  }
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

  // If requesting 'all' model, try GCS fast-path (15ms)
  if (model === 'all') {
    const gcs = await fetchGCSDashboard();
    if (gcs && gcs.industries) {
      const gcsBrands = gcs.industries[industryId] || gcs.industries[industryId.replace(/-/g, '_')];
      if (gcsBrands && gcsBrands.length > 0) {
        setCache(ck, gcsBrands);
        return gcsBrands;
      }
    }
  }

  let rows: Record<string, unknown>[] = [];
  const params: Record<string, string> = { date, industryId };

  if (model === 'all') {
    // 1. Try brand_scores_aggregated
    try {
      const [qRows] = await bq.query({
        query: `
          SELECT brand, score, recommendation, sentiment, prominence, accuracy,
                 category, 'all' as model,
                 ROW_NUMBER() OVER (ORDER BY score DESC) as rank
          FROM \`${FQ}.brand_scores_aggregated\`
          WHERE run_date = CAST(@date AS DATE) AND industry_id = @industryId
          ORDER BY score DESC
        `,
        params,
      });
      rows = qRows as Record<string, unknown>[];
    } catch {
      // ignore, fall back
    }

    // 2. Fallback to raw brand_scores table
    if (rows.length === 0) {
      try {
        const [fbRows] = await bq.query({
          query: `
            SELECT brand,
                   CAST(ROUND(AVG(score)) AS INT64) as score,
                   CAST(ROUND(AVG(recommendation)) AS INT64) as recommendation,
                   CAST(ROUND(AVG(sentiment)) AS INT64) as sentiment,
                   CAST(ROUND(AVG(prominence)) AS INT64) as prominence,
                   CAST(ROUND(AVG(accuracy)) AS INT64) as accuracy,
                   ANY_VALUE(category) as category,
                   'all' as model,
                   ROW_NUMBER() OVER (ORDER BY AVG(score) DESC) as rank
            FROM \`${FQ}.brand_scores\`
            WHERE run_date = CAST(@date AS DATE) AND industry_id = @industryId AND score > 0 AND error IS NULL
            GROUP BY brand
            ORDER BY score DESC
          `,
          params,
        });
        rows = fbRows as Record<string, unknown>[];
      } catch (err) {
        console.error('Fallback query error:', err);
      }
    }
  } else {
    try {
      const [qRows] = await bq.query({
        query: `
          SELECT brand, score, recommendation, sentiment, prominence, accuracy,
                 category, model,
                 ROW_NUMBER() OVER (ORDER BY score DESC) as rank
          FROM \`${FQ}.brand_scores\`
          WHERE run_date = CAST(@date AS DATE) AND industry_id = @industryId AND model = @model AND score > 0
          ORDER BY score DESC
        `,
        params: { date, industryId, model },
      });
      rows = qRows as Record<string, unknown>[];
    } catch (err) {
      console.error('Model query error:', err);
    }
  }

  // Fetch previous day scores for deltas
  const prevScores = await getPreviousDayScores(date, industryId, model);
  const prevMap = new Map(prevScores.map((p) => [p.brand, p]));

  const results: BrandScore[] = rows.map((r: Record<string, unknown>) => {
    const prev = prevMap.get(r.brand as string);
    return {
      brand: r.brand as string,
      score: Number(r.score) || 0,
      recommendation: Number(r.recommendation) || 0,
      sentiment: Number(r.sentiment) || 0,
      prominence: Number(r.prominence) || 0,
      accuracy: Number(r.accuracy) || 0,
      category: (r.category as string) || industryId,
      model: r.model as string,
      rank: Number(r.rank) || 0,
      score_delta: prev ? (Number(r.score) || 0) - prev.score : null,
      rank_delta: prev ? prev.rank - (Number(r.rank) || 0) : null,
    };
  });

  if (results.length > 0) {
    setCache(ck, results);
  }
  return results;
}

/** Get previous day's scores for delta computation */
async function getPreviousDayScores(
  currentDate: string,
  industryId: string,
  model: string,
): Promise<{ brand: string; score: number; rank: number }[]> {
  const modelClause = model === 'all' ? '' : 'AND model = @model';

  const query = `
    SELECT brand, CAST(ROUND(AVG(score)) AS INT64) as score,
           ROW_NUMBER() OVER (ORDER BY AVG(score) DESC) as rank
    FROM \`${FQ}.brand_scores\`
    WHERE industry_id = @industryId
      AND run_date = (
        SELECT MAX(run_date) FROM \`${FQ}.brand_scores\`
        WHERE industry_id = @industryId AND run_date < CAST(@currentDate AS DATE) AND score > 0
        ${modelClause}
      )
      ${modelClause}
      AND score > 0 AND error IS NULL
    GROUP BY brand
    ORDER BY score DESC
  `;

  const params: Record<string, string> = { industryId, currentDate };
  if (model !== 'all') params.model = model;

  try {
    const [rows] = await bq.query({ query, params });
    return rows.map((r: Record<string, unknown>) => ({
      brand: r.brand as string,
      score: Number(r.score) || 0,
      rank: Number(r.rank) || 0,
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

  try {
    const [rows] = await bq.query({
      query: `
        SELECT run_date, brand, CAST(ROUND(AVG(score)) AS INT64) as score,
               ROW_NUMBER() OVER (PARTITION BY run_date ORDER BY AVG(score) DESC) as rank
        FROM \`${FQ}.brand_scores\`
        WHERE industry_id = @industryId AND score > 0 AND error IS NULL
        GROUP BY run_date, brand
        ORDER BY run_date ASC, score DESC
      `,
      params: { industryId },
    });

    const dateSet = new Set<string>();
    const brandMap: Record<string, Map<string, { score: number; rank: number }>> = {};

    for (const r of rows as Record<string, unknown>[]) {
      const d = parseDate(r.run_date);
      const brand = r.brand as string;
      if (d) dateSet.add(d);

      if (!brandMap[brand]) brandMap[brand] = new Map();
      brandMap[brand].set(d, { score: Number(r.score) || 0, rank: Number(r.rank) || 0 });
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
  } catch {
    return { dates: [], avgScores: [], brandData: {} };
  }
}

/** Search brands across all industries */
export async function searchBrands(query: string, date?: string): Promise<BrandScore[]> {
  const dateClause = date
    ? 'WHERE run_date = CAST(@date AS DATE)'
    : 'WHERE run_date = (SELECT MAX(run_date) FROM `' + FQ + '.brand_scores`)';

  try {
    const [rows] = await bq.query({
      query: `
        SELECT brand,
               CAST(ROUND(AVG(score)) AS INT64) as score,
               CAST(ROUND(AVG(recommendation)) AS INT64) as recommendation,
               CAST(ROUND(AVG(sentiment)) AS INT64) as sentiment,
               CAST(ROUND(AVG(prominence)) AS INT64) as prominence,
               CAST(ROUND(AVG(accuracy)) AS INT64) as accuracy,
               ANY_VALUE(category) as category,
               'all' as model,
               ANY_VALUE(industry_id) as industry_id,
               ROW_NUMBER() OVER (ORDER BY AVG(score) DESC) as rank
        FROM \`${FQ}.brand_scores\`
        ${dateClause}
          AND LOWER(brand) LIKE CONCAT('%', LOWER(@q), '%')
          AND score > 0 AND error IS NULL
        GROUP BY brand
        ORDER BY score DESC
        LIMIT 20
      `,
      params: date ? { q: query, date } : { q: query },
    });

    return rows.map((r: Record<string, unknown>) => ({
      brand: r.brand as string,
      score: Number(r.score) || 0,
      recommendation: Number(r.recommendation) || 0,
      sentiment: Number(r.sentiment) || 0,
      prominence: Number(r.prominence) || 0,
      accuracy: Number(r.accuracy) || 0,
      category: (r.category as string) || '',
      model: 'all',
      rank: Number(r.rank) || 0,
    }));
  } catch {
    return [];
  }
}

/** Get latest insight for an industry */
export async function getLatestInsight(industryId: string): Promise<IndustryInsight | null> {
  const ck = `insight:${industryId}`;
  const c = cached<IndustryInsight>(ck);
  if (c) return c;

  try {
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
      insight_date: parseDate(r.insight_date),
      insight_text: r.insight_text as string,
      generated_by: r.generated_by as string,
    };
    setCache(ck, insight);
    return insight;
  } catch {
    return null;
  }
}

/** Get pipeline run history */
export async function getPipelineRuns(limit: number = 10): Promise<PipelineRun[]> {
  try {
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
      run_date: parseDate(r.run_date),
      provider: r.provider as string,
      model: r.model as string,
      total_brands: Number(r.total_brands) || 0,
      successful_brands: Number(r.successful_brands) || 0,
      average_score: Number(r.average_score) || 0,
      status: r.status as string,
    }));
  } catch {
    return [];
  }
}

/** Health check — verify BigQuery connectivity */
export async function healthCheck(): Promise<{ ok: boolean; latency: number; error?: string }> {
  const start = Date.now();
  try {
    await bq.query({ query: 'SELECT 1' });
    return { ok: true, latency: Date.now() - start };
  } catch (err: any) {
    return { ok: false, latency: Date.now() - start, error: err?.message || String(err) };
  }
}

/** Get a specific brand's score for the chat assistant */
export async function getBrandScore(brand: string, date: string): Promise<BrandScore | null> {
  try {
    const [rows] = await bq.query({
      query: `
        SELECT brand,
               CAST(ROUND(AVG(score)) AS INT64) as score,
               CAST(ROUND(AVG(recommendation)) AS INT64) as recommendation,
               CAST(ROUND(AVG(sentiment)) AS INT64) as sentiment,
               CAST(ROUND(AVG(prominence)) AS INT64) as prominence,
               CAST(ROUND(AVG(accuracy)) AS INT64) as accuracy,
               ANY_VALUE(category) as category,
               'all' as model,
               ANY_VALUE(industry_id) as industry_id,
               1 as rank
        FROM \`${FQ}.brand_scores\`
        WHERE run_date = CAST(@date AS DATE)
          AND LOWER(brand) = LOWER(@brand)
          AND score > 0 AND error IS NULL
        GROUP BY brand
        LIMIT 1
      `,
      params: { date, brand },
    });

    if (!rows.length) return null;
    const r = rows[0] as Record<string, unknown>;
    return {
      brand: r.brand as string,
      score: Number(r.score) || 0,
      recommendation: Number(r.recommendation) || 0,
      sentiment: Number(r.sentiment) || 0,
      prominence: Number(r.prominence) || 0,
      accuracy: Number(r.accuracy) || 0,
      category: (r.category as string) || '',
      model: 'all',
      rank: Number(r.rank) || 0,
    };
  } catch {
    return null;
  }
}

/** Get top ranked brands for an industry for the chat assistant */
export async function getIndustryRankings(industryId: string, date: string, limit: number = 5): Promise<BrandScore[]> {
  try {
    const [rows] = await bq.query({
      query: `
        SELECT brand,
               CAST(ROUND(AVG(score)) AS INT64) as score,
               CAST(ROUND(AVG(recommendation)) AS INT64) as recommendation,
               CAST(ROUND(AVG(sentiment)) AS INT64) as sentiment,
               CAST(ROUND(AVG(prominence)) AS INT64) as prominence,
               CAST(ROUND(AVG(accuracy)) AS INT64) as accuracy,
               ANY_VALUE(category) as category,
               'all' as model,
               ROW_NUMBER() OVER (ORDER BY AVG(score) DESC) as rank
        FROM \`${FQ}.brand_scores\`
        WHERE run_date = CAST(@date AS DATE) AND industry_id = @industryId AND score > 0 AND error IS NULL
        GROUP BY brand
        ORDER BY score DESC
        LIMIT @limit
      `,
      params: { date, industryId, limit },
    });

    return rows.map((r: Record<string, unknown>) => ({
      brand: r.brand as string,
      score: Number(r.score) || 0,
      recommendation: Number(r.recommendation) || 0,
      sentiment: Number(r.sentiment) || 0,
      prominence: Number(r.prominence) || 0,
      accuracy: Number(r.accuracy) || 0,
      category: (r.category as string) || '',
      model: 'all',
      rank: Number(r.rank) || 0,
    }));
  } catch {
    return [];
  }
}
