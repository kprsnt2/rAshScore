"""
rAsh Score v2.0 — BigQuery Schema Setup
Creates dataset, tables, and materialized view.
Run once: python setup_schema.py
"""

from google.cloud import bigquery
from config import GCP_PROJECT_ID, BQ_DATASET, BQ_FULL_DATASET, GCP_REGION


def setup_schema():
    client = bigquery.Client(project=GCP_PROJECT_ID)

    # ── Create dataset ────────────────────────────────────────────────────
    dataset_ref = bigquery.DatasetReference(GCP_PROJECT_ID, BQ_DATASET)
    dataset = bigquery.Dataset(dataset_ref)
    dataset.location = GCP_REGION
    dataset.description = "rAsh Score — AI Brand Intelligence for India"
    try:
        client.create_dataset(dataset, exists_ok=True)
        print(f"✅ Dataset: {BQ_FULL_DATASET}")
    except Exception as e:
        print(f"⚠ Dataset: {e}")

    # ── pipeline_runs ─────────────────────────────────────────────────────
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

    # ── brand_scores ──────────────────────────────────────────────────────
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

    # ── industry_insights ─────────────────────────────────────────────────
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

    # ── reports ───────────────────────────────────────────────────────────
    client.query(f"""
        CREATE TABLE IF NOT EXISTS `{BQ_FULL_DATASET}.reports` (
            slug STRING NOT NULL,
            title STRING NOT NULL,
            content_md STRING NOT NULL,
            published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
        )
    """).result()
    print("✅ Table: reports")

    # ── Materialized view: aggregated scores across models ────────────────
    # Note: BigQuery materialized views auto-refresh when base table changes
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
            print("✅ Materialized View: brand_scores_aggregated (exists)")
        else:
            print(f"⚠ Materialized View error: {e}")
            print("   You may need to create it manually or use a scheduled query instead.")

    print("\n🎉 Schema setup complete!")


if __name__ == "__main__":
    setup_schema()
