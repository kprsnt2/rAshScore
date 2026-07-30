# %% [markdown]
# # 🧠 rAsh Score — Daily Scoring Pipeline
# **Self-contained BigQuery Notebook** — scores 270 brands across 18 industries using Gemini AI.
#
# Uses the official `google-genai` SDK (handles retries + rate limits automatically).
#
# **Schedule:** Daily at 6:00 AM IST via BigQuery Studio → Notebook Scheduling

# %% [markdown]
# ## Cell 1: Install & Configure

# %%
import subprocess, sys
subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "google-genai", "google-cloud-bigquery"])
print("✅ Dependencies installed")

# %%
import os

GCP_PROJECT_ID = "rashscore"
GCP_LOCATION = "us-central1"
BQ_DATASET = "brand_intelligence"
BQ_FULL = f"{GCP_PROJECT_ID}.{BQ_DATASET}"

PROVIDER = "gemini"
PRIMARY_MODEL = "gemini-2.5-flash"
BACKUP_MODEL = "gemini-2.5-flash-lite"
TEMPERATURE = 0.3
MAX_TOKENS = 8000
TIMEOUT = 60
RETRY_DELAYS = [10, 20, 30]
DELAY_BETWEEN_INDUSTRIES = 3  # seconds

SCORE_BOUNDS = {"recommendation": (0, 40), "sentiment": (0, 30), "prominence": (0, 20), "accuracy": (0, 10)}
WEIGHTS = {"recommendation": 0.40, "sentiment": 0.30, "prominence": 0.20, "accuracy": 0.10}

print(f"✅ Config: {GCP_PROJECT_ID} / {PRIMARY_MODEL} (Vertex AI in {GCP_LOCATION})")

# %% [markdown]
# ## Cell 2: Initialize Gemini Client via Vertex AI

# %%
from google import genai
from google.genai import types

# Initialize with Vertex AI (uses automatic GCP credentials in BigQuery Notebooks)
genai_client = genai.Client(
    vertexai=True,
    project=GCP_PROJECT_ID,
    location=GCP_LOCATION
)

# Quick test
test = genai_client.models.generate_content(
    model=PRIMARY_MODEL,
    contents="Say 'rAsh Score ready' in exactly 3 words.",
    config=types.GenerateContentConfig(temperature=0.1, max_output_tokens=20),
)
print(f"✅ Vertex AI connected: {test.text.strip()}")

# %% [markdown]
# ## Cell 3: Industry & Brand Data

