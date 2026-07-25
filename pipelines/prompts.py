"""
rAsh Score v2.0 — Prompt Templates & Response Parsing

Scoring approach (v2):
  AI rates each dimension 0-100, we apply weights:
    recommendation: raw/100 × 40 → 0-40
    sentiment:      raw/100 × 30 → 0-30
    prominence:     raw/100 × 20 → 0-20
    accuracy:       raw/100 × 10 → 0-10
  Total = sum of weighted scores → 0-100
"""

from __future__ import annotations
import json
import re
from config import SCORE_BOUNDS, MAX_TOTAL_SCORE
from scoring import apply_weightage


# ─── Scoring Guidelines (all dimensions 0-100) ──────────────────────────────

SCORING_GUIDELINES = """STRICT Scoring guidelines — ALL scores are 0 to 100. Be honest and critical:

- recommendation (0-100): How likely is this brand to be recommended by AI assistants?
    90-100=undisputed category leader globally, 70-89=strong recommend, 40-69=average/neutral, 15-39=concerns exist, 0-14=actively avoid

- sentiment (0-100): Overall public and social media sentiment towards this brand?
    90-100=universally loved, 60-89=mostly positive, 30-59=mixed reviews, 10-29=mostly negative, 0-9=PR crisis / scandals

- prominence (0-100): How well-known and visible is this brand?
    90-100=global household name, 65-89=well-known nationally, 35-64=known in industry, 10-34=niche/emerging, 0-9=unknown

- accuracy (0-100): How much verified data do you have about this brand?
    90-100=extensive verified data, 50-89=moderate data, 20-49=limited info, 0-19=almost no data

IMPORTANT scoring rules:
- Most brands should score 40-70 on each dimension. Only truly exceptional global brands score 80+.
- A score of 90+ on any dimension should be EXTREMELY rare.
- If you are unsure about a brand, score accuracy LOW (0-30) and be conservative on other metrics.
- NEVER give a perfect 100 on any dimension. No brand is flawless."""

SOCIAL_MEDIA_RESEARCH = """SOCIAL MEDIA & FORUM RESEARCH:
Before scoring, research and consider the brand's recent presence and sentiment on:
- Reddit (subreddit mentions, reviews, complaints)
- X / Twitter (trending topics, brand mentions, customer complaints)
- Threads (recent discussions)
- TikTok (brand mentions, viral content, reviews)
- Quora (questions and answers about the brand)
- Facebook (page engagement, community sentiment)
- Instagram (brand presence, influencer mentions)
- News articles and press coverage

Factor in:
- Recent controversies, scandals, or PR issues (last 24 hours to last week)
- Customer complaints trending on social media
- Viral positive or negative content
- Recent product launches, recalls, or service outages
- Community sentiment shifts

This social research MUST influence your scores — especially sentiment and recommendation."""


# ─── Batch Industry Prompt ───────────────────────────────────────────────────

def generate_batch_prompt(brands: list[str], category: str) -> str:
    """Generate a single prompt that scores ALL brands in an industry.
    Each dimension is scored 0-100, then we apply weightage post-response."""
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


# ─── Insight Prompts ─────────────────────────────────────────────────────────

def build_first_time_insight_prompt(
    industry_name: str,
    day1: dict,
    day2: dict,
) -> str:
    """Build insight prompt when no prior insight exists (uses 2 snapshots)."""

    def fmt(snap: dict) -> str:
        brands = snap.get("brands", [])[:10]
        return "\n".join(f"  {i+1}. {b['brand']}: {b['score']}/100" for i, b in enumerate(brands))

    return f"""You are an AI brand intelligence analyst covering India's top brands.

Analyze the AI visibility data below for the {industry_name} industry across two days and generate exactly 4–5 bullet-point insights.

Day 1 ({day1['run_date']}) – Industry avg: {day1['avg_score']}
{fmt(day1)}

Day 2 ({day2['run_date']}) – Industry avg: {day2['avg_score']}
{fmt(day2)}

Rules:
- Write exactly 4–5 bullet points
- Each bullet MUST start with a relevant emoji (📈 📉 🏆 🔄 ⚠️ 🚀 💡 🎯 etc.)
- Be specific: mention brand names and actual scores/ranks
- Note who is leading, who moved up/down, and any notable trends
- Keep each bullet to 1–2 concise sentences
- Do NOT include headers, markdown bold/italic, or any text outside the bullets
- Output ONLY the bullet list, nothing else"""


