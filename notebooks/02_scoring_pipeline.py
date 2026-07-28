# %% [markdown]
# # 🧠 rAsh Score — Daily Scoring Pipeline
# **Self-contained BigQuery Notebook** — scores 270 brands across 18 industries using Gemini AI.
#
# **Schedule:** Daily at 6:00 AM IST via BigQuery Studio → Notebook Scheduling
#
# No local setup needed. All code is inline. Auth is automatic in BigQuery notebooks.

# %% [markdown]
# ## Cell 1: Install Dependencies & Configure

# %%
# Install required packages (runs once per notebook session)
import subprocess, sys
subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "requests", "google-cloud-bigquery", "google-auth"])
print("✅ Dependencies installed")

# %%
# ─── CONFIGURATION ───────────────────────────────────────────────────────────
import os

GCP_PROJECT_ID = "rashscore"
BQ_DATASET = "brand_intelligence"
BQ_FULL = f"{GCP_PROJECT_ID}.{BQ_DATASET}"

# ⚠️ SET YOUR API KEY HERE (or use Secret Manager)
# Option 1: Hardcode (for testing only)
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "YOUR_GEMINI_API_KEY_HERE")

# Option 2: Load from Secret Manager (recommended for scheduled runs)
# from google.cloud import secretmanager
# client = secretmanager.SecretManagerServiceClient()
# name = f"projects/{GCP_PROJECT_ID}/secrets/gemini-api-key/versions/latest"
# GEMINI_API_KEY = client.access_secret_version(name=name).payload.data.decode("utf-8")

PROVIDER = "gemini"
PRIMARY_MODEL = "gemini-2.5-flash"
BACKUP_MODEL = "gemini-2.5-flash-lite"
TEMPERATURE = 0.3
MAX_TOKENS = 8000
TIMEOUT = 60
RETRY_DELAYS = [30, 60, 90]
DELAY_BETWEEN_INDUSTRIES = 12  # seconds

SCORE_BOUNDS = {"recommendation": (0, 40), "sentiment": (0, 30), "prominence": (0, 20), "accuracy": (0, 10)}
WEIGHTS = {"recommendation": 0.40, "sentiment": 0.30, "prominence": 0.20, "accuracy": 0.10}

print(f"✅ Config: {GCP_PROJECT_ID} / {PRIMARY_MODEL}")
print(f"   API Key: {'SET' if GEMINI_API_KEY != 'YOUR_GEMINI_API_KEY_HERE' else '⚠️ NOT SET — edit cell above!'}")

# %% [markdown]
# ## Cell 2: Industry & Brand Data (18 industries, 270 brands)

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
print(f"✅ Loaded {len(INDUSTRIES)} industries, {total_brands} brands")

# %% [markdown]
# ## Cell 3: Scoring Logic (Prompts, Parsing, Weightage)

# %%
import json, re, time, uuid, requests
from datetime import date, datetime
from google.cloud import bigquery

# ─── Scoring Guidelines ─────────────────────────────────────────────────────

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

SOCIAL_MEDIA_RESEARCH = """Research the brand's recent presence on Reddit, X/Twitter, news articles.
Factor in controversies, product launches, viral content, community sentiment.
This MUST influence your scores — especially sentiment and recommendation."""


def generate_batch_prompt(brands, category):
    brand_list = "\n".join(f"{i+1}. {b}" for i, b in enumerate(brands))
    return f"""You are an expert brand intelligence analyst. Score these {len(brands)} brands in the Indian {category} industry for AI visibility.

{SOCIAL_MEDIA_RESEARCH}

Brands:
{brand_list}

Score EACH dimension on a scale of 0 to 100.

Respond ONLY with valid JSON (no markdown, no explanation):
{{
  "brands": [
    {{
      "brand": "Brand Name",
      "breakdown": {{
        "recommendation": <number 0-100>,
        "sentiment": <number 0-100>,
        "prominence": <number 0-100>,
        "accuracy": <number 0-100>
      }}
    }}
  ]
}}

{SCORING_GUIDELINES}

Score ALL {len(brands)} brands. Be brutally honest — most dimensions should be 40-70."""


def apply_weightage(raw_scores):
    return {dim: int(round(max(0, min(100, float(raw_scores.get(dim, 0)))) * w))
            for dim, w in WEIGHTS.items()}