# %%
INDUSTRIES = [
    {"id": "technology", "name": "Technology & IT", "category": "technology",
     "top_brands": ["Tata Consultancy Services", "Infosys", "Wipro", "HCL Technologies", "Tech Mahindra", "LTIMindtree", "Zoho", "Freshworks", "Mphasis", "Persistent Systems", "Coforge", "NIIT Technologies", "Zensar Technologies", "Cyient", "Happiest Minds"]},
    {"id": "automotive", "name": "Automotive", "category": "automotive",
     "top_brands": ["Maruti Suzuki", "Tata Motors", "Hyundai India", "Mahindra & Mahindra", "Hero MotoCorp", "Bajaj Auto", "Royal Enfield", "TVS Motor", "Kia India", "MG Motor India", "Ola Electric", "Ather Energy", "Yamaha", "Honda", "Toyota India"]},
    {"id": "ecommerce", "name": "Retail & E-Commerce", "category": "ecommerce",
     "top_brands": ["Flipkart", "Amazon India", "Reliance Retail", "Myntra", "Nykaa", "Meesho", "BigBasket", "JioMart", "Tata CLiQ", "AJIO", "Swiggy Instamart", "Blinkit", "DMart", "Croma", "FirstCry"]},
    {"id": "fashion", "name": "Fashion & Apparel", "category": "fashion",
     "top_brands": ["Fabindia", "Manyavar", "Allen Solly", "Peter England", "W (BIBA Group)", "Raymond", "Van Heusen", "Woodland", "Bata India", "Titan (Tanishq)", "Kalyan Jewellers", "Levi's India", "Bewakoof", "Puma India", "Nike India"]},
    {"id": "food-beverage", "name": "Food & Beverage", "category": "food-beverage",
     "top_brands": ["Amul", "ITC Foods", "Britannia", "Parle", "Haldiram's", "MDH Spices", "Nestle India", "Tata Consumer Products", "Paper Boat", "Chai Point", "Bira 91", "Zomato", "Swiggy", "Domino's India", "Cafe Coffee Day"]},
    {"id": "healthcare", "name": "Healthcare & Pharma", "category": "healthcare",
     "top_brands": ["Sun Pharmaceutical", "Dr. Reddy's", "Cipla", "Divi's Laboratories", "Apollo Hospitals", "Fortis Healthcare", "Max Healthcare", "Manipal Hospitals", "Narayana Health", "Lupin", "Aurobindo Pharma", "PharmEasy", "1mg (Tata Health)", "Biocon", "Thyrocare"]},
    {"id": "finance", "name": "Finance & Banking", "category": "finance",
     "top_brands": ["HDFC Bank", "State Bank of India", "ICICI Bank", "Kotak Mahindra Bank", "Axis Bank", "Bajaj Finance", "Paytm", "PhonePe", "Razorpay", "Zerodha", "Groww", "CRED", "LIC", "PolicyBazaar", "HDFC Life"]},
    {"id": "telecom", "name": "Telecommunications", "category": "telecom",
     "top_brands": ["Jio (Reliance)", "Airtel", "Vi (Vodafone Idea)", "BSNL", "Tata Communications", "ACT Fibernet", "Excitel", "Jio Fiber", "Airtel Xstream", "Lava International", "Micromax", "Jio Platforms", "Sterlite Technologies", "Tejas Networks", "HFCL"]},
    {"id": "entertainment", "name": "Entertainment & Media", "category": "entertainment",
     "top_brands": ["Disney+ Hotstar", "JioCinema", "Zee Entertainment", "Sony LIV", "Netflix India", "Amazon Prime Video India", "Gaana", "JioSaavn", "Times of India", "NDTV", "Republic TV", "Yash Raj Films", "T-Series", "Dream11", "MPL (Mobile Premier League)"]},
    {"id": "travel", "name": "Travel & Hospitality", "category": "travel",
     "top_brands": ["MakeMyTrip", "Ixigo", "Yatra", "IndiGo Airlines", "Air India", "Vistara", "IRCTC", "OYO Rooms", "Taj Hotels (IHCL)", "ITC Hotels", "Oberoi Hotels", "Lemon Tree Hotels", "Cleartrip", "Goibibo", "SpiceJet"]},
    {"id": "energy", "name": "Energy & Oil", "category": "energy",
     "top_brands": ["Reliance Industries", "Indian Oil Corporation", "ONGC", "Bharat Petroleum", "Hindustan Petroleum", "NTPC", "Adani Green Energy", "Tata Power", "Power Grid Corporation", "Coal India", "Suzlon Energy", "JSW Energy", "ReNew Energy", "Adani Total Gas", "GAIL India"]},
    {"id": "fmcg", "name": "Consumer Goods (FMCG)", "category": "fmcg",
     "top_brands": ["Hindustan Unilever", "ITC Limited", "Godrej Consumer", "Marico", "Dabur India", "Colgate-Palmolive India", "Patanjali", "Emami", "Himalaya Wellness", "Wipro Consumer (Santoor)", "Bajaj Consumer Care", "Jyothy Labs", "Cavinkare", "Lotus Herbals", "Mama Earth"]},
    {"id": "realestate", "name": "Real Estate & Construction", "category": "realestate",
     "top_brands": ["DLF", "Godrej Properties", "Prestige Estates", "Brigade Group", "Oberoi Realty", "Lodha (Macrotech)", "Mahindra Lifespace", "Shapoorji Pallonji", "L&T Realty", "Sobha Limited", "Puravankara", "Tata Housing", "NoBroker", "Housing.com", "99acres (Info Edge)"]},
    {"id": "edtech", "name": "Education & EdTech", "category": "edtech",
     "top_brands": ["BYJU'S", "Unacademy", "upGrad", "Vedantu", "Physics Wallah", "Simplilearn", "Great Learning", "Scaler Academy", "Coding Ninjas", "Allen Career Institute", "FIITJEE", "Aakash Institute", "Emeritus", "Eruditus", "Testbook"]},
    {"id": "logistics", "name": "Logistics & Supply Chain", "category": "logistics",
     "top_brands": ["Delhivery", "Blue Dart", "DTDC", "Ecom Express", "Shadowfax", "Rivigo", "Porter", "Dunzo", "XpressBees", "Gati Limited", "Allcargo Logistics", "TCI Express", "Mahindra Logistics", "Safexpress", "LoadShare"]},
    {"id": "consumer-electronics", "name": "Consumer Electronics", "category": "consumer-electronics",
     "top_brands": ["Samsung", "LG", "Sony", "Boat", "Noise", "Lenovo", "Dell", "HP", "Acer", "Zebronics", "Portronics", "TCL", "JBL India", "Sennheiser India", "Bose India"]},
    {"id": "mobile-phones", "name": "Mobile Phones", "category": "mobile-phones",
     "top_brands": ["Xiaomi", "Samsung", "Realme", "Vivo", "Oppo", "OnePlus", "Poco", "Motorola", "iQOO", "Apple", "Google", "Nothing Phone", "Nokia", "Lava", "Infinix"]},
    {"id": "home-appliances", "name": "Home Appliances", "category": "home-appliances",
     "top_brands": ["LG", "Samsung", "Whirlpool", "Godrej", "IFB", "Haier", "Voltas", "Blue Star", "Bajaj", "Crompton", "Kent RO", "Philips", "Panasonic", "Borosil", "Morphy Richards"]},
]

