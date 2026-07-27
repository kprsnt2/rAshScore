"""
Tavily AI Search — Real-time brand intelligence tool

Uses Tavily's AI search API to find recent news, reviews, and social
sentiment for brands. This replaces the LLM-only research approach
with verified, sourced web data.

Pricing: $0.001/search, free tier = 1000 searches/month
Signup:  https://tavily.com

Env:     TAVILY_API_KEY
"""

from __future__ import annotations
import os
import requests
from typing import Optional


TAVILY_API_URL = "https://api.tavily.com/search"


def _get_api_key() -> Optional[str]:
    return os.environ.get("TAVILY_API_KEY")


def search_brand(brand: str, category: str) -> dict:
    """
    Search for recent brand intelligence using Tavily AI Search.

    Returns:
        {
            "brand": str,
            "answer": str,           # AI-synthesized summary
            "sources": [str],        # Source URLs
            "snippets": [str],       # Content excerpts
            "sentiment_hints": str,  # Extracted sentiment signal
        }
    """
    api_key = _get_api_key()
    if not api_key:
        return _fallback(brand, "TAVILY_API_KEY not set")

    try:
        resp = requests.post(
            TAVILY_API_URL,
            json={
                "api_key": api_key,
                "query": f"{brand} {category} India latest news reviews sentiment 2026",
                "search_depth": "basic",
                "max_results": 5,
                "include_answer": True,
                "include_raw_content": False,
            },
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()

        answer = data.get("answer", "")
        results = data.get("results", [])

        # Extract source URLs and content snippets
        sources = [r.get("url", "") for r in results[:3] if r.get("url")]
        snippets = [r.get("content", "")[:250] for r in results[:5] if r.get("content")]

        # Simple sentiment detection from the answer
        sentiment_hints = _detect_sentiment(answer + " ".join(snippets))

        return {
            "brand": brand,
            "answer": answer[:500] if answer else "No summary available.",
            "sources": sources,
            "snippets": snippets,
            "sentiment_hints": sentiment_hints,
        }

    except requests.exceptions.Timeout:
        return _fallback(brand, "Tavily request timed out")
    except requests.exceptions.HTTPError as e:
        return _fallback(brand, f"Tavily HTTP error: {e.response.status_code}")
    except Exception as e:
        return _fallback(brand, f"Tavily error: {str(e)[:100]}")


def search_brand_batch(brands: list[str], category: str) -> list[dict]:
    """
    Search for multiple brands. Returns results in same order as input.
    Handles failures gracefully — a single brand failure doesn't crash the batch.
    """
    results = []
    for brand in brands:
        result = search_brand(brand, category)
        results.append(result)
    return results


def _detect_sentiment(text: str) -> str:
    """Quick keyword-based sentiment signal from search results."""
    text_lower = text.lower()
    negative_signals = [
        "controversy", "scandal", "lawsuit", "fraud", "layoff", "shutdown",
        "complaint", "crisis", "failure", "scam", "data breach", "recall",
        "accused", "boycott", "bankrupt", "crash", "loss", "decline",
    ]
    positive_signals = [
        "growth", "launch", "award", "partnership", "expansion", "record",
        "innovation", "popular", "success", "milestone", "profit", "revenue",
        "praised", "leading", "top", "best", "winner", "exceeded",
    ]

    neg_count = sum(1 for w in negative_signals if w in text_lower)
    pos_count = sum(1 for w in positive_signals if w in text_lower)

    if neg_count > pos_count + 1:
        return "negative"
    elif pos_count > neg_count + 1:
        return "positive"
    elif neg_count > 0 and pos_count > 0:
        return "mixed"
    else:
        return "neutral"


def _fallback(brand: str, reason: str) -> dict:
    """Return an empty-but-valid result when Tavily is unavailable."""
    return {
        "brand": brand,
        "answer": f"No live search data ({reason}).",
        "sources": [],
        "snippets": [],
        "sentiment_hints": "neutral",
    }


def is_available() -> bool:
    """Check if Tavily API key is configured."""
    return bool(_get_api_key())
