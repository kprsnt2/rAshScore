# %% [markdown]
# # 🏗️ rAsh Score — BigQuery Schema Setup
# Run this notebook **once** to create the dataset, tables, and materialized view.
#
# **Where to run:** BigQuery Studio → Notebooks → New Python Notebook
#
# No authentication needed — BigQuery notebooks have built-in GCP auth.

# %% [markdown]
# ## Configuration

# %%
GCP_PROJECT_ID = "rashscore"
GCP_REGION = "us-central1"
BQ_DATASET = "brand_intelligence"
BQ_FULL_DATASET = f"{GCP_PROJECT_ID}.{BQ_DATASET}"

print(f"Project: {GCP_PROJECT_ID}")
print(f"Dataset: {BQ_FULL_DATASET}")
print(f"Region:  {GCP_REGION}")

# %% [markdown]
# ## Create Dataset & Tables

# %%
from google.cloud import bigquery

client = bigquery.Client(project=GCP_PROJECT_ID)

# ── Create dataset ──
dataset_ref = bigquery.DatasetReference(GCP_PROJECT_ID, BQ_DATASET)
dataset = bigquery.Dataset(dataset_ref)
dataset.location = GCP_REGION
dataset.description = "rAsh Score — AI Brand Intelligence for India"
client.create_dataset(dataset, exists_ok=True)
print(f"✅ Dataset: {BQ_FULL_DATASET}")

# ── pipeline_runs ──
client.query(f"""
    CREATE TABLE IF NOT EXISTS `{BQ_FULL_DATASET}.pipeline_runs` (
        run_id STRING NOT NULL,
        run_date DATE NOT NULL,
        provider STRING NOT NULL,
        model STRING NOT NULL,
        total_industries INT64,
        total_brands INT64,
        successful_brands INT64,
        average_score FLOAT64,
        execution_time_ms INT64,
        status STRING,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
    )
    PARTITION BY run_date
""").result()
print("✅ Table: pipeline_runs")

# ── brand_scores ──
client.query(f"""
    CREATE TABLE IF NOT EXISTS `{BQ_FULL_DATASET}.brand_scores` (
        run_id STRING NOT NULL,
        run_date DATE NOT NULL,
        industry_id STRING NOT NULL,
        brand STRING NOT NULL,
        category STRING,
        model STRING NOT NULL,
        score INT64,
        recommendation INT64,
        sentiment INT64,
        prominence INT64,
        accuracy INT64,
        response_time_ms INT64,
        error STRING,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
    )
    PARTITION BY run_date
    CLUSTER BY industry_id, model
""").result()
print("✅ Table: brand_scores")

# ── industry_insights ──
client.query(f"""
    CREATE TABLE IF NOT EXISTS `{BQ_FULL_DATASET}.industry_insights` (
        insight_id STRING NOT NULL,
        industry_id STRING NOT NULL,
        insight_date DATE NOT NULL,
        insight_text STRING NOT NULL,
        generated_by STRING NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
    )
    PARTITION BY insight_date
""").result()
print("✅ Table: industry_insights")

# ── reports ──
client.query(f"""
    CREATE TABLE IF NOT EXISTS `{BQ_FULL_DATASET}.reports` (
        slug STRING NOT NULL,
        title STRING NOT NULL,
        content_md STRING NOT NULL,
        published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
    )
""").result()
print("✅ Table: reports")

# ── pipeline_traces (observability) ──
client.query(f"""
    CREATE TABLE IF NOT EXISTS `{BQ_FULL_DATASET}.pipeline_traces` (
        run_id STRING NOT NULL,
        provider STRING,
        mode STRING,
        total_duration_ms INT64,
        total_spans INT64,
        total_errors INT64,
        industries_scored INT64,
        overall_avg_score FLOAT64,
        agent_stats_json STRING,
        errors_json STRING,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
    )
""").result()
print("✅ Table: pipeline_traces")

# ── eval_results ──
client.query(f"""
    CREATE TABLE IF NOT EXISTS `{BQ_FULL_DATASET}.eval_results` (
        eval_date DATE NOT NULL,
        eval_type STRING NOT NULL,
        summary_json STRING NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
    )
    PARTITION BY eval_date
""").result()
print("✅ Table: eval_results")

# %% [markdown]
# ## Create Materialized View

# %%
try:
    client.query(f"""
        CREATE MATERIALIZED VIEW IF NOT EXISTS `{BQ_FULL_DATASET}.brand_scores_aggregated`
        AS
        SELECT
            run_date,
            industry_id,
            brand,
            ANY_VALUE(category) AS category,
            'all' AS model,
            CAST(ROUND(AVG(score)) AS INT64) AS score,
            CAST(ROUND(AVG(recommendation)) AS INT64) AS recommendation,
            CAST(ROUND(AVG(sentiment)) AS INT64) AS sentiment,
            CAST(ROUND(AVG(prominence)) AS INT64) AS prominence,
            CAST(ROUND(AVG(accuracy)) AS INT64) AS accuracy,
            COUNT(DISTINCT model) AS model_count
        FROM `{BQ_FULL_DATASET}.brand_scores`
        WHERE score > 0 AND error IS NULL
        GROUP BY run_date, industry_id, brand
    """).result()
    print("✅ Materialized View: brand_scores_aggregated")
except Exception as e:
    if "Already Exists" in str(e):
        print("✅ Materialized View: brand_scores_aggregated (already exists)")
    else:
        print(f"⚠ Materialized View error: {e}")

# %%
print("\n🎉 Schema setup complete!")
print(f"\nTables created in {BQ_FULL_DATASET}:")
print("  • pipeline_runs (partitioned by run_date)")
print("  • brand_scores (partitioned by run_date, clustered by industry_id, model)")
print("  • industry_insights (partitioned by insight_date)")
print("  • reports")
print("  • pipeline_traces")
print("  • eval_results (partitioned by eval_date)")
print("  • brand_scores_aggregated (materialized view)")
