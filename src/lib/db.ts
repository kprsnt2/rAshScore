/**
 * Shared SQLite database helper for API routes.
 * Uses sql.js (pure WASM) for Vercel serverless compatibility.
 * Opens the brand-intelligence.db in read-only mode for serving data.
 */
// NOTE: InsightRow is also defined in src/lib/insights.ts for the pipeline script.
// This duplicate is intentional: the pipeline uses better-sqlite3 (Node),
// the API routes use sql.js (WASM). Keeping them separate avoids cross-importing.
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import * as path from 'path';
import * as fs from 'fs';

let _db: SqlJsDatabase | null = null;

export async function getDb(): Promise<SqlJsDatabase> {
  if (_db) return _db;

  const dbPath = path.join(process.cwd(), 'data', 'brand-intelligence.db');

  if (!fs.existsSync(dbPath)) {
    throw new Error(`Database not found: ${dbPath}`);
  }

  // Locate the WASM binary for sql.js
  const wasmPath = path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  const wasmBinary = fs.readFileSync(wasmPath);
  const SQL = await initSqlJs({ wasmBinary: wasmBinary.buffer as ArrayBuffer });

  const buffer = fs.readFileSync(dbPath);
  _db = new SQL.Database(new Uint8Array(buffer) as unknown as number[]);
  return _db;
}

// --- Query helpers ---

// Helper to convert sql.js result rows to objects
function rowsToObjects<T>(result: initSqlJs.QueryExecResult[]): T[] {
  if (result.length === 0) return [];
  const cols = result[0].columns;
  return result[0].values.map(vals => {
    const obj: Record<string, unknown> = {};
    cols.forEach((c, i) => obj[c] = vals[i]);
    return obj as T;
  });
}

function rowToObject<T>(result: initSqlJs.QueryExecResult[]): T | undefined {
  const rows = rowsToObjects<T>(result);
  return rows.length > 0 ? rows[0] : undefined;
}

export interface BrandRow {
  id: number;
  run_id: number;
  industry_id: string;
  brand: string;
  category: string;
  score: number;
  recommendation: number;
  sentiment: number;
  prominence: number;
  accuracy: number;
  response_time_ms: number;
  error: string | null;
  model: string | null;
}

export interface RunRow {
  id: number;
  run_date: string;
  total_industries: number;
  total_brands: number;
  successful_brands: number;
  average_score: number;
  highest_score: number;
  lowest_score: number;
  total_time_ms: number;
  created_at: string;
}

export interface IndustryRow {
  id: number;
  run_id: number;
  industry_id: string;
  industry_name: string;
  avg_score: number;
  avg_recommendation: number;
  avg_sentiment: number;
  avg_prominence: number;
  avg_accuracy: number;
  total_brands: number;
  successful_brands: number;
  response_time_ms: number;
  error: string | null;
}

/** Get the latest pipeline run, or a specific one by date */
export async function getRun(date?: string): Promise<RunRow | undefined> {
  const db = await getDb();
  if (date) {
    return rowToObject<RunRow>(db.exec(`SELECT * FROM pipeline_runs WHERE run_date = '${date}'`));
  }
  return rowToObject<RunRow>(db.exec('SELECT * FROM pipeline_runs ORDER BY id DESC LIMIT 1'));
}

/** Get all run dates (chronological) */
export async function getAllRunDates(): Promise<string[]> {
  const db = await getDb();
  const rows = rowsToObjects<{ run_date: string }>(
    db.exec('SELECT run_date FROM pipeline_runs ORDER BY run_date ASC')
  );
  return rows.map(r => r.run_date);
}

/** Get brand results for a run + industry, optionally filtered by model.
 *  When model is specified, searches across all runs on the same date
 *  (since each model may be in a different run). */