total_brands = sum(len(i["top_brands"]) for i in INDUSTRIES)
print(f"✅ {len(INDUSTRIES)} industries, {total_brands} brands")

# %% [markdown]
# ## Cell 4: Scoring Logic

# %%
import json, time, uuid
from datetime import date, datetime
from google.cloud import bigquery

SCORING_GUIDELINES = """STRICT Scoring guidelines — ALL scores are 0 to 100. Be honest and critical:

- recommendation (0-100): How likely is this brand to be recommended by AI assistants?
    90-100=undisputed category leader globally, 70-89=strong recommend, 40-69=average/neutral, 15-39=concerns exist, 0-14=actively avoid

- sentiment (0-100): Overall public and social media sentiment towards this brand?
    90-100=universally loved, 60-89=mostly positive, 30-59=mixed reviews, 10-29=mostly negative, 0-9=PR crisis / scandals

- prominence (0-100): How well-known and visible is this brand?
    90-100=global household name, 65-89=well-known nationally, 35-64=known in industry, 10-34=niche/emerging, 0-9=unknown

- accuracy (0-100): How much verified data do you have about this brand?
    90-100=extensive verified data, 50-89=moderate data, 20-49=limited info, 0-19=almost no data

IMPORTANT: Most brands should score 40-70. Only truly exceptional global brands score 80+.
A score of 90+ should be EXTREMELY rare. NEVER give a perfect 100."""


def generate_prompt(brands, category):
    brand_list = "\n".join(f"{i+1}. {b}" for i, b in enumerate(brands))
    return f"""You are an expert brand intelligence analyst. Score these {len(brands)} brands in the Indian {category} industry.

Research each brand's recent social media presence on Reddit, X/Twitter, and news.
Factor in controversies, product launches, viral content, community sentiment.

Brands:
{brand_list}

Score EACH dimension 0-100. Respond ONLY with valid JSON:
{{
  "brands": [
    {{"brand": "Brand Name", "breakdown": {{"recommendation": <0-100>, "sentiment": <0-100>, "prominence": <0-100>, "accuracy": <0-100>}}}}
  ]
}}

{SCORING_GUIDELINES}

Score ALL {len(brands)} brands. Be brutally honest."""


def apply_weightage(raw):
    return {d: int(round(max(0, min(100, float(raw.get(d, 0)))) * w)) for d, w in WEIGHTS.items()}


