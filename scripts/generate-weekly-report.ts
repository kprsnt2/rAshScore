/**
 * Generates a weekly AI brand visibility report.
 * Uses the NVIDIA/Groq LLM to write a professional markdown blog post
 * based on the top 5 brands and top movers over the last 7 days.
 */

import { generateInsight } from '../src/lib/insights';
import initSqlJs from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';

// Helper for sql.js to convert rows
function rowsToObjects<T>(result: any[]): T[] {
  if (result.length === 0) return [];
  const cols = result[0].columns;
  return result[0].values.map((vals: any[]) => {
    const obj: any = {};
    cols.forEach((c: string, i: number) => obj[c] = vals[i]);
    return obj as T;
  });
}

async function main() {
  console.log('📰 AI Weekly Report Generator');
  console.log('==================================');

  const dbPath = path.join(process.cwd(), 'data', 'brand-intelligence.db');
  if (!fs.existsSync(dbPath)) {
    console.error(`❌ Database not found at ${dbPath}`);
    process.exit(1);
  }

  // Load sql.js
  const wasmPath = path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  const wasmBinary = fs.readFileSync(wasmPath);
  const SQL = await initSqlJs({ wasmBinary: wasmBinary.buffer as ArrayBuffer });
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(new Uint8Array(buffer) as unknown as number[]);

  // Ensure table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      content_md TEXT NOT NULL,
      published_at TEXT DEFAULT (datetime('now'))
    );
  `);

  const dateStr = new Date().toISOString().split('T')[0];
  const slug = `weekly-report-${dateStr}`;

  // Check if report already exists for today
  const existingResult = db.exec(`SELECT id FROM reports WHERE slug = '${slug}'`);
  if (existingResult.length > 0 && existingResult[0].values.length > 0) {
    console.log(`✅ Report for ${dateStr} already exists. Skipping.`);
    process.exit(0);
  }

  console.log('📊 Gathering data for the last 7 days...');

  // Get last 7 runs
  const runsResult = db.exec(`SELECT id, run_date FROM pipeline_runs ORDER BY id DESC LIMIT 7`);
  const runs = rowsToObjects<{ id: number; run_date: string }>(runsResult);
  
  if (runs.length === 0) {
    console.error('❌ No pipeline runs found in the database. Cannot generate report.');
    process.exit(1);
  }

  let latestRunId: number;
  let oldestRunId: number;

  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayStr = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Try to find a run from today or yesterday as the latest
  const recentRun = runs.find(r => r.run_date === todayStr || r.run_date === yesterdayStr);
  
  if (recentRun) {
    console.log(`✅ Using recent run from ${recentRun.run_date} (ID: ${recentRun.id}) as latest run.`);
    latestRunId = recentRun.id;
  } else {
    console.log(`⚠️ No runs found for today (${todayStr}) or yesterday (${yesterdayStr}). Using the latest available run from ${runs[0].run_date} (ID: ${runs[0].id}).`);
    latestRunId = runs[0].id;
  }

  // Set oldest run for comparison (at most 7 runs ago, or itself if only 1 run exists)
  if (runs.length === 1) {
    console.log('⚠️ Only 1 pipeline run found in the database. Comparison data will be empty.');
    oldestRunId = latestRunId;
  } else {
    // Find the oldest run that is not the latest run we selected
    const comparisonRuns = runs.filter(r => r.id !== latestRunId);
    oldestRunId = comparisonRuns[comparisonRuns.length - 1].id;
    console.log(`📊 Comparing latest run (ID: ${latestRunId}) with oldest available run (ID: ${oldestRunId}) from ${runs.find(r => r.id === oldestRunId)?.run_date}.`);
  }

  // 1. Top 5 Brands Overall (Latest run)
  const topBrandsResult = db.exec(`
    SELECT brand, industry_id, score 
    FROM brand_results 
    WHERE run_id = ${latestRunId} AND model IS NULL AND score > 0 
    ORDER BY score DESC LIMIT 5
  `);
  const topBrands = rowsToObjects<{ brand: string; industry_id: string; score: number }>(topBrandsResult);

  // 2. Top Movers (Latest vs Oldest)
  const moversResult = db.exec(`
    SELECT 
      l.brand, l.industry_id, 
      l.score as current_score, 
      o.score as old_score,
      (l.score - o.score) as score_change
    FROM brand_results l
    INNER JOIN brand_results o ON l.brand = o.brand AND l.industry_id = o.industry_id
    WHERE l.run_id = ${latestRunId} AND o.run_id = ${oldestRunId} AND l.model IS NULL AND o.model IS NULL AND l.score > 0 AND o.score > 0
    ORDER BY score_change DESC
  `);
  const movers = rowsToObjects<{ brand: string; industry_id: string; current_score: number; old_score: number; score_change: number }>(moversResult);

  const topImprovers = movers.filter(m => m.score_change > 0).slice(0, 5);
  const topDecliners = movers.filter(m => m.score_change < 0).sort((a, b) => a.score_change - b.score_change).slice(0, 5);

  const topImproversStr = topImprovers.length > 0 
    ? topImprovers.map((b, i) => `${i + 1}. ${b.brand} (${b.industry_id}) - Score: ${b.current_score} (Up +${b.score_change})`).join('\n')
    : "No improvement data available (either only 1 run exists, or no scores improved).";

  const topDeclinersStr = topDecliners.length > 0 
    ? topDecliners.map((b, i) => `${i + 1}. ${b.brand} (${b.industry_id}) - Score: ${b.current_score} (Down ${b.score_change})`).join('\n')
    : "No decline data available (either only 1 run exists, or no scores declined).";

  // 3. Construct Prompt
  const prompt = `You are a Lead AI Data Analyst for "rAsh Score", a platform that measures how visible and positively perceived Indian brands are by Large Language Models (LLMs).
 
