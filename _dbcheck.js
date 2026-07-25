const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

async function main() {
  const wasmPath = path.join('.', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  const wasmBinary = fs.readFileSync(wasmPath);
  const SQL = await initSqlJs({ wasmBinary: wasmBinary.buffer });
  const buffer = fs.readFileSync('./data/brand-intelligence.db');
  const db = new SQL.Database(new Uint8Array(buffer));

  console.log('=== TABLES ===');
  console.log(JSON.stringify(db.exec("SELECT name FROM sqlite_master WHERE type='table'")));
  
  console.log('\n=== RUNS (latest 5) ===');
  console.log(JSON.stringify(db.exec('SELECT * FROM pipeline_runs ORDER BY id DESC LIMIT 5'), null, 2));
  
  console.log('\n=== ALL DISTINCT MODELS ===');
  console.log(JSON.stringify(db.exec('SELECT DISTINCT model FROM brand_results WHERE model IS NOT NULL ORDER BY model')));
  
  console.log('\n=== INDUSTRY AGGREGATED COUNT ===');
  console.log(JSON.stringify(db.exec('SELECT industry_id, COUNT(*) as cnt FROM brand_results WHERE model IS NULL AND score > 0 GROUP BY industry_id ORDER BY industry_id')));

  console.log('\n=== SAMPLE: tech brands with latest run ===');
  const latestRun = db.exec('SELECT MAX(id) FROM pipeline_runs');
  const maxId = latestRun[0].values[0][0];
  console.log('Latest run ID:', maxId);
  console.log(JSON.stringify(db.exec("SELECT brand, score, model FROM brand_results WHERE industry_id='technology' AND run_id=" + maxId + " ORDER BY score DESC LIMIT 20")));

  console.log('\n=== BRAND_RESULTS COLUMNS ===');
  console.log(JSON.stringify(db.exec("PRAGMA table_info(brand_results)")));

  console.log('\n=== TOTAL ROWS ===');
  console.log(JSON.stringify(db.exec('SELECT COUNT(*) FROM brand_results')));
  
  console.log('\n=== ROWS WITH model IS NULL ===');
  console.log(JSON.stringify(db.exec('SELECT COUNT(*) FROM brand_results WHERE model IS NULL')));

  console.log('\n=== ROWS WITH model IS NOT NULL ===');
  console.log(JSON.stringify(db.exec('SELECT COUNT(*) FROM brand_results WHERE model IS NOT NULL')));
  
  console.log('\n=== INSIGHTS COUNT ===');
  try {
    console.log(JSON.stringify(db.exec('SELECT COUNT(*) FROM industry_insights')));
  } catch(e) {
    console.log('No industry_insights table');
  }
}

main().catch(console.error);
