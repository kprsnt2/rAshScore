/**
 * Standalone AI Insights Pipeline
 * Runs separately after the main brand analysis pipeline completes.
 *
 * Reads brand data from the existing SQLite DB (committed by the main pipeline),
 * generates one AI insight per industry using NVIDIA (primary) with Groq fallback,
 * and saves them back to the DB.
 */

import { buildInsightPrompt, generateInsight, type IndustryDataSnapshot } from '../src/lib/insights';
import { getAllIndustries } from '../src/lib/industry-data';
import { hasApiKeys } from '../src/lib/env';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('🤖 AI Industry Insights Pipeline');
  console.log('==================================');

  // Check API keys
  const keys = hasApiKeys();
  if (!keys.nvidia && !keys.groq && !keys.vertexGemini) {
    console.error('❌ No NVIDIA, Groq, or Vertex Gemini configured. Exiting.');
    process.exit(1);
  }
  const providers = [
    keys.vertexGemini ? 'Vertex Gemini' : '',
    keys.nvidia ? 'NVIDIA' : '',
    keys.groq ? 'Groq' : ''
  ].filter(Boolean).join(' + ');
  console.log(`✅ AI providers: ${providers} (with fallback chains)`);

  const dbPath = path.join(process.cwd(), 'data', 'brand-intelligence.db');
  if (!fs.existsSync(dbPath)) {
    console.error(`❌ Database not found at ${dbPath}. Run the brand pipeline first.`);
    process.exit(1);
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  // Ensure the insights table exists (safe to run even if already present)
  db.exec(`
    CREATE TABLE IF NOT EXISTS industry_insights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      industry_id TEXT NOT NULL,
      insight_date TEXT NOT NULL,
      insight_text TEXT NOT NULL,
      generated_by TEXT NOT NULL,
      previous_insight_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(industry_id, insight_date)
    );
    CREATE INDEX IF NOT EXISTS idx_insights_industry ON industry_insights(industry_id);
    CREATE INDEX IF NOT EXISTS idx_insights_date ON industry_insights(insight_date);
  `);

  const dateStr = new Date().toISOString().split('T')[0];
  const industries = getAllIndustries();

  console.log(`\n📅 Generating insights for ${dateStr}...\n`);

  const insertInsight = db.prepare(`
    INSERT OR IGNORE INTO industry_insights
      (industry_id, insight_date, insight_text, generated_by, previous_insight_id)
    VALUES (?, ?, ?, ?, ?)
  `);

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const industry of industries) {
    // Skip if today's insight already exists
    const existing = db.prepare(
      `SELECT id FROM industry_insights WHERE industry_id = ? AND insight_date = ?`
    ).get(industry.id, dateStr) as { id: number } | undefined;

    if (existing) {
      console.log(`  ⏭  ${industry.name}: already done today`);
      skipped++;
      continue;
    }

    // Get latest run data for this industry
    const latestRunRow = db.prepare(`
      SELECT pr.id as run_id, pr.run_date
      FROM brand_results br
      INNER JOIN pipeline_runs pr ON br.run_id = pr.id
      WHERE br.industry_id = ? AND br.model IS NULL AND br.score > 0
      ORDER BY pr.run_date DESC
      LIMIT 1
    `).get(industry.id) as { run_id: number; run_date: string } | undefined;

    if (!latestRunRow) {
      console.log(`  ⚠️  ${industry.name}: no brand data in DB, skipping`);
      skipped++;
      continue;
    }

    // Today's brand snapshot
    const todayBrands = db.prepare(`
      SELECT brand, score
      FROM brand_results
      WHERE run_id = ? AND industry_id = ? AND model IS NULL AND score > 0
      ORDER BY score DESC
      LIMIT 15
    `).all(latestRunRow.run_id, industry.id) as { brand: string; score: number }[];

    // Previous run data (for score/rank change calculations)
    const prevRunRow = db.prepare(`
      SELECT pr.id as run_id, pr.run_date
      FROM brand_results br
      INNER JOIN pipeline_runs pr ON br.run_id = pr.id
      WHERE br.industry_id = ? AND br.model IS NULL AND pr.run_date < ?
      ORDER BY pr.run_date DESC
      LIMIT 1
    `).get(industry.id, latestRunRow.run_date) as { run_id: number; run_date: string } | undefined;

    const prevBrands = prevRunRow
      ? (db.prepare(`
          SELECT brand, score
          FROM brand_results
          WHERE run_id = ? AND industry_id = ? AND model IS NULL AND score > 0
          ORDER BY score DESC
          LIMIT 15
        `).all(prevRunRow.run_id, industry.id) as { brand: string; score: number }[])
      : [];

    // Build prev map for score/rank delta
    const prevMap: Record<string, { score: number; rank: number }> = {};
    prevBrands.forEach((b, i) => { prevMap[b.brand] = { score: b.score, rank: i + 1 }; });

    // Industry averages
    const industryAvgRow = db.prepare(`
      SELECT avg_score FROM industry_results
      WHERE run_id = ? AND industry_id = ?
    `).get(latestRunRow.run_id, industry.id) as { avg_score: number } | undefined;

    const todaySnapshot: IndustryDataSnapshot = {
      industryId: industry.id,
      industryName: industry.name,
      runDate: latestRunRow.run_date,
      avgScore: industryAvgRow?.avg_score || 0,
      brands: todayBrands.map((b, i) => {
        const prev = prevMap[b.brand];
        return {
          brand: b.brand,
          score: b.score,
          rank: i + 1,
          scoreChange: prev ? b.score - prev.score : null,
          rankChange: prev ? prev.rank - (i + 1) : null,
        };
      }),
    };

    // Previous snapshot (for first-time prompt)
    let prevSnapshot: IndustryDataSnapshot | null = null;
    if (prevRunRow && prevBrands.length > 0) {
      const prevAvgRow = db.prepare(`
        SELECT avg_score FROM industry_results
        WHERE run_id = ? AND industry_id = ?
      `).get(prevRunRow.run_id, industry.id) as { avg_score: number } | undefined;

      prevSnapshot = {
        industryId: industry.id,
        industryName: industry.name,
        runDate: prevRunRow.run_date,
        avgScore: prevAvgRow?.avg_score || 0,
        brands: prevBrands.map((b, i) => ({
          brand: b.brand, score: b.score, rank: i + 1,
          scoreChange: null, rankChange: null,
        })),
      };
    }

    // Previous insight for chaining
    const prevInsightRow = db.prepare(`
      SELECT id, insight_text, insight_date
      FROM industry_insights
      WHERE industry_id = ?
      ORDER BY insight_date DESC
      LIMIT 1
    `).get(industry.id) as { id: number; insight_text: string; insight_date: string } | undefined;

    const prevInsight = prevInsightRow
      ? { text: prevInsightRow.insight_text, date: prevInsightRow.insight_date }
      : null;

    // Build prompt and generate
    try {
      const prompt = buildInsightPrompt(industry.name, todaySnapshot, prevSnapshot, prevInsight);

      console.log(`  🧠 ${industry.name}...`);
      const { text, generatedBy } = await generateInsight(prompt);

      insertInsight.run(
        industry.id, dateStr, text, generatedBy, prevInsightRow?.id || null
      );

      console.log(`  ✅ ${industry.name}: saved (${generatedBy})`);
      generated++;

      // 30s between industries to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 30_000));
    } catch (err) {
      console.error(`  ❌ ${industry.name}: failed — ${(err as Error).message}`);
      failed++;
    }
  }

  // Checkpoint WAL so the committed .db file is self-contained
  db.pragma('wal_checkpoint(TRUNCATE)');
  db.pragma('journal_mode = DELETE');
  db.close();

  console.log('\n📊 Insights Summary');
  console.log('====================');
  console.log(`Generated: ${generated}`);
  console.log(`Skipped:   ${skipped}`);
  console.log(`Failed:    ${failed}`);
  console.log('\n✅ Insights pipeline complete!');

  if (failed > 0) process.exit(1); // Signal partial failure to GitHub Actions
}

main().catch(err => {
  console.error('❌ Insights pipeline failed:', err);
  process.exit(1);
});