Write a professional and analytical weekly report (formatted as a Markdown blog post) summarizing the state of AI brand visibility for the week of ${dateStr}.
The report should be around 400-500 words. Use Markdown headings, bold text for brand names, and bullet points where appropriate. DO NOT use emojis excessively, keep it highly professional.
Do not output any introductory or conversational text, just the raw Markdown content starting with the title as an H1 heading (#).
 
Data for this week:
 
TOP 5 BRANDS OVERALL:
${topBrands.map((b, i) => `${i + 1}. ${b.brand} (${b.industry_id}) - Score: ${b.score}/100`).join('\n')}
 
TOP 5 IMPROVERS THIS WEEK:
${topImproversStr}
 
TOP 5 DECLINERS THIS WEEK:
${topDeclinersStr}
 
Guidelines:
1. Start with an H1 heading (#) that is a catchy but professional title for the report.
2. Write a brief executive summary.
3. Analyze the top 5 brands and what their dominance means.
4. Discuss the improvers and decliners (if data is available), theorizing briefly why their AI visibility might be fluctuating (e.g., recent news, product launches, or algorithmic shifts). If comparison data is missing, note that we are establishing the baseline.
5. Conclude with a brief forward-looking statement on the importance of LLMO (Large Language Model Optimization).`;

  console.log('✍️  Generating report via AI...');
  try {
    const { text, generatedBy } = await generateInsight(prompt);
    
    // Extract title from first line
    const lines = text.trim().split('\n');
    let title = 'Weekly AI Brand Visibility Report';
    let bodyText = text.trim();
    if (lines[0].startsWith('# ')) {
      title = lines[0].replace('# ', '').trim();
      bodyText = lines.slice(1).join('\n').trim();
    }

    const safeTitle = title.replace(/'/g, "''");
    const safeText = bodyText.replace(/'/g, "''");

    db.exec(`
      INSERT INTO reports (slug, title, content_md)
      VALUES ('${slug}', '${safeTitle}', '${safeText}')
    `);

    // Save DB to disk
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));

    console.log(`✅ Successfully generated and saved report: ${slug}`);
    console.log(`🤖 Generated by: ${generatedBy}`);
    
  } catch (error) {
    console.error('❌ Failed to generate report:', error);
    process.exit(1);
  }
}

main().catch(console.error);