export async function getBrandResults(runId: number, industryId: string, model?: string): Promise<BrandRow[]> {
  const db = await getDb();
  if (model && model !== 'all') {
    // Model-specific: search across all runs on the same date
    const runRow = rowToObject<{ run_date: string }>(db.exec(
      `SELECT run_date FROM pipeline_runs WHERE id = ${runId}`
    ));
    if (!runRow) return [];
    const allRunIds = rowsToObjects<{ id: number }>(db.exec(
      `SELECT id FROM pipeline_runs WHERE run_date = '${runRow.run_date}'`
    ));
    const ids = allRunIds.map(r => r.id);
    if (ids.length === 0) return [];
    return rowsToObjects<BrandRow>(db.exec(
      `SELECT * FROM brand_results WHERE run_id IN (${ids.join(',')}) AND industry_id = '${industryId}' AND model = '${model}' AND score > 0 ORDER BY score DESC`
    ));
  }
  // "all" = aggregated rows (model IS NULL) from the latest run that has them
  // First try the given runId
  const result = rowsToObjects<BrandRow>(db.exec(
    `SELECT * FROM brand_results WHERE run_id = ${runId} AND industry_id = '${industryId}' AND model IS NULL AND score > 0 ORDER BY score DESC`
  ));
  if (result.length > 0) return result;
  // Fallback: check other runs on the same date (the aggregated row may be on a different run)
  const runRow = rowToObject<{ run_date: string }>(db.exec(
    `SELECT run_date FROM pipeline_runs WHERE id = ${runId}`
  ));
  if (!runRow) return [];
  return rowsToObjects<BrandRow>(db.exec(
    `SELECT * FROM brand_results WHERE run_id IN (SELECT id FROM pipeline_runs WHERE run_date = '${runRow.run_date}') AND industry_id = '${industryId}' AND model IS NULL AND score > 0 ORDER BY score DESC`
  ));
}

/** Get all run IDs for the latest date that has data for a given industry */
export async function getLatestDateRunIds(industryId: string): Promise<{ runIds: number[]; runDate: string | null }> {
  const db = await getDb();
  // Find the latest date that has data for this industry
  const dateResult = rowToObject<{ run_date: string }>(db.exec(
    `SELECT pr.run_date FROM pipeline_runs pr JOIN brand_results br ON br.run_id = pr.id WHERE br.industry_id = '${industryId}' ORDER BY pr.run_date DESC, pr.id DESC LIMIT 1`
  ));
  if (!dateResult) return { runIds: [], runDate: null };

  // Get all run IDs for that date
  const runRows = rowsToObjects<{ id: number }>(db.exec(
    `SELECT DISTINCT pr.id FROM pipeline_runs pr JOIN brand_results br ON br.run_id = pr.id WHERE pr.run_date = '${dateResult.run_date}' AND br.industry_id = '${industryId}' ORDER BY pr.id`
  ));
  return { runIds: runRows.map(r => r.id), runDate: dateResult.run_date };
}

/** Get available models for an industry across all runs on the latest date */
export async function getAvailableModels(runId: number, industryId: string): Promise<string[]> {
  const db = await getDb();
  // Get all runs for the same date as this run
  const runRow = rowToObject<{ run_date: string }>(db.exec(
    `SELECT run_date FROM pipeline_runs WHERE id = ${runId}`
  ));
  if (!runRow) return [];

  const allRunIds = rowsToObjects<{ id: number }>(db.exec(
    `SELECT id FROM pipeline_runs WHERE run_date = '${runRow.run_date}'`
  ));
  const ids = allRunIds.map(r => r.id);
  if (ids.length === 0) return [];

  const rows = rowsToObjects<{ model: string }>(db.exec(
    `SELECT DISTINCT model FROM brand_results WHERE run_id IN (${ids.join(',')}) AND industry_id = '${industryId}' AND model IS NOT NULL ORDER BY model`
  ));
  return rows.map(r => r.model);
}

/** Get industry result for a run */
export async function getIndustryResult(runId: number, industryId: string): Promise<IndustryRow | undefined> {
  const db = await getDb();
  return rowToObject<IndustryRow>(db.exec(
    `SELECT * FROM industry_results WHERE run_id = ${runId} AND industry_id = '${industryId}'`
  ));
}

