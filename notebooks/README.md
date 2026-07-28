# rAsh Score — BigQuery Notebooks Setup Guide

> Run everything directly in BigQuery Studio. No local setup. No CLI. Fully cloud-automated.

---

## Prerequisites

1. **Google Cloud Account** with billing enabled
2. **GCP Project** named `rashscore` (or any name — update in notebooks)
3. **Gemini API Key** from [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (free)

---

## Step 1: Enable APIs (Console)

Go to [console.cloud.google.com](https://console.cloud.google.com) → Select your project → Search and enable:

- ✅ **BigQuery API** (should be enabled by default)
- ✅ **BigQuery Connection API**
- ✅ **Notebooks API** (for Colab Enterprise)
- ✅ **Vertex AI API** (required for notebook scheduling)

Or use Cloud Shell (the `>_` icon in top-right of console):
```bash
gcloud services enable bigquery.googleapis.com notebooks.googleapis.com aiplatform.googleapis.com
```

---

## Step 2: Create BigQuery Tables (One-Time)

1. Go to **BigQuery Studio** → [console.cloud.google.com/bigquery](https://console.cloud.google.com/bigquery)
2. Click **+ CREATE** → **Python notebook**
3. Copy-paste the contents of `notebooks/01_setup_schema.py` into cells
4. Click **▶ Run All**
5. Verify tables appear under `rashscore > brand_intelligence`

**Tables created:**
```
rashscore.brand_intelligence
├── pipeline_runs          (partitioned by run_date)
├── brand_scores           (partitioned by run_date, clustered)
├── industry_insights      (partitioned by insight_date)
├── reports
├── pipeline_traces
├── eval_results           (partitioned by eval_date)
└── brand_scores_aggregated (materialized view)
```

---

## Step 3: Store API Key in Secret Manager (Recommended)

For scheduled notebooks, hardcoding the API key is risky. Use Secret Manager instead:

1. Go to **Secret Manager** → [console.cloud.google.com/security/secret-manager](https://console.cloud.google.com/security/secret-manager)
2. Click **+ CREATE SECRET**
3. Name: `gemini-api-key`
4. Secret value: paste your Gemini API key
5. Click **CREATE**

Then grant your notebook's service account access:
```bash
# In Cloud Shell:
gcloud secrets add-iam-policy-binding gemini-api-key \
  --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

In the notebook, uncomment the Secret Manager lines in Cell 1 to load the key automatically.

---

## Step 4: Run Scoring Pipeline (First Time)

1. Go to **BigQuery Studio** → **+ CREATE** → **Python notebook**
2. Name it: `rAsh Score — Daily Pipeline`
3. Copy-paste the contents of `notebooks/02_scoring_pipeline.py`
4. **Edit Cell 1**: Set your `GEMINI_API_KEY` (or uncomment Secret Manager code)
5. Click **▶ Run All**
6. Wait ~5-8 minutes for all 18 industries
7. Check Cell 8 output — should show a table of scored brands

---

## Step 5: Schedule Notebooks (Daily Automation)

### Schedule the Scoring Pipeline

1. Open your `rAsh Score — Daily Pipeline` notebook in BigQuery Studio
2. Click the **⏰ Schedule** button (top toolbar)
3. Configure:
   - **Name**: `rashscore-daily-pipeline`
   - **Frequency**: `Daily`
   - **Time**: `00:30 UTC` (6:00 AM IST)
   - **Region**: `us-central1`
   - **Service account**: Use default compute service account
4. Click **SAVE**

### Schedule Insight Generation

1. Create a new notebook: `rAsh Score — Daily Insights`
2. Paste contents of `notebooks/03_generate_insights.py`
3. Schedule:
   - **Name**: `rashscore-daily-insights`
   - **Time**: `01:30 UTC` (7:00 AM IST — 1 hour after pipeline)

### Schedule Evals

1. Create a new notebook: `rAsh Score — Daily Evals`
2. Paste contents of `notebooks/04_run_evals.py`
3. Schedule:
   - **Name**: `rashscore-daily-evals`
   - **Time**: `02:30 UTC` (8:00 AM IST — 2 hours after pipeline)

---

## Daily Schedule Summary

| Time (IST) | UTC   | Notebook | What it does |
|------------|-------|----------|-------------|
| 6:00 AM    | 00:30 | `02_scoring_pipeline` | Scores 270 brands across 18 industries |
| 7:00 AM    | 01:30 | `03_generate_insights` | Generates AI narrative per industry |
| 8:00 AM    | 02:00 | `04_run_evals` | Cross-model agreement + drift detection |

---

## Step 6: Deploy Dashboard (Cloud Run)

After your pipeline has data in BigQuery, deploy the web dashboard:

### Option A: Cloud Shell (easiest)

Open Cloud Shell from [console.cloud.google.com](https://console.cloud.google.com) → `>_` icon:

```bash
# Clone your repo
git clone https://github.com/kprsnt2/rAshScore.git
cd rAshScore

# Deploy to Cloud Run
gcloud run deploy rashscore-web \
  --source=web/ \
  --region=us-central1 \
  --allow-unauthenticated \
  --port=8080 \
  --memory=512Mi \
  --min-instances=0 \
  --max-instances=3 \
  --set-env-vars="GCP_PROJECT_ID=rashscore,GEMINI_API_KEY=YOUR_KEY"
```

### Option B: GitHub Actions (auto-deploy on push)

Already configured in `.github/workflows/deploy-cloudrun.yml`.
See `SETUP.md` for Workload Identity Federation setup.

---

## Monitoring

### Check Pipeline Runs
```sql
SELECT run_date, provider, model, successful_brands, average_score, status
FROM `rashscore.brand_intelligence.pipeline_runs`
ORDER BY run_date DESC
LIMIT 10;
```

### Check Score Trends
```sql
SELECT run_date, industry_id, 
       ROUND(AVG(score), 1) as avg_score, 
       COUNT(*) as brands
FROM `rashscore.brand_intelligence.brand_scores_aggregated`
GROUP BY run_date, industry_id
ORDER BY run_date DESC, avg_score DESC
LIMIT 50;
```

### Check Eval Results
```sql
SELECT eval_date, eval_type, summary_json
FROM `rashscore.brand_intelligence.eval_results`
ORDER BY eval_date DESC
LIMIT 10;
```

---

## Cost Estimate

| Service | Monthly Cost |
|---------|-------------|
| BigQuery storage (scores data) | $0 (under 10GB free tier) |
| BigQuery queries | $0 (under 1TB free tier) |
| Colab Enterprise notebooks | $0 (free tier available) |
| Gemini API (18 calls/day) | $0 (free tier = 15 RPM) |
| Cloud Run (dashboard) | $0 (under 2M requests free) |
| **Total** | **$0/month** |

> All within GCP free tier limits for a personal project.

---

## Notebooks

| File | Purpose | Schedule |
|------|---------|----------|
| `01_setup_schema.py` | Create BQ tables (run once) | Manual |
| `02_scoring_pipeline.py` | Score 270 brands with Gemini | Daily 6:00 AM IST |
| `03_generate_insights.py` | Generate industry narratives | Daily 7:00 AM IST |
| `04_run_evals.py` | Cross-model & drift evals | Daily 8:00 AM IST |
