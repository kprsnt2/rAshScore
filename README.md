# rAsh Score v2.0

**AI Brand Intelligence for India** — Measure how AI models see 285 brands across 19 industries.

Live at [rashscore.live](https://rashscore.live)

## Architecture

```
pipelines/          Python data pipelines (BigQuery)
  ├── config.py           GCP config, model definitions
  ├── industry_data.py    19 industries × 15 brands
  ├── prompts.py          Batch prompt generation + parsing
  ├── scoring.py          Score validation & fuzzy matching
  ├── bq_writer.py        BigQuery streaming inserts
  ├── run_pipeline.py     Main pipeline runner (--provider=gemini|openai|claude|grok|all)
  ├── run_insights.py     AI insight generation per industry
  ├── setup_schema.py     One-time BigQuery schema creation
  └── migrate_sqlite_to_bq.py  One-time SQLite migration

web/                Next.js dashboard (Cloud Run)
  ├── src/lib/bq.ts       BigQuery client (replaces db.ts)
  ├── src/app/api/        REST API routes
  ├── src/app/dashboard/  Industry rankings dashboard
  └── Dockerfile          Cloud Run container

dataform/           BigQuery SQL transformations
  └── definitions/daily_rankings.sqlx

.github/workflows/  CI/CD → Cloud Run
```

## Quick Start

### Pipeline

```bash
cd pipelines
pip install -r requirements.txt

# One-time: create BigQuery tables
python setup_schema.py

# Run scoring pipeline
python run_pipeline.py --provider=gemini

# Generate AI insights
python run_insights.py
```

### Dashboard

```bash
cd web
npm install
npm run dev
```

### Deploy

Push to `main` → GitHub Actions deploys to Cloud Run automatically.

## Models Queried

| Provider | Primary | Backup |
|----------|---------|--------|
| OpenAI | gpt-5.4-mini | gpt-5.4-nano |
| Gemini | gemini-2.5-flash | gemini-2.5-flash-lite |
| Claude | claude-sonnet-5 | claude-sonnet-4 |
| Grok | grok-4.20-non-reasoning | grok-4.3 |

## Author

**Prashanth Kumar Kadasi** — [kprsnt.in](https://kprsnt.in)