def fuzzy_match(parsed, expected):
    p = parsed.strip().lower()
    if not p: return None
    for b in expected:
        if b.lower() == p: return b
    for b in expected:
        if b.lower() in p or p in b.lower(): return b
    pf = p.split()[0] if p else ""
    for b in expected:
        if b.lower().split()[0] == pf: return b
    return None


def parse_response(text):
    try:
        s = text.strip()
        if s.startswith("```json"): s = s[7:]
        elif s.startswith("```"): s = s[3:]
        if s.endswith("```"): s = s[:-3]
        parsed = json.loads(s.strip())
        brands_list = parsed.get("brands", parsed)
        if not isinstance(brands_list, list): return []
        results = []
        for b in brands_list:
            name = str(b.get("brand") or b.get("name") or "").strip()
            if not name: continue
            bd = b.get("breakdown") or b.get("scores") or {}
            raw = {d: float(bd.get(d, 0)) for d in WEIGHTS}
            weighted = apply_weightage(raw)
            total = min(100, sum(weighted.values()))
            results.append({"brand": name, "score": total, "breakdown": weighted})
        return results
    except Exception as e:
        print(f"  ⚠ Parse error: {e}")
        return []


print("✅ Scoring logic loaded")

# %% [markdown]
# ## Cell 5: Gemini Caller (with automatic retry via SDK)

# %%
def call_gemini(prompt, model=PRIMARY_MODEL):
    """Call Gemini using google-genai SDK. Handles retries automatically."""
    try:
        response = genai_client.models.generate_content(
            model=model,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.3,
                max_output_tokens=8000,
            ),
        )
        text = response.text
        if not text or not text.strip():
            raise ValueError("Empty response from model")
        return text, model
    except Exception as e:
        raise RuntimeError(f"{model}: {e}")


def call_with_retry(prompt):
    """Try primary model, then backup. SDK handles 429 retries internally."""
    for model in [PRIMARY_MODEL, BACKUP_MODEL]:
        try:
            return call_gemini(prompt, model)
        except Exception as e:
            print(f"    ⚠ {model} failed: {str(e)[:120]}")
            if model == PRIMARY_MODEL:
                print(f"    🔄 Trying backup model: {BACKUP_MODEL}...")
                time.sleep(5)
    raise RuntimeError("All models failed")


print("✅ Gemini caller ready (using google-genai SDK with auto-retry)")

# %% [markdown]
# ## Cell 6: BigQuery Writer

# %%
bq_client = bigquery.Client(project=GCP_PROJECT_ID)


def write_scores(scores, run_id, run_date, model, industry_id, category):
    rows = [{
        "run_id": run_id, "run_date": run_date, "industry_id": industry_id,
        "brand": s["brand"], "category": category, "model": model,
        "score": s["score"],
        "recommendation": s["breakdown"].get("recommendation", 0),
        "sentiment": s["breakdown"].get("sentiment", 0),
        "prominence": s["breakdown"].get("prominence", 0),
        "accuracy": s["breakdown"].get("accuracy", 0),
        "response_time_ms": 0, "error": None,
        "created_at": datetime.utcnow().isoformat(),
    } for s in scores]
    if not rows: return 0
    errors = bq_client.insert_rows_json(f"{BQ_FULL}.brand_scores", rows)
    if errors: raise RuntimeError(f"BQ error: {errors}")
    return len(rows)


def write_run(run_id, run_date, model, total_industries, total_brands,
              successful, avg_score, time_ms, status):
    bq_client.insert_rows_json(f"{BQ_FULL}.pipeline_runs", [{
        "run_id": run_id, "run_date": run_date, "provider": PROVIDER,
        "model": model, "total_industries": total_industries,
        "total_brands": total_brands, "successful_brands": successful,
        "average_score": avg_score, "execution_time_ms": time_ms,
        "status": status, "created_at": datetime.utcnow().isoformat(),
    }])


print("✅ BigQuery writer ready")

# %% [markdown]
# ## Cell 7: 🚀 Run Pipeline

# %%
run_id = str(uuid.uuid4())
run_date = date.today().isoformat()
start_time = time.time()

