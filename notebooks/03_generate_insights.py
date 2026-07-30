# %% [markdown]
# # 💡 rAsh Score — Daily Insight Generation
# Generates AI-powered narrative insights for each industry using latest scores.
#
# Uses `google-genai` SDK. **Schedule:** Daily at 7:00 AM IST (1 hour after scoring)

# %%
import subprocess, sys, os, json, time, uuid
from datetime import date, datetime
subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "google-genai", "google-cloud-bigquery"])

# %%
from google import genai
from google.genai import types
from google.cloud import bigquery

GCP_PROJECT_ID = "rashscore"
GCP_LOCATION = "us-central1"
BQ_FULL = f"{GCP_PROJECT_ID}.brand_intelligence"
MODEL = "gemini-2.5-flash"

ai = genai.Client(vertexai=True, project=GCP_PROJECT_ID, location=GCP_LOCATION)
bq = bigquery.Client(project=GCP_PROJECT_ID)

INDUSTRIES = [
    "technology", "automotive", "ecommerce", "fashion", "food-beverage",
    "healthcare", "finance", "telecom", "entertainment", "travel",
    "energy", "fmcg", "realestate", "edtech", "logistics",
    "consumer-electronics", "mobile-phones", "home-appliances",
]
print(f"✅ Ready — {len(INDUSTRIES)} industries")

# %% [markdown]
# ## Generate Insights

# %%
def get_latest_scores(industry_id):
    rows = list(bq.query(f"""
        SELECT brand, score, run_date
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


def call_ai(prompt):
    response = ai.models.generate_content(
        model=MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(temperature=0.5, max_output_tokens=2000),
    )
    return response.text


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
    print(f"📋 {ind_id}...", end=" ")

    scores = get_latest_scores(ind_id)
    if not scores:
        print("⚠ No scores")
        continue

    prev = get_previous_insight(ind_id)
    top = "\n".join(f"  {b['rank']}. {b['brand']}: {b['score']}/100" for b in scores["brands"][:10])

    if prev:
        prompt = f"""You are an AI brand intelligence analyst covering India.

Yesterday's insight ({prev['date']}) for {ind_id}:
{prev['text']}

Today's data ({scores['run_date']}) — avg: {scores['avg_score']}:
{top}

Generate 4-5 updated bullet-point insights. Each starts with emoji.
Focus on changes, movers, trends. Be specific. Output ONLY bullets."""
    else:
        prompt = f"""You are an AI brand intelligence analyst covering India.

Data for {ind_id} ({scores['run_date']}) — avg: {scores['avg_score']}:
{top}

Generate 4-5 bullet-point insights. Each starts with emoji. Be specific. Output ONLY bullets."""

    try:
        text = call_ai(prompt)
        write_insight(ind_id, today, text)
        print(f"✅ ({len(text)} chars)")
        success += 1
    except Exception as e:
        print(f"❌ {e}")

    time.sleep(3)

print(f"\n🎉 {success}/{len(INDUSTRIES)} insights generated")
