# %% [markdown]
# # 📊 rAsh Score — AI Evals (Cross-Model Agreement & Drift)
# Evaluates scoring quality: cross-model agreement and temporal drift.
#
# **Schedule:** Daily at 8:00 AM IST (2 hours after scoring pipeline)

# %%
import subprocess, sys, json
from datetime import date, datetime, timedelta
subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "google-cloud-bigquery"])

# %%
GCP_PROJECT_ID = "rashscore"
BQ_FULL = f"{GCP_PROJECT_ID}.brand_intelligence"
EVAL_DATE = date.today().isoformat()

from google.cloud import bigquery
bq = bigquery.Client(project=GCP_PROJECT_ID)
print(f"✅ Running evals for {EVAL_DATE}")

# %% [markdown]
# ## Cross-Model Agreement

# %%
# Check if multiple models scored on this date
model_check = list(bq.query(f"""
    SELECT model, COUNT(DISTINCT brand) as brands
    FROM `{BQ_FULL}.brand_scores`
    WHERE run_date = '{EVAL_DATE}' AND error IS NULL AND score > 0
    GROUP BY model
""").result())

if len(model_check) < 2:
    print(f"⚠ Only {len(model_check)} model(s) scored today. Cross-model eval needs ≥2.")
    print("   Models found:", [r.model for r in model_check])
    cross_model_result = {"status": "skipped", "reason": "insufficient_models"}
else:
    # Find brands with high disagreement across models
    disagreement = list(bq.query(f"""
        SELECT brand, industry_id,
               MAX(score) - MIN(score) as spread,
               AVG(score) as avg_score,
               COUNT(DISTINCT model) as models,
               ARRAY_AGG(STRUCT(model, score)) as model_scores
        FROM `{BQ_FULL}.brand_scores`
        WHERE run_date = '{EVAL_DATE}' AND error IS NULL AND score > 0
        GROUP BY brand, industry_id
        HAVING COUNT(DISTINCT model) >= 2
        ORDER BY spread DESC
        LIMIT 20
    """).result())

    high_disagree = [{"brand": r.brand, "industry": r.industry_id, "spread": r.spread, "avg": round(r.avg_score)} 
                     for r in disagreement if r.spread > 15]
    
    avg_spread = round(sum(r.spread for r in disagreement) / len(disagreement), 1) if disagreement else 0
    
    cross_model_result = {
        "status": "ok",
        "brands_evaluated": len(disagreement),
        "avg_spread": avg_spread,
        "high_disagreement_count": len(high_disagree),
        "high_disagreement": high_disagree[:10],
    }
    
    print(f"📊 Cross-Model Agreement:")
    print(f"   Brands evaluated: {len(disagreement)}")
    print(f"   Avg score spread: {avg_spread} points")
    print(f"   High disagreement (>15pt): {len(high_disagree)} brands")
    if high_disagree:
        print(f"\n   Top disagreements:")
        for d in high_disagree[:5]:
            print(f"     • {d['brand']} ({d['industry']}): {d['spread']}pt spread")

# %% [markdown]
# ## Temporal Drift Detection

# %%
lookback = 7
lookback_date = (date.today() - timedelta(days=lookback)).isoformat()

# Industry-level drift
industry_drift = list(bq.query(f"""
    WITH today AS (
        SELECT industry_id, AVG(score) as avg_today
        FROM `{BQ_FULL}.brand_scores_aggregated`
        WHERE run_date = '{EVAL_DATE}'
        GROUP BY industry_id
    ),
    historical AS (
        SELECT industry_id, AVG(score) as avg_7d
        FROM `{BQ_FULL}.brand_scores_aggregated`
        WHERE run_date BETWEEN '{lookback_date}' AND '{EVAL_DATE}'
        GROUP BY industry_id
    )
    SELECT t.industry_id, 
           ROUND(t.avg_today, 1) as avg_today,
           ROUND(h.avg_7d, 1) as avg_7d,
           ROUND(t.avg_today - h.avg_7d, 1) as delta
    FROM today t JOIN historical h ON t.industry_id = h.industry_id
    ORDER BY ABS(t.avg_today - h.avg_7d) DESC
""").result())

drifted_industries = [{"id": r.industry_id, "today": r.avg_today, "avg_7d": r.avg_7d, "delta": r.delta}
                      for r in industry_drift if abs(r.delta) > 5]

# Brand-level drift
brand_drift = list(bq.query(f"""
    WITH today AS (
        SELECT brand, industry_id, score as score_today
        FROM `{BQ_FULL}.brand_scores_aggregated`
        WHERE run_date = '{EVAL_DATE}'
    ),
    historical AS (
        SELECT brand, industry_id, AVG(score) as avg_7d
        FROM `{BQ_FULL}.brand_scores_aggregated`
        WHERE run_date BETWEEN '{lookback_date}' AND '{EVAL_DATE}'
        GROUP BY brand, industry_id
    )
    SELECT t.brand, t.industry_id, t.score_today,
           ROUND(h.avg_7d, 1) as avg_7d,
           ROUND(t.score_today - h.avg_7d, 1) as delta
    FROM today t JOIN historical h ON t.brand = h.brand AND t.industry_id = h.industry_id
    WHERE ABS(t.score_today - h.avg_7d) > 10
    ORDER BY ABS(t.score_today - h.avg_7d) DESC
    LIMIT 20
""").result())

drifted_brands = [{"brand": r.brand, "industry": r.industry_id, "today": r.score_today, "avg_7d": r.avg_7d, "delta": r.delta}
                  for r in brand_drift]

drift_result = {
    "drifted_industries": drifted_industries,
    "drifted_brands": drifted_brands,
    "overall_drift": round(sum(abs(r.delta) for r in industry_drift) / len(industry_drift), 1) if industry_drift else 0,
}

print(f"\n📈 Drift Detection (vs {lookback}-day avg):")
print(f"   Industries drifted (>5pt): {len(drifted_industries)}")
print(f"   Brands drifted (>10pt):    {len(drifted_brands)}")
if drifted_industries:
    print(f"\n   Drifted industries:")
    for d in drifted_industries[:5]:
        arrow = "📈" if d["delta"] > 0 else "📉"
        print(f"     {arrow} {d['id']}: {d['today']} (was {d['avg_7d']}, delta {d['delta']:+.1f})")
if drifted_brands:
    print(f"\n   Top drifted brands:")
    for d in drifted_brands[:5]:
        arrow = "📈" if d["delta"] > 0 else "📉"
        print(f"     {arrow} {d['brand']} ({d['industry']}): {d['today']} (was {d['avg_7d']}, delta {d['delta']:+.1f})")

# %% [markdown]
# ## Save Eval Results to BigQuery

# %%
eval_rows = [
    {
        "eval_date": EVAL_DATE,
        "eval_type": "cross_model",
        "summary_json": json.dumps(cross_model_result, default=str),
        "created_at": datetime.utcnow().isoformat(),
    },
    {
        "eval_date": EVAL_DATE,
        "eval_type": "drift",
        "summary_json": json.dumps(drift_result, default=str),
        "created_at": datetime.utcnow().isoformat(),
    },
]

errors = bq.insert_rows_json(f"{BQ_FULL}.eval_results", eval_rows)
if errors:
    print(f"⚠ BQ write error: {errors}")
else:
    print(f"\n💾 Eval results saved to BigQuery")

print(f"\n✅ Evals complete for {EVAL_DATE}")
