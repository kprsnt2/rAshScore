# %% [markdown]
# # 💡 rAsh Score — Daily Insight Generation
# Generates AI-powered narrative insights for each industry using latest scores.
#
# **Schedule:** Daily at 7:00 AM IST (1 hour after scoring pipeline)

# %%
import subprocess, sys, os, json, time, uuid, requests
from datetime import date, datetime
subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "requests", "google-cloud-bigquery"])

# %%
GCP_PROJECT_ID = "rashscore"
BQ_FULL = f"{GCP_PROJECT_ID}.brand_intelligence"
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "YOUR_GEMINI_API_KEY_HERE")
MODEL = "gemini-2.5-flash"

INDUSTRIES = [
    "technology", "automotive", "ecommerce", "fashion", "food-beverage",
    "healthcare", "finance", "telecom", "entertainment", "travel",
    "energy", "fmcg", "realestate", "edtech", "logistics",
    "consumer-electronics", "mobile-phones", "home-appliances",
]

from google.cloud import bigquery
bq = bigquery.Client(project=GCP_PROJECT_ID)
print(f"✅ Config ready — {len(INDUSTRIES)} industries")

# %% [markdown]
# ## Generate Insights

# %%
def get_latest_scores(industry_id):
    rows = list(bq.query(f"""
        SELECT brand, score, recommendation, sentiment, prominence, accuracy, run_date
        FROM `{BQ_FULL}.brand_scores_aggregated`
        WHERE industry_id = '{industry_id}'
          AND run_date = (SELECT MAX(run_date) FROM `{BQ_FULL}.brand_scores_aggregated` WHERE industry_id = '{industry_id}')
        ORDER BY score DESC
    """).result())
    if not rows: return None
    brands = [{"brand": r.brand, "score": r.score, "rank": i+1} for i, r in enumerate(rows)]
    avg = round(sum(r.score for r in rows) / len(rows)) if rows else 0
    return {"run_date": str(rows[0].run_date), "avg_score": avg, "brands": brands}


def get_previous_insight(industry_id):
    rows = list(bq.query(f"""
        SELECT insight_text, insight_date
        FROM `{BQ_FULL}.industry_insights`
        WHERE industry_id = '{industry_id}'
        ORDER BY insight_date DESC LIMIT 1
    """).result())
    return {"text": rows[0].insight_text, "date": str(rows[0].insight_date)} if rows else None


def call_gemini(prompt):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={GEMINI_API_KEY}"
    resp = requests.post(url, json={
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.5, "maxOutputTokens": 2000},
    }, timeout=60)
    resp.raise_for_status()
    return resp.json()["candidates"][0]["content"]["parts"][0]["text"]


def write_insight(industry_id, insight_date, text):
    bq.insert_rows_json(f"{BQ_FULL}.industry_insights", [{
        "insight_id": str(uuid.uuid4()),
        "industry_id": industry_id,
        "insight_date": insight_date,
        "insight_text": text,
        "generated_by": MODEL,
        "created_at": datetime.utcnow().isoformat(),
    }])


# %%
today = date.today().isoformat()
success = 0

for ind_id in INDUSTRIES:
    print(f"\n📋 {ind_id}...")

    scores = get_latest_scores(ind_id)
    if not scores:
        print(f"  ⚠ No scores found, skipping")
        continue

    prev = get_previous_insight(ind_id)
    top_brands = "\n".join(f"  {b['rank']}. {b['brand']}: {b['score']}/100" for b in scores["brands"][:10])

    if prev:
        prompt = f"""You are an AI brand intelligence analyst covering India.

Yesterday's insight ({prev['date']}) for {ind_id}:
{prev['text']}

Today's data ({scores['run_date']}) — avg: {scores['avg_score']}:
{top_brands}

Generate 4-5 updated bullet-point insights. Each bullet starts with an emoji.
Focus on changes, movers, and trends. Be specific with names and scores.
Output ONLY the bullet list."""
    else:
        prompt = f"""You are an AI brand intelligence analyst covering India.

Data for {ind_id} ({scores['run_date']}) — avg: {scores['avg_score']}:
{top_brands}

Generate 4-5 bullet-point insights. Each bullet starts with an emoji.
Be specific with names, scores, and rankings. Output ONLY the bullet list."""

    try:
        insight_text = call_gemini(prompt)
        write_insight(ind_id, today, insight_text)
        print(f"  ✅ Insight generated ({len(insight_text)} chars)")
        success += 1
    except Exception as e:
        print(f"  ❌ Failed: {e}")

    time.sleep(5)

print(f"\n🎉 Done! {success}/{len(INDUSTRIES)} insights generated")
