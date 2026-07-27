# rAsh Score — Complete Setup & Deployment Guide

This guide takes you from **zero to live** — BigQuery, API keys, Cloud Run, and pipeline execution.

---

## Prerequisites

Before starting, make sure you have:

- ✅ [Google Cloud account](https://console.cloud.google.com/) (free tier works)
- ✅ [gcloud CLI](https://cloud.google.com/sdk/docs/install) installed
- ✅ Python ≥ 3.10
- ✅ Node.js ≥ 20
- ✅ [Gemini API key](https://aistudio.google.com/apikey) (free)
- ✅ [Tavily API key](https://tavily.com) (free, optional — for agentic-live mode)

> [!TIP]
> **Estimated cost:** $0/month on free tiers.
> BigQuery free tier = 1TB queries/month + 10GB storage.
> Cloud Run free tier = 2M requests/month.
> Gemini API free tier = 15 RPM.
> Tavily free tier = 1000 searches/month.

---

## Phase 1: GCP Project Setup (~10 min)

### Step 1.1: Create GCP Project

```powershell
# Login to Google Cloud
gcloud auth login

# Create project (or use existing)
gcloud projects create rashscore --name="rAsh Score"

# Set as active project
gcloud config set project rashscore

# Enable billing (required for BigQuery/Cloud Run)
# → Go to https://console.cloud.google.com/billing
# → Link a billing account to the "rashscore" project
```

### Step 1.2: Enable Required APIs

```powershell
gcloud services enable bigquery.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable iam.googleapis.com
```

### Step 1.3: Authenticate Locally

```powershell
# This creates Application Default Credentials (ADC)
# Used by Python pipeline + setup_schema.py
gcloud auth application-default login
```

After this command, a browser opens → login → credentials saved to your machine.

---

## Phase 2: BigQuery Setup (~5 min)

### Step 2.1: Create Tables

```powershell
cd c:\Users\kprsn\OneDrive\Desktop\RashScore\pipelines

# Install Python dependencies
pip install -r requirements.txt

# Run schema setup — creates dataset + 4 tables + 1 materialized view
python setup_schema.py
```

**Expected output:**
```
✅ Dataset: rashscore.brand_intelligence
✅ Table: pipeline_runs
✅ Table: brand_scores
✅ Table: industry_insights
✅ Table: reports
✅ Materialized View: brand_scores_aggregated

🎉 Schema setup complete!
```

### Step 2.2: Verify in Console

Open https://console.cloud.google.com/bigquery?project=rashscore

You should see:
```
rashscore
  └── brand_intelligence
      ├── pipeline_runs
      ├── brand_scores
      ├── industry_insights
      ├── reports
      └── brand_scores_aggregated (materialized view)
```

---

## Phase 3: Get API Keys (~5 min)

### Step 3.1: Gemini API Key (Required)

1. Go to https://aistudio.google.com/apikey
2. Click **"Create API Key"**
3. Select the `rashscore` project (or any project)
4. Copy the key

### Step 3.2: Tavily API Key (Optional, for agentic-live mode)

1. Go to https://tavily.com
2. Sign up (free)
3. Copy your API key from the dashboard

### Step 3.3: Set Environment Variables

```powershell
# Set for current session
$env:GEMINI_API_KEY = "your-gemini-key-here"
$env:TAVILY_API_KEY = "your-tavily-key-here"
$env:GCP_PROJECT_ID = "rashscore"

# To make permanent (run in admin PowerShell):
[Environment]::SetEnvironmentVariable("GEMINI_API_KEY", "your-gemini-key-here", "User")
[Environment]::SetEnvironmentVariable("TAVILY_API_KEY", "your-tavily-key-here", "User")
[Environment]::SetEnvironmentVariable("GCP_PROJECT_ID", "rashscore", "User")
```

---

## Phase 4: Run the Pipeline (~10 min)

### Step 4.1: First Run (Simple Mode — fastest)

```powershell
cd c:\Users\kprsn\OneDrive\Desktop\RashScore\pipelines

# Simple mode: 1 LLM call per industry, ~5 min total
python run_pipeline.py --provider=gemini --mode=simple
```

**Expected output:**
```
🚀 rAsh Score Pipeline — Provider: gemini | Mode: simple
📅 Run: 2026-07-28 | ID: abc123...

  📋 Technology & IT (15 brands)...
  ✅ Technology & IT: 15/15 brands scored in 3.2s

  📋 Automotive (15 brands)...
  ✅ Automotive: 14/15 brands scored in 2.8s

  ... (18 industries)

🏆 Top 10 Brands:
  1. HDFC Bank — 78
  2. TCS — 75
  ...

✅ Pipeline complete!
```

### Step 4.2: Agentic-Live Mode (with Tavily)

```powershell
# Agentic-live: Tavily search + LLM research + scoring (2 LLM calls + 1 Tavily per industry)
python run_pipeline.py --provider=gemini --mode=agentic-live
```

### Step 4.3: Verify Data in BigQuery

Go to BigQuery Console → run:
```sql
SELECT brand, score, recommendation, sentiment, prominence, accuracy
FROM `rashscore.brand_intelligence.brand_scores`
WHERE run_date = CURRENT_DATE()
ORDER BY score DESC
LIMIT 20;
```

---

## Phase 5: Run the Dashboard Locally (~5 min)

### Step 5.1: Install & Run

```powershell
cd c:\Users\kprsn\OneDrive\Desktop\RashScore\web

# Install dependencies
npm install

# Run dev server
npm run dev
```

Open http://localhost:3000 — you should see the dashboard with live BigQuery data.

### Step 5.2: Test the Public API

```powershell
# In a new terminal, while dev server is running:
curl http://localhost:3000/api/v1
curl http://localhost:3000/api/v1/score/Flipkart
curl http://localhost:3000/api/v1/rankings/technology?limit=5
```

---

## Phase 6: Deploy to Cloud Run (~15 min)

### Step 6.1: Create Service Account

```powershell
# Create a service account for Cloud Run
gcloud iam service-accounts create rashscore-web `
  --display-name="rAsh Score Web"

# Grant BigQuery access
gcloud projects add-iam-policy-binding rashscore `
  --member="serviceAccount:rashscore-web@rashscore.iam.gserviceaccount.com" `
  --role="roles/bigquery.dataViewer"

gcloud projects add-iam-policy-binding rashscore `
  --member="serviceAccount:rashscore-web@rashscore.iam.gserviceaccount.com" `
  --role="roles/bigquery.jobUser"
```

### Step 6.2: Deploy Manually (First Time)

```powershell
cd c:\Users\kprsn\OneDrive\Desktop\RashScore

# Deploy directly from source (Cloud Build will build the Dockerfile)
gcloud run deploy rashscore-web `
  --source=web/ `
  --region=us-central1 `
  --allow-unauthenticated `
  --port=8080 `
  --memory=512Mi `
  --min-instances=0 `
  --max-instances=3 `
  --service-account=rashscore-web@rashscore.iam.gserviceaccount.com `
  --set-env-vars="GCP_PROJECT_ID=rashscore,GEMINI_API_KEY=$env:GEMINI_API_KEY"
```

When prompted:
- **Allow unauthenticated invocations?** → Yes
- **Enable Cloud Build API?** → Yes
- **Create Artifact Registry repo?** → Yes

After ~3-5 min, you'll get:
```
Service URL: https://rashscore-web-xxxx-uc.a.run.app
```

### Step 6.3: Test the Deployment

```powershell
# Replace with your actual Cloud Run URL
$URL = "https://rashscore-web-xxxx-uc.a.run.app"

curl "$URL/api/health"
curl "$URL/api/v1/rankings/technology"
```

---

## Phase 7: Custom Domain (rashscore.live) (~10 min)

### Step 7.1: Map Domain in Cloud Run

```powershell
gcloud beta run domain-mappings create `
  --service=rashscore-web `
  --domain=rashscore.live `
  --region=us-central1
```

### Step 7.2: Configure DNS

The command above will show you DNS records. Add these to your domain provider:

| Type | Name | Value |
|------|------|-------|
| CNAME | @ | ghs.googlehosted.com. |
| CNAME | www | ghs.googlehosted.com. |

> [!NOTE]
> DNS propagation takes 5-30 minutes. SSL certificate is auto-provisioned by Google.

---

## Phase 8: GitHub Actions CI/CD (~10 min)

This makes every `git push` to `web/` auto-deploy to Cloud Run.

### Step 8.1: Set Up Workload Identity Federation (WIF)

```powershell
# Create a Workload Identity Pool
gcloud iam workload-identity-pools create "github-pool" `
  --location="global" `
  --display-name="GitHub Actions Pool"

# Create a Provider for GitHub
gcloud iam workload-identity-pools providers create-oidc "github-provider" `
  --location="global" `
  --workload-identity-pool="github-pool" `
  --display-name="GitHub Provider" `
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" `
  --issuer-uri="https://token.actions.githubusercontent.com"

# Allow GitHub Actions to impersonate the service account
gcloud iam service-accounts add-iam-policy-binding `
  "rashscore-web@rashscore.iam.gserviceaccount.com" `
  --role="roles/iam.workloadIdentityUser" `
  --member="principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/attribute.repository/kprsnt2/rAshScore"
```

> [!IMPORTANT]
> Replace `PROJECT_NUMBER` with your actual project number.
> Find it: `gcloud projects describe rashscore --format="value(projectNumber)"`

### Step 8.2: Grant Cloud Run Deployer Role

```powershell
gcloud projects add-iam-policy-binding rashscore `
  --member="serviceAccount:rashscore-web@rashscore.iam.gserviceaccount.com" `
  --role="roles/run.developer"

gcloud projects add-iam-policy-binding rashscore `
  --member="serviceAccount:rashscore-web@rashscore.iam.gserviceaccount.com" `
  --role="roles/cloudbuild.builds.builder"

gcloud projects add-iam-policy-binding rashscore `
  --member="serviceAccount:rashscore-web@rashscore.iam.gserviceaccount.com" `
  --role="roles/artifactregistry.writer"
```

### Step 8.3: Add GitHub Secrets

Go to **GitHub → Settings → Secrets → Actions** for your repo.
Add these secrets:

| Secret Name | Value |
|------------|-------|
| `GCP_WIF_PROVIDER` | `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/providers/github-provider` |
| `GCP_SERVICE_ACCOUNT` | `rashscore-web@rashscore.iam.gserviceaccount.com` |

### Step 8.4: Test CI/CD

```powershell
# Make any change to web/ and push
git add -A
git commit -m "test: trigger CI/CD"
git push
```

Go to **GitHub → Actions** tab → watch the deploy run.

---

## Quick Reference: Daily Operations

### Run scoring pipeline daily
```powershell
cd c:\Users\kprsn\OneDrive\Desktop\RashScore\pipelines
python run_pipeline.py --provider=gemini --mode=agentic-live
```

### Generate insights after pipeline
```powershell
python run_insights.py
```

### Run AI evals
```powershell
python -m evals.run_evals --date=2026-07-28
```

### Check pipeline health
```powershell
curl https://rashscore.live/api/health
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `google.auth.exceptions.DefaultCredentialsError` | Run `gcloud auth application-default login` |
| `403 Forbidden` on BigQuery | Check service account has `bigquery.dataViewer` + `bigquery.jobUser` roles |
| `setup_schema.py` fails | Make sure billing is enabled on the GCP project |
| Pipeline timeout | Increase `timeout` in `config.py` or reduce `DELAY_BETWEEN_INDUSTRIES` |
| Cloud Run deploy fails | Check `web/Dockerfile` builds locally: `docker build -t test web/` |
| Materialized View error | BigQuery free tier supports materialized views — check if base table has data first |
