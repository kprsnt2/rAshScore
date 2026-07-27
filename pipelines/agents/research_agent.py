"""
Research Agent — Pre-scoring intelligence gathering

Uses an LLM call to gather real-time brand context before scoring.
This replaces the mock implementation with actual AI-powered research
that leverages the model's training data and knowledge cutoff.

The research output is injected into the scoring prompt so the Scoring Agent
has fresh context to work with (controversies, launches, sentiment shifts).
"""

from __future__ import annotations


def build_research_prompt(brands: list[str], category: str) -> str:
    """Build the research prompt for an industry's brands."""
    brand_list = "\n".join(f"- {b}" for b in brands)

    return f"""You are a brand intelligence researcher. For each brand below in the Indian {category} industry,
provide a brief research summary covering:

1. **Recent news** (last 1-2 weeks): product launches, partnerships, controversies, PR crises
2. **Social sentiment**: Are people talking positively or negatively about this brand on Reddit, Twitter/X, etc.?
3. **Market position**: Is this brand gaining or losing ground vs competitors?

Brands:
{brand_list}

Respond with valid JSON only:
{{
  "research": [
    {{
      "brand": "Brand Name",
      "recent_news": "Brief summary of recent events",
      "sentiment": "positive|neutral|negative|mixed",
      "market_trend": "growing|stable|declining",
      "key_issues": "Any controversies or notable events, or 'none'"
    }}
  ]
}}

Be factual. If you don't have recent data on a brand, say so honestly.
Respond ONLY with the JSON, no markdown fences, no explanation."""


def parse_research_response(text: str, brands: list[str]) -> list[dict]:
    """Parse the research JSON. Falls back to empty context on failure."""
    import json

    try:
        clean = text.strip()
        if clean.startswith("```json"):
            clean = clean[7:]
        elif clean.startswith("```"):
            clean = clean[3:]
        if clean.endswith("```"):
            clean = clean[:-3]

        data = json.loads(clean.strip())
        research_list = data.get("research", data)
        if not isinstance(research_list, list):
            return _empty_research(brands)

        # Index by brand name (case-insensitive)
        lookup = {}
        for r in research_list:
            name = str(r.get("brand", "")).strip().lower()
            if name:
                lookup[name] = r

        results = []
        for brand in brands:
            match = lookup.get(brand.lower())
            if match:
                results.append({
                    "brand": brand,
                    "context": _format_context(match),
                    "sentiment_signal": match.get("sentiment", "neutral"),
                    "market_trend": match.get("market_trend", "stable"),
                })
            else:
                results.append({
                    "brand": brand,
                    "context": f"No specific recent intelligence available for {brand}.",
                    "sentiment_signal": "neutral",
                    "market_trend": "stable",
                })

        return results

    except (json.JSONDecodeError, ValueError, TypeError) as e:
        print(f"      ⚠ Research parse failed: {e}. Using empty context.")
        return _empty_research(brands)


def _format_context(research: dict) -> str:
    """Format a research entry into a text block for the scoring prompt."""
    parts = []
    news = research.get("recent_news", "")
    if news and news.lower() != "none":
        parts.append(f"Recent: {news}")
    sentiment = research.get("sentiment", "neutral")
    parts.append(f"Sentiment: {sentiment}")
    trend = research.get("market_trend", "stable")
    parts.append(f"Trend: {trend}")
    issues = research.get("key_issues", "")
    if issues and issues.lower() != "none":
        parts.append(f"Issues: {issues}")
    return " | ".join(parts) if parts else "No specific context."


def _empty_research(brands: list[str]) -> list[dict]:
    """Return empty research context for all brands."""
    return [
        {
            "brand": b,
            "context": f"No specific recent intelligence available for {b}.",
            "sentiment_signal": "neutral",
            "market_trend": "stable",
        }
        for b in brands
    ]
