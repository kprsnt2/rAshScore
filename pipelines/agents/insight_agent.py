"""
Insight Agent — Post-scoring narrative synthesis

Generates a brief summary of the scoring run for logging/debugging.
This is NOT the same as run_insights.py (which does full AI-generated daily insights).
This agent produces a quick analytical summary returned to the orchestrator.
"""

from __future__ import annotations


def generate_insights(scores: list[dict], category: str) -> dict:
    """
    Analyze validated scores and produce a structured summary.
    Returns a dict with key metrics (not just a throwaway string).
    """
    print(f"      💡 [Insight Agent] Synthesizing results for {category}...")

    if not scores:
        return {
            "category": category,
            "summary": f"No scores available for {category}.",
            "top_brands": [],
            "avg_score": 0,
            "score_spread": 0,
            "anomaly_count": 0,
        }

    sorted_scores = sorted(scores, key=lambda x: x.get("score", 0), reverse=True)
    all_totals = [s.get("score", 0) for s in scores]
    avg = sum(all_totals) / len(all_totals)
    spread = max(all_totals) - min(all_totals)

    top_3 = sorted_scores[:3]
    bottom_3 = sorted_scores[-3:]

    # Detect clustering (many brands with similar scores = lazy AI)
    unique_scores = len(set(all_totals))
    clustering_warning = unique_scores < len(all_totals) * 0.4

    summary_parts = [
        f"📊 {category}: {len(scores)} brands scored, avg {avg:.0f}/100, spread {spread} pts.",
        f"🏆 Leaders: {', '.join(f'{b['brand']} ({b['score']})' for b in top_3)}.",
        f"📉 Trailing: {', '.join(f'{b['brand']} ({b['score']})' for b in bottom_3)}.",
    ]
    if clustering_warning:
        summary_parts.append(
            f"⚠️  Score clustering detected: only {unique_scores} unique scores across {len(all_totals)} brands."
        )

    summary = " ".join(summary_parts)
    print(f"      {summary_parts[0]}")

    return {
        "category": category,
        "summary": summary,
        "top_brands": [b["brand"] for b in top_3],
        "avg_score": round(avg),
        "score_spread": spread,
        "anomaly_count": 1 if clustering_warning else 0,
        "clustering_warning": clustering_warning,
    }