def fuzzy_match_brand(parsed_name, expected_brands):
    p = parsed_name.strip().lower()
    if not p:
        return None
    for b in expected_brands:
        if b.lower() == p:
            return b
    for b in expected_brands:
        if b.lower() in p or p in b.lower():
            return b
    pf = p.split()[0] if p else ""
    for b in expected_brands:
        if b.lower().split()[0] == pf:
            return b
    return None


def parse_batch_response(text):
    try:
        s = text.strip()
        if s.startswith("```json"): s = s[7:]
        elif s.startswith("```"): s = s[3:]
        if s.endswith("```"): s = s[:-3]
        parsed = json.loads(s.strip())
        brands_list = parsed.get("brands", parsed)
        if not isinstance(brands_list, list):
            return []
        results = []
        for b in brands_list:
            name = str(b.get("brand") or b.get("name") or "").strip()
            if not name: continue
            bd = b.get("breakdown") or b.get("scores") or {}
            raw = {d: float(bd.get(d, 0)) for d in WEIGHTS}
            weighted = apply_weightage(raw)
            total = min(100, sum(weighted.values()))
            results.append({"brand": name, "score": total, "breakdown": weighted, "raw_scores": raw})
        return results
    except (json.JSONDecodeError, ValueError, TypeError) as e:
        print(f"  ⚠ Parse error: {e}")
        return []


print("✅ Scoring logic loaded")

# %% [markdown]
# ## Cell 4: Gemini API Caller with Retry

