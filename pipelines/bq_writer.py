"""
rAsh Score v2.0 — BigQuery Write Helpers
Streaming inserts and batch loading for all pipeline tables.
"""

from __future__ import annotations
import uuid
from datetime import date, datetime
from google.cloud import bigquery
from config import GCP_PROJECT_ID, BQ_DATASET, BQ_FULL_DATASET


_client: bigquery.Client | None = None


def get_bq_client() -> bigquery.Client:
    """Get or create a BigQuery client (cached singleton)."""
    global _client
    if _client is None:
        _client = bigquery.Client(project=GCP_PROJECT_ID)
    return _client


def generate_run_id() -> str:
    """Generate a unique run ID."""
    return str(uuid.uuid4())


def write_pipeline_run(
    run_id: str,
    run_date: str,
    provider: str,
    model: str,
    total_industries: int,
    total_brands: int,
    successful_brands: int,
    average_score: float,
    execution_time_ms: int,
    status: str = "success",
) -> None:
    """Write a pipeline run summary row."""
    client = get_bq_client()
    table = f"{BQ_FULL_DATASET}.pipeline_runs"

    rows = [{
        "run_id": run_id,
        "run_date": run_date,
        "provider": provider,
        "model": model,
        "total_industries": total_industries,
        "total_brands": total_brands,
        "successful_brands": successful_brands,
        "average_score": average_score,
        "execution_time_ms": execution_time_ms,
        "status": status,
        "created_at": datetime.utcnow().isoformat(),
    }]

    errors = client.insert_rows_json(table, rows)
    if errors:
        print(f"  ❌ BigQuery insert errors (pipeline_runs): {errors}")
        raise RuntimeError(f"Failed to write pipeline run: {errors}")
    print(f"  💾 Pipeline run recorded: {run_id[:8]}... ({provider}/{model})")


def write_brand_scores(
    scores: list[dict],
    run_id: str,
    run_date: str,
    model: str,
    industry_id: str,
    category: str,
) -> int:
    """
    Write brand score rows to BigQuery.
    Each dict in scores must have: brand, score, breakdown (recommendation, sentiment, prominence, accuracy)
    Returns number of rows written.
    """
    client = get_bq_client()
    table = f"{BQ_FULL_DATASET}.brand_scores"

    rows = []
    for s in scores:
        bd = s.get("breakdown", {})
        rows.append({
            "run_id": run_id,
            "run_date": run_date,
            "industry_id": industry_id,
            "brand": s["brand"],
            "category": category,
            "model": model,
            "score": s["score"],
            "recommendation": bd.get("recommendation", 0),
            "sentiment": bd.get("sentiment", 0),
            "prominence": bd.get("prominence", 0),
            "accuracy": bd.get("accuracy", 0),
            "response_time_ms": s.get("response_time_ms", 0),
            "error": s.get("error"),
            "created_at": datetime.utcnow().isoformat(),
        })

    if not rows:
        return 0

    errors = client.insert_rows_json(table, rows)
    if errors:
        print(f"  ❌ BigQuery insert errors (brand_scores): {errors}")
        raise RuntimeError(f"Failed to write brand scores: {errors}")

    return len(rows)


def write_insight(
    industry_id: str,
    insight_date: str,
    insight_text: str,
    generated_by: str,
) -> None:
    """Write an AI-generated insight row."""
    client = get_bq_client()
    table = f"{BQ_FULL_DATASET}.industry_insights"

    rows = [{
        "insight_id": str(uuid.uuid4()),
        "industry_id": industry_id,
        "insight_date": insight_date,
        "insight_text": insight_text,
        "generated_by": generated_by,
        "created_at": datetime.utcnow().isoformat(),
    }]

    errors = client.insert_rows_json(table, rows)
    if errors:
        print(f"  ❌ BigQuery insert errors (industry_insights): {errors}")
        raise RuntimeError(f"Failed to write insight: {errors}")


def query_latest_scores(industry_id: str, run_date: str | None = None) -> list[dict]:
    """
    Query latest aggregated brand scores for an industry.
    If run_date is None, uses the most recent date available.
    Returns list of {brand, score, rank} sorted by score desc.
    """
    client = get_bq_client()

    if run_date:
        query = f"""
            SELECT brand, score, category,
                   recommendation, sentiment, prominence, accuracy
            FROM `{BQ_FULL_DATASET}.brand_scores_aggregated`
            WHERE industry_id = @industry_id AND run_date = @run_date
            ORDER BY score DESC
        """
        params = [
            bigquery.ScalarQueryParameter("industry_id", "STRING", industry_id),
            bigquery.ScalarQueryParameter("run_date", "DATE", run_date),
        ]
    else:
        query = f"""
            SELECT brand, score, category, run_date,
                   recommendation, sentiment, prominence, accuracy
            FROM `{BQ_FULL_DATASET}.brand_scores_aggregated`
            WHERE industry_id = @industry_id
              AND run_date = (
                SELECT MAX(run_date) FROM `{BQ_FULL_DATASET}.brand_scores_aggregated`
                WHERE industry_id = @industry_id
              )
            ORDER BY score DESC
        """
        params = [
            bigquery.ScalarQueryParameter("industry_id", "STRING", industry_id),
        ]

    job_config = bigquery.QueryJobConfig(query_parameters=params)
    result = client.query(query, job_config=job_config).result()

    brands = []
    for i, row in enumerate(result):
        brands.append({
            "brand": row.brand,
            "score": row.score,
            "rank": i + 1,
            "category": row.category,
            "run_date": str(row.run_date) if hasattr(row, "run_date") else run_date,
        })
    return brands


def query_latest_insight(industry_id: str) -> dict | None:
    """Get the most recent insight for an industry."""
    client = get_bq_client()
    query = f"""
        SELECT insight_id, industry_id, insight_date, insight_text, generated_by, created_at
        FROM `{BQ_FULL_DATASET}.industry_insights`
        WHERE industry_id = @industry_id
        ORDER BY insight_date DESC
        LIMIT 1
    """
    params = [bigquery.ScalarQueryParameter("industry_id", "STRING", industry_id)]
    job_config = bigquery.QueryJobConfig(query_parameters=params)
    rows = list(client.query(query, job_config=job_config).result())

    if not rows:
        return None
    row = rows[0]
    return {
        "insight_id": row.insight_id,
        "industry_id": row.industry_id,
        "insight_date": str(row.insight_date),
        "insight_text": row.insight_text,
        "generated_by": row.generated_by,
    }


def query_previous_day_scores(industry_id: str, before_date: str) -> list[dict] | None:
    """Get scores from the day before a given date for delta calculations."""
    client = get_bq_client()
    query = f"""
        SELECT brand, score
        FROM `{BQ_FULL_DATASET}.brand_scores_aggregated`
        WHERE industry_id = @industry_id
          AND run_date = (
            SELECT MAX(run_date) FROM `{BQ_FULL_DATASET}.brand_scores_aggregated`
            WHERE industry_id = @industry_id AND run_date < @before_date
          )
        ORDER BY score DESC
    """
    params = [
        bigquery.ScalarQueryParameter("industry_id", "STRING", industry_id),
        bigquery.ScalarQueryParameter("before_date", "DATE", before_date),
    ]
    job_config = bigquery.QueryJobConfig(query_parameters=params)
    rows = list(client.query(query, job_config=job_config).result())
    if not rows:
        return None
    return [{"brand": r.brand, "score": r.score, "rank": i + 1} for i, r in enumerate(rows)]