print(f"🇮🇳 rAsh Score Pipeline")
print("=" * 50)
print(f"📊 {len(INDUSTRIES)} industries, {total_brands} brands")
print(f"🎯 Model: {PRIMARY_MODEL} (google-genai SDK)")
print(f"📅 Date: {run_date} | Run: {run_id[:8]}...")
print()

results = []
all_scores = []

for i, industry in enumerate(INDUSTRIES):
    ind_id = industry["id"]
    brands = industry["top_brands"]
    cat = industry["category"]

    print(f"  📋 {industry['name']} ({len(brands)} brands)...", end=" ")
    t0 = time.time()

    try:
        prompt = generate_prompt(brands, cat)
        text, model_used = call_with_retry(prompt)
        scores = parse_response(text)

        if not scores:
            print("⚠ Parse failed")
            results.append({"id": ind_id, "ok": 0, "total": len(brands), "err": "parse"})
            continue

        matched = []
        for s in scores:
            m = fuzzy_match(s["brand"], brands)
            if m:
                s["brand"] = m
                matched.append(s)

        written = write_scores(matched, run_id, run_date, model_used, ind_id, cat)
        elapsed = time.time() - t0

        print(f"✅ {written}/{len(brands)} in {elapsed:.1f}s")
        results.append({"id": ind_id, "ok": written, "total": len(brands), "scores": matched})
        all_scores.extend(matched)

    except Exception as e:
        print(f"❌ {e}")
        results.append({"id": ind_id, "ok": 0, "total": len(brands), "err": str(e)})

    if i < len(INDUSTRIES) - 1:
        time.sleep(DELAY_BETWEEN_INDUSTRIES)

# %% [markdown]
# ## Cell 8: Summary

# %%
total_ms = int((time.time() - start_time) * 1000)
successful = sum(r["ok"] for r in results)
failed = [r for r in results if r.get("err")]
avg = round(sum(s["score"] for s in all_scores) / len(all_scores)) if all_scores else 0

if successful > 0:
    write_run(run_id, run_date, PRIMARY_MODEL, len(INDUSTRIES), total_brands,
              successful, avg, total_ms, "partial" if failed else "success")

print(f"\n📊 Summary")
print(f"{'=' * 30}")
print(f"Industries: {len(INDUSTRIES) - len(failed)}/{len(INDUSTRIES)}")
print(f"Brands:     {successful}/{total_brands}")
print(f"Avg Score:  {avg}/100")
print(f"Time:       {total_ms / 1000:.0f}s")

if failed:
    print(f"\n⚠️ Failed: {', '.join(r['id'] for r in failed)}")

if all_scores:
    top = sorted(all_scores, key=lambda s: s["score"], reverse=True)[:10]
    print(f"\n🏆 Top 10:")
    for i, s in enumerate(top):
        print(f"  {i+1}. {s['brand']} — {s['score']}/100")

print("\n✅ Pipeline complete!")

# %% [markdown]
# ## Cell 9: Verify in BigQuery

# %%
df = bq_client.query(f"""
    SELECT brand, score, recommendation, sentiment, prominence, accuracy, industry_id
    FROM `{BQ_FULL}.brand_scores`
    WHERE run_date = '{run_date}' AND run_id = '{run_id}'
    ORDER BY score DESC LIMIT 20
""").to_dataframe()

print(f"📊 Top 20 brands scored today:")
df

# %% [markdown]
# ## Cell 10: Refresh Daily Dashboard Snapshot Table (`brand_scores_aggregated`)

# %%
refresh_query = f"""
CREATE OR REPLACE TABLE `{BQ_FULL}.brand_scores_aggregated` AS
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
    COUNT(DISTINCT model) AS model_count,
    CURRENT_TIMESTAMP() AS created_at
FROM `{BQ_FULL}.brand_scores`
WHERE run_date = (SELECT MAX(run_date) FROM `{BQ_FULL}.brand_scores` WHERE score > 0)
  AND score > 0 AND error IS NULL
GROUP BY run_date, industry_id, brand;
"""

bq_client.query(refresh_query).result()
print("✅ Table `brand_scores_aggregated` created/refreshed with latest daily scores!")

