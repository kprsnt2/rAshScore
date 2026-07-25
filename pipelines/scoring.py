"""
rAsh Score v2.0 — Score Validation, Weightage & Fuzzy Brand Matching

Scoring approach:
  AI rates each dimension 0-100, we apply weights:
    recommendation: raw × 0.40 → 0-40
    sentiment:      raw × 0.30 → 0-30
    prominence:     raw × 0.20 → 0-20
    accuracy:       raw × 0.10 → 0-10
  Total = sum of weighted scores → 0-100
"""

from __future__ import annotations
from config import SCORE_BOUNDS, MAX_TOTAL_SCORE

# Weights per dimension (must sum to 1.0)
WEIGHTS = {
    "recommendation": 0.40,
    "sentiment": 0.30,
    "prominence": 0.20,
    "accuracy": 0.10,
}


def apply_weightage(raw_scores: dict) -> dict:
    """
    Convert raw 0-100 scores per dimension into weighted breakdown.
    Input:  {recommendation: 75, sentiment: 80, prominence: 60, accuracy: 90}
    Output: {recommendation: 30, sentiment: 24, prominence: 12, accuracy: 9}
    """
    weighted = {}
    for dim, weight in WEIGHTS.items():
        raw = max(0, min(100, float(raw_scores.get(dim, 0))))
        weighted[dim] = int(round(raw * weight))
    return weighted


def compute_total(breakdown: dict) -> int:
    """Sum weighted breakdown dimensions, capped at MAX_TOTAL_SCORE."""
    return min(
        MAX_TOTAL_SCORE,
        sum(breakdown.get(dim, 0) for dim in SCORE_BOUNDS),
    )


def validate_scores(breakdown: dict) -> dict:
    """Clamp all score dimensions to their valid ranges (post-weightage)."""
    return {
        dim: max(lo, min(hi, int(round(breakdown.get(dim, 0)))))
        for dim, (lo, hi) in SCORE_BOUNDS.items()
    }


def fuzzy_match_brand(parsed_name: str, expected_brands: list[str]) -> str | None:
    """
    Match a parsed brand name (from AI response) to the expected list.
    Uses case-insensitive exact match first, then substring containment.
    Returns the matched brand name from expected_brands, or None.
    """
    parsed_lower = parsed_name.strip().lower()
    if not parsed_lower:
        return None

    # 1. Exact match (case-insensitive)
    for brand in expected_brands:
        if brand.lower() == parsed_lower:
            return brand

    # 2. Parsed name contains expected brand (or vice versa)
    for brand in expected_brands:
        brand_lower = brand.lower()
        if brand_lower in parsed_lower or parsed_lower in brand_lower:
            return brand

    # 3. First-word match (e.g. "Flipkart" matches "Flipkart Group")
    parsed_first = parsed_lower.split()[0] if parsed_lower else ""
    for brand in expected_brands:
        if brand.lower().split()[0] == parsed_first:
            return brand

    return None
