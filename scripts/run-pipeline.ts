/**
 * Standalone pipeline runner for GitHub Actions
 * Analyzes top 15 brands across 15 Indian industries
 * Saves results to SQLite database (single source of truth)
 */

import { BrandAnalysisPipeline } from '../src/lib/pipeline';
import { getAllIndustries } from '../src/lib/industry-data';
import { hasApiKeys } from '../src/lib/env';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

function initDatabase(dbPath: string) {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS pipeline_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_date TEXT NOT NULL,
      total_industries INTEGER,
      total_brands INTEGER,
      successful_brands INTEGER,
      average_score REAL,
      highest_score INTEGER,
      lowest_score INTEGER,
      total_time_ms INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS industry_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL,
      industry_id TEXT NOT NULL,
      industry_name TEXT NOT NULL,
      avg_score REAL,
      avg_recommendation REAL,
      avg_sentiment REAL,
      avg_prominence REAL,
      avg_accuracy REAL,
      total_brands INTEGER,
      successful_brands INTEGER,
      response_time_ms INTEGER,
      error TEXT,
      FOREIGN KEY (run_id) REFERENCES pipeline_runs(id)
    );

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      content_md TEXT NOT NULL,
      published_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS brand_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL,
      industry_id TEXT NOT NULL,
      brand TEXT NOT NULL,
      category TEXT,
      score INTEGER,
      recommendation INTEGER,
      sentiment INTEGER,
      prominence INTEGER,
      accuracy INTEGER,
      response_time_ms INTEGER,
      error TEXT,
      model TEXT,
      FOREIGN KEY (run_id) REFERENCES pipeline_runs(id)
    );

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

    CREATE INDEX IF NOT EXISTS idx_brand_results_run ON brand_results(run_id);
    CREATE INDEX IF NOT EXISTS idx_brand_results_industry ON brand_results(industry_id);
    CREATE INDEX IF NOT EXISTS idx_brand_results_model ON brand_results(model);
    CREATE INDEX IF NOT EXISTS idx_industry_results_run ON industry_results(run_id);
  `);

  // Add model column if it doesn't exist (migration for existing DBs)
  try {
    db.exec(`ALTER TABLE brand_results ADD COLUMN model TEXT`);
    console.log('✅ Added model column to brand_results');
  } catch {
    // Column already exists — this is expected
  }

  return db;
}


async function main() {
  console.log('🇮🇳 India rAsh Intelligence Pipeline');
  console.log('=====================================');

  // === Parse CLI arguments ===
  const args = process.argv.slice(2);
  const providerArg = args.find(a => a.startsWith('--provider='))?.split('=')[1] as 'openai' | 'gemini' | 'groq' | 'nvidia' | 'vertex-gemini' | 'vertex-claude' | 'vertex-grok' | undefined;
  const modelsArg = args.find(a => a.startsWith('--models='))?.split('=')[1];
  const apiKeyArg = args.find(a => a.startsWith('--api-key-env='))?.split('=')[1];

  // === Pre-flight: check that at least one API key is configured ===
  const keys = hasApiKeys();
  const activeProviders = Object.entries(keys).filter(([, v]) => v).map(([k]) => k);

  if (activeProviders.length === 0) {
    console.error('\n❌ No API keys configured!');
    console.error('Please add at least one of these GitHub Secrets:');
    console.error('  • NVIDIA_API_KEY');
    console.error('  • GROQ_API_KEY');
    console.error('  • OPENAI_API_KEY');
    console.error('  • GEMINI_API_KEY');
    console.error('\nSkipping pipeline run to preserve existing data.');
    process.exit(0); // Exit cleanly so the workflow doesn't fail
  }

  console.log(`✅ Active providers: ${activeProviders.join(', ')}`);

  const industries = getAllIndustries();
  const totalBrandCount = industries.reduce((s, i) => s + i.topBrands.length, 0);
  console.log(`📊 ${industries.length} industries, ${totalBrandCount} brands total`);

  // === Build pipeline config ===
  let modelPair: { provider: 'openai' | 'gemini' | 'groq' | 'nvidia' | 'vertex-gemini' | 'vertex-claude' | 'vertex-grok'; primary: string; backup: string; apiKeyOverride?: string } | undefined;
  let delayBetweenIndustries = 10000; // default 10s

  if (providerArg && modelsArg) {
    const [primary, backup] = modelsArg.split(',');
    const apiKeyOverride = apiKeyArg ? process.env[apiKeyArg] : undefined;
    modelPair = { provider: providerArg, primary, backup, apiKeyOverride };
    delayBetweenIndustries = 12000; // 12s (5 RPM compliance)
    console.log(`🎯 Single model-pair mode: ${providerArg} → ${primary} (backup: ${backup})`);
    if (apiKeyOverride) {
      console.log(`🔑 Using API key from env: ${apiKeyArg}`);
    }
  }

  const pipeline = new BrandAnalysisPipeline({
    delayBetweenIndustries,
    timeoutMs: 180000,              // 3 min per-model timeout
    retryDelaysMs: [60000, 120000],  // 60s, 120s retry gaps for rate limits
    modelPair,
  });

  console.log('\n🚀 Starting analysis...\n');
  const startTime = Date.now();
  const results = await pipeline.analyzeAllIndustries();
  const totalTime = Date.now() - startTime;

  // Calculate summary
  const allBrands = results.flatMap(r => r.brandResults);
  const successfulBrands = allBrands.filter(b => !b.error);
  const failedIndustries = results.filter(r => r.error);

  const summary = {
    totalIndustries: results.length,
    successfulIndustries: results.length - failedIndustries.length,
    totalBrands: allBrands.length,
    successfulBrands: successfulBrands.length,
    failedBrands: allBrands.length - successfulBrands.length,
    averageScore: successfulBrands.length > 0
      ? Math.round(successfulBrands.reduce((sum, b) => sum + b.score, 0) / successfulBrands.length) : 0,
    highestScore: successfulBrands.length > 0 ? Math.max(...successfulBrands.map(b => b.score)) : 0,
    lowestScore: successfulBrands.length > 0 ? Math.min(...successfulBrands.map(b => b.score)) : 0,
    totalTimeMs: totalTime,
  };

  // === Guard: don't overwrite good data with empty results ===
  if (successfulBrands.length === 0) {
    console.error('\n⚠️ All brands failed analysis. Keeping existing data.');
    console.error('Check your API keys and rate limits.');
    process.exit(0);
  }

  const dateStr = new Date().toISOString().split('T')[0];

  // === Save to SQLite (single source of truth) ===
  const dbDir = path.join(process.cwd(), 'data');
  fs.mkdirSync(dbDir, { recursive: true });
  const dbPath = path.join(dbDir, 'brand-intelligence.db');
  const db = initDatabase(dbPath);

  const insertRun = db.prepare(`
    INSERT INTO pipeline_runs (run_date, total_industries, total_brands, successful_brands, average_score, highest_score, lowest_score, total_time_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertIndustry = db.prepare(`
    INSERT INTO industry_results (run_id, industry_id, industry_name, avg_score, avg_recommendation, avg_sentiment, avg_prominence, avg_accuracy, total_brands, successful_brands, response_time_ms, error)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertBrand = db.prepare(`
    INSERT INTO brand_results (run_id, industry_id, brand, category, score, recommendation, sentiment, prominence, accuracy, response_time_ms, error, model)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const runResult = insertRun.run(
    dateStr, summary.totalIndustries, summary.totalBrands, summary.successfulBrands,
    summary.averageScore, summary.highestScore, summary.lowestScore, summary.totalTimeMs
  );
  const runId = runResult.lastInsertRowid;

  const saveAll = db.transaction(() => {
    for (const result of results) {
      const validBrands = result.brandResults.filter(b => !b.error);
      insertIndustry.run(
        runId, result.industry.id, result.industry.name,
        result.industryAverage.score, result.industryAverage.recommendation,
        result.industryAverage.sentiment, result.industryAverage.prominence,
        result.industryAverage.accuracy,
        result.brandResults.length, validBrands.length,
        result.totalResponseTime, result.error || null
      );

      // Insert aggregated scores (model = NULL) — these are the "All Models" average
      for (const brand of result.brandResults) {
        insertBrand.run(
          runId, result.industry.id, brand.brand, brand.category,
          brand.score, brand.breakdown.recommendation, brand.breakdown.sentiment,
          brand.breakdown.prominence, brand.breakdown.accuracy,
          brand.responseTime, brand.error || null, null  // model = NULL for aggregated
        );
      }

      // Insert per-model scores
      if (result.modelData) {
        for (const md of result.modelData) {
          for (const bs of md.brandScores) {
            const totalScore = Math.min(100,
              bs.breakdown.recommendation + bs.breakdown.sentiment +
              bs.breakdown.prominence + bs.breakdown.accuracy
            );
            insertBrand.run(
              runId, result.industry.id, bs.brand, result.industry.category,
              totalScore, bs.breakdown.recommendation, bs.breakdown.sentiment,
              bs.breakdown.prominence, bs.breakdown.accuracy,
              0, null, md.model  // model = model name for per-model rows
            );
          }
        }
      }
    }
  });

  saveAll();

  // Checkpoint WAL into main DB and switch to DELETE mode
  // so the .db file is fully self-contained (no .db-wal/.db-shm needed)
  db.pragma('wal_checkpoint(TRUNCATE)');
  db.pragma('journal_mode = DELETE');

  db.close();
  console.log(`\n💾 SQLite database saved to ${dbPath}`);

  // Print summary
  console.log('\n📊 Pipeline Summary');
  console.log('===================');
  console.log(`Industries: ${summary.successfulIndustries}/${summary.totalIndustries}`);
  console.log(`Brands: ${summary.successfulBrands}/${summary.totalBrands}`);
  console.log(`Average Score: ${summary.averageScore}/100`);
  console.log(`Range: ${summary.lowestScore} - ${summary.highestScore}`);
  console.log(`Time: ${Math.round(totalTime / 1000)}s`);

  if (failedIndustries.length > 0) {
    console.log(`\n⚠️ Failed: ${failedIndustries.map(r => r.industry.name).join(', ')}`);
  }

  const topBrands = successfulBrands.sort((a, b) => b.score - a.score).slice(0, 10);
  console.log('\n🏆 Top 10 Brands:');
  topBrands.forEach((b, i) => console.log(`  ${i + 1}. ${b.brand} (${b.category}) — ${b.score}`));

  console.log('\n✅ Pipeline complete!');
}

main().catch(err => { console.error('❌ Pipeline failed:', err); process.exit(1); });
