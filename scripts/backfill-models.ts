/**
 * One-time migration: backfill per-model scores from JSON history files
 * into the SQLite database.
 *
 * Run with: npx tsx scripts/backfill-models.ts
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

function main() {
  const dbPath = path.join(process.cwd(), 'data', 'brand-intelligence.db');
  const historyDir = path.join(process.cwd(), 'public', 'data', 'history');

  if (!fs.existsSync(dbPath)) {
    console.error('❌ Database not found:', dbPath);
    process.exit(1);
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  // Add model column if it doesn't exist
  try {
    db.exec('ALTER TABLE brand_results ADD COLUMN model TEXT');
    console.log('✅ Added model column');
  } catch {
    console.log('ℹ️  model column already exists');
  }

  // Create index for model column
  try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_brand_results_model ON brand_results(model)');
  } catch { /* ignore */ }

  // Get all pipeline runs
  const runs = db.prepare('SELECT id, run_date FROM pipeline_runs ORDER BY run_date').all() as { id: number; run_date: string }[];
  console.log(`Found ${runs.length} pipeline runs in DB`);

  const insertBrand = db.prepare(`
    INSERT INTO brand_results (run_id, industry_id, brand, category, score, recommendation, sentiment, prominence, accuracy, response_time_ms, error, model)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let totalInserted = 0;

  const backfillAll = db.transaction(() => {
    for (const run of runs) {
      // Check if this run already has per-model data
      const existingModels = db.prepare(
        'SELECT COUNT(*) as c FROM brand_results WHERE run_id = ? AND model IS NOT NULL'
      ).get(run.id) as { c: number };

      if (existingModels.c > 0) {
        console.log(`  ⏭  Run ${run.run_date} (id=${run.id}): already has ${existingModels.c} per-model rows, skipping`);
        continue;
      }

      // Try to find matching JSON history file
      const jsonFile = path.join(historyDir, `${run.run_date}.json`);
      if (!fs.existsSync(jsonFile)) {
        console.log(`  ⚠️  Run ${run.run_date} (id=${run.id}): no history JSON file found`);
        continue;
      }

      const data = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
      if (!data.results) {
        console.log(`  ⚠️  Run ${run.run_date}: invalid JSON structure`);
        continue;
      }

      let runInserted = 0;

      for (const ir of data.results) {
        if (!ir.modelData || !ir.industry?.id) continue;

        for (const md of ir.modelData) {
          if (!md.brandScores || !md.model) continue;

          for (const bs of md.brandScores) {
            const totalScore = Math.min(100,
              (bs.breakdown?.recommendation || 0) + (bs.breakdown?.sentiment || 0) +
              (bs.breakdown?.prominence || 0) + (bs.breakdown?.accuracy || 0)
            );

            insertBrand.run(
              run.id,
              ir.industry.id,
              bs.brand,
              ir.industry.category || ir.industry.id,
              totalScore,
              bs.breakdown?.recommendation || 0,
              bs.breakdown?.sentiment || 0,
              bs.breakdown?.prominence || 0,
              bs.breakdown?.accuracy || 0,
              0,    // response_time_ms
              null, // error
              md.model
            );
            runInserted++;
          }
        }
      }

      totalInserted += runInserted;
      console.log(`  ✅ Run ${run.run_date} (id=${run.id}): backfilled ${runInserted} per-model rows`);
    }
  });

  backfillAll();
  db.close();

  console.log(`\n✅ Migration complete: ${totalInserted} per-model rows inserted`);
}

main();