def build_update_insight_prompt(
    industry_name: str,
    prev_insight: str,
    prev_date: str,
    today: dict,
) -> str:
    """Build insight prompt with yesterday's context for continuity."""
    top_brands = today.get("brands", [])[:10]
    brands_text = "\n".join(
        f"  {i+1}. {b['brand']}: {b['score']}/100"
        + (f" (score {b['score_change']:+d})" if b.get("score_change") else "")
        + (f", rank {'▲' if b.get('rank_change', 0) > 0 else '▼'}{abs(b['rank_change'])}" if b.get("rank_change") else "")
        for i, b in enumerate(top_brands)
    )

    return f"""You are an AI brand intelligence analyst covering India's top brands.

Here is yesterday's insight ({prev_date}) for the {industry_name} industry:
{prev_insight}

Today's new data ({today['run_date']}) – Industry avg: {today['avg_score']}:
{brands_text}

Generate exactly 4–5 updated bullet-point insights reflecting what changed today compared to yesterday.

Rules:
- Write exactly 4–5 bullet points
- Each bullet MUST start with a relevant emoji (📈 📉 🏆 🔄 ⚠️ 🚀 💡 🎯 etc.)
- Be specific: mention brand names, scores, and rank movements
- Focus on changes: who moved up, who dropped, new leaders, surprising shifts
- Keep each bullet to 1–2 concise sentences
- Do NOT include headers, markdown bold/italic, or any text outside the bullets
- Output ONLY the bullet list, nothing else"""


# ─── Response Parsing ────────────────────────────────────────────────────────

def _clamp(value: float, low: int, high: int) -> int:
    """Clamp a value to integer within [low, high]."""
    return max(low, min(high, int(round(value))))


def _extract_json(text: str) -> str:
    """Strip markdown code fences from AI response text."""
    s = text.strip()
    if s.startswith("```json"):
        s = s[7:]
    elif s.startswith("```"):
        s = s[3:]
    if s.endswith("```"):
        s = s[:-3]
    return s.strip()


def parse_batch_response(text: str) -> list[dict]:
    """
    Parse a batch industry scoring response from an AI model.
    AI gives 0-100 per dimension → we apply weightage → final breakdown.
    Returns list of dicts: [{brand, score, breakdown: {recommendation, sentiment, prominence, accuracy}}]
    """
    try:
        json_str = _extract_json(text)
        parsed = json.loads(json_str)

        brands_list = parsed.get("brands", parsed)
        if not isinstance(brands_list, list):
            return []

        results = []
        for b in brands_list:
            brand_name = str(b.get("brand") or b.get("name") or "").strip()
            if not brand_name:
                continue

            breakdown_raw = b.get("breakdown") or b.get("scores") or {}

            # AI gives 0-100 for each dimension → apply weightage
            raw_scores = {
                "recommendation": float(breakdown_raw.get("recommendation", 0)),
                "sentiment": float(breakdown_raw.get("sentiment", 0)),
                "prominence": float(breakdown_raw.get("prominence", 0)),
                "accuracy": float(breakdown_raw.get("accuracy", 0)),
            }

            # Apply weightage: raw (0-100) → weighted (0-40, 0-30, 0-20, 0-10)
            weighted = apply_weightage(raw_scores)

            total = min(MAX_TOTAL_SCORE, sum(weighted.values()))

            results.append({
                "brand": brand_name,
                "score": total,
                "breakdown": weighted,
                "raw_scores": raw_scores,  # keep raw for debugging
            })

        return results

    except (json.JSONDecodeError, ValueError, TypeError) as e:
        print(f"  ⚠ Failed to parse batch response: {e}")
        return []