/** Get all industry results for a run */
export async function getAllIndustryResults(runId: number): Promise<IndustryRow[]> {
  const db = await getDb();
  return rowsToObjects<IndustryRow>(db.exec(
    `SELECT * FROM industry_results WHERE run_id = ${runId}`
  ));
}

/**
 * Build timeline data for an industry across all runs.
 * Returns { dates: string[], brands: { [brandName]: { date, score, rank }[] } }
 */
export async function getTimeline(industryId: string): Promise<{ dates: string[]; brands: Record<string, { date: string; score: number; rank: number }[]> }> {
  const db = await getDb();

  // Get all runs
  const runs = rowsToObjects<{ id: number; run_date: string }>(
    db.exec('SELECT id, run_date FROM pipeline_runs ORDER BY run_date ASC')
  );

  const dates: string[] = [];
  const brands: Record<string, { date: string; score: number; rank: number }[]> = {};

  for (const run of runs) {
    // Get aggregated (model IS NULL) scores for this industry, ranked
    const results = rowsToObjects<{ brand: string; score: number }>(db.exec(
      `SELECT brand, score FROM brand_results WHERE run_id = ${run.id} AND industry_id = '${industryId}' AND model IS NULL AND score > 0 ORDER BY score DESC`
    ));

    if (results.length === 0) continue;

    dates.push(run.run_date);

    results.forEach((r, idx) => {
      if (!brands[r.brand]) brands[r.brand] = [];
      brands[r.brand].push({ date: run.run_date, score: r.score, rank: idx + 1 });
    });
  }

  return { dates, brands };
}

/**
 * Get full history and latest breakdown for a specific brand across all runs.
 */
export async function getBrandHistory(brandName: string) {
  const db = await getDb();

  const runs = rowsToObjects<{ id: number; run_date: string }>(
    db.exec('SELECT id, run_date FROM pipeline_runs ORDER BY run_date ASC')
  );

  const history: { date: string; score: number; industry_id: string }[] = [];
  let latestBreakdown: BrandRow | undefined;
  const industryIds = new Set<string>();

  for (const run of runs) {
    // Replace single quotes to prevent SQL injection/errors
    const safeBrand = brandName.replace(/'/g, "''");
    const results = rowsToObjects<BrandRow>(db.exec(
      `SELECT * FROM brand_results WHERE run_id = ${run.id} AND brand COLLATE NOCASE = '${safeBrand}' AND model IS NULL AND score > 0 ORDER BY score DESC`
    ));

    for (const r of results) {
      history.push({ date: run.run_date, score: r.score, industry_id: r.industry_id });
      industryIds.add(r.industry_id);
      latestBreakdown = r; // Will end up being the most recent one
    }
  }

  return { history, latestBreakdown, industryIds: Array.from(industryIds) };
}

export interface InsightRow {
  id: number;
  industry_id: string;
  insight_date: string;
  insight_text: string;
  generated_by: string;
  previous_insight_id: number | null;
  created_at: string;
}

/**
 * Get the most recent insight for an industry.
 * Returns today's insight if available, otherwise the latest stored insight.
 */
export async function getLatestInsight(industryId: string): Promise<InsightRow | undefined> {
  const db = await getDb();
  const safeId = industryId.replace(/'/g, "''");

  // Try today first
  const today = new Date().toISOString().split('T')[0];
  const todayResult = rowToObject<InsightRow>(
    db.exec(`SELECT * FROM industry_insights WHERE industry_id = '${safeId}' AND insight_date = '${today}' LIMIT 1`)
  );
  if (todayResult) return todayResult;

  // Fallback: most recent any date
  return rowToObject<InsightRow>(
    db.exec(`SELECT * FROM industry_insights WHERE industry_id = '${safeId}' ORDER BY insight_date DESC LIMIT 1`)
  );
}