# %%
def call_gemini(prompt, model=PRIMARY_MODEL):
    """Call Gemini API. Returns (response_text, model_used)."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}"
    resp = requests.post(url, headers={"Content-Type": "application/json"}, json={
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": TEMPERATURE, "maxOutputTokens": MAX_TOKENS},
    }, timeout=TIMEOUT)
    resp.raise_for_status()
    data = resp.json()
    text = data["candidates"][0]["content"]["parts"][0]["text"]
    return text, model


def call_with_retry(prompt):
    """Call Gemini with primary → backup fallback and retries."""
    for model in [PRIMARY_MODEL, BACKUP_MODEL]:
        for attempt in range(len(RETRY_DELAYS) + 1):
            try:
                text, used = call_gemini(prompt, model)
                if not text.strip():
                    raise ValueError("Empty response")
                return text, used
            except Exception as e:
                is_quota = any(k in str(e).lower() for k in ["429", "quota", "rate"])
                print(f"    ⚠ {model} attempt {attempt+1} failed{' (rate-limit)' if is_quota else ''}: {str(e)[:100]}")
                if attempt < len(RETRY_DELAYS):
                    time.sleep(RETRY_DELAYS[attempt])
        print(f"    ❌ {model} exhausted retries, trying backup...")
    raise RuntimeError("All models failed")


print("✅ Gemini caller ready")

# %% [markdown]
# ## Cell 5: BigQuery Writer

# %%
bq_client = bigquery.Client(project=GCP_PROJECT_ID)

def write_brand_scores(scores, run_id, run_date, model, industry_id, category):
    rows = []
    for s in scores:
        bd = s.get("breakdown", {})
        rows.append({
            "run_id": run_id, "run_date": run_date, "industry_id": industry_id,
            "brand": s["brand"], "category": category, "model": model,
            "score": s["score"],
            "recommendation": bd.get("recommendation", 0),
            "sentiment": bd.get("sentiment", 0),
            "prominence": bd.get("prominence", 0),
            "accuracy": bd.get("accuracy", 0),
            "response_time_ms": s.get("response_time_ms", 0),
            "error": s.get("error"),
            "created_at": datetime.utcnow().isoformat(),
        })
    if not rows: return 0
    errors = bq_client.insert_rows_json(f"{BQ_FULL}.brand_scores", rows)
    if errors:
        print(f"  ❌ BQ insert error: {errors}")
        raise RuntimeError(f"BQ write failed: {errors}")
    return len(rows)


def write_pipeline_run(run_id, run_date, provider, model, total_industries,
                        total_brands, successful_brands, average_score,
                        execution_time_ms, status="success"):
    rows = [{
        "run_id": run_id, "run_date": run_date, "provider": provider,
        "model": model, "total_industries": total_industries,
        "total_brands": total_brands, "successful_brands": successful_brands,
        "average_score": average_score, "execution_time_ms": execution_time_ms,
        "status": status, "created_at": datetime.utcnow().isoformat(),
    }]
    errors = bq_client.insert_rows_json(f"{BQ_FULL}.pipeline_runs", rows)
    if errors:
        print(f"  ❌ Pipeline run write error: {errors}")


print("✅ BigQuery writer ready")

# %% [markdown]
# ## Cell 6: 🚀 Run the Pipeline

# %%
run_id = str(uuid.uuid4())
run_date = date.today().isoformat()
start_time = time.time()

print(f"🇮🇳 rAsh Score Pipeline")
print("=" * 50)
print(f"📊 {len(INDUSTRIES)} industries, {total_brands} brands")
print(f"🎯 Model: {PRIMARY_MODEL} (backup: {BACKUP_MODEL})")
print(f"📅 Date: {run_date}")
print(f"🔑 Run ID: {run_id[:8]}...")
print(f"\n🚀 Starting...\n")

results = []
all_scores = []

for i, industry in enumerate(INDUSTRIES):
    industry_id = industry["id"]
    brands = industry["top_brands"]
    category = industry["category"]

    print(f"  📋 {industry['name']} ({len(brands)} brands)...")
    ind_start = time.time()

    try:
        prompt = generate_batch_prompt(brands, category)
        text, model_used = call_with_retry(prompt)
        scores = parse_batch_response(text)

        if not scores:
            print(f"    ⚠ Unparseable response")
            results.append({"industry_id": industry_id, "success": 0, "total": len(brands), "error": "unparseable"})
            continue

        # Fuzzy match brand names
        matched = []
        for s in scores:
            m = fuzzy_match_brand(s["brand"], brands)
            if m:
                s["brand"] = m
                matched.append(s)

        # Write to BigQuery
        written = write_brand_scores(matched, run_id, run_date, model_used, industry_id, category)
        elapsed = time.time() - ind_start

        print(f"  ✅ {industry['name']}: {written}/{len(brands)} brands in {elapsed:.1f}s")
        results.append({"industry_id": industry_id, "success": written, "total": len(brands), "scores": matched})
        all_scores.extend(matched)

    except Exception as e:
        print(f"  ❌ {industry['name']} failed: {e}")
        results.append({"industry_id": industry_id, "success": 0, "total": len(brands), "error": str(e)})

    # Rate limit delay
    if i < len(INDUSTRIES) - 1:
        time.sleep(DELAY_BETWEEN_INDUSTRIES)

# %% [markdown]
# ## Cell 7: Summary & Write Pipeline Run

# %%
total_time_ms = int((time.time() - start_time) * 1000)
successful = sum(r["success"] for r in results)
failed = [r for r in results if r.get("error")]
avg_score = round(sum(s["score"] for s in all_scores) / len(all_scores)) if all_scores else 0

# Write pipeline run summary
if successful > 0:
    write_pipeline_run(
        run_id=run_id, run_date=run_date, provider=PROVIDER, model=PRIMARY_MODEL,
        total_industries=len(INDUSTRIES), total_brands=total_brands,
        successful_brands=successful, average_score=avg_score,
        execution_time_ms=total_time_ms,
        status="partial" if failed else "success",
    )
    print(f"💾 Pipeline run recorded")

print(f"\n📊 Pipeline Summary")
print("=" * 30)
print(f"Industries: {len(INDUSTRIES) - len(failed)}/{len(INDUSTRIES)}")
print(f"Brands:     {successful}/{total_brands}")
print(f"Avg Score:  {avg_score}/100")
print(f"Time:       {total_time_ms / 1000:.0f}s")

if failed:
    print(f"\n⚠️ Failed: {', '.join(r['industry_id'] for r in failed)}")

if all_scores:
    top = sorted(all_scores, key=lambda s: s["score"], reverse=True)[:10]
    print(f"\n🏆 Top 10 Brands:")
    for i, s in enumerate(top):
        print(f"  {i+1}. {s['brand']} — {s['score']}/100")

print("\n✅ Pipeline complete!")

# %% [markdown]
# ## Cell 8: Quick Verification Query

# %%
verify_df = bq_client.query(f"""
    SELECT brand, score, recommendation, sentiment, prominence, accuracy, industry_id
    FROM `{BQ_FULL}.brand_scores`
    WHERE run_date = '{run_date}' AND run_id = '{run_id}'
    ORDER BY score DESC
    LIMIT 20
""").to_dataframe()

print(f"📊 Top 20 brands scored today ({run_date}):")
verify_df
