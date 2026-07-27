"""
Validation Agent — Score quality control

Validates scored brands by:
1. Clamping weighted breakdowns to valid ranges (uses scoring.validate_scores)
2. Recalculating totals from breakdown (prevents total != sum)
3. Detecting anomalies: wild score swings, all-identical scores, perfect scores
4. Flagging brands with suspiciously high or low scores
"""

from __future__ import annotations
from scoring import validate_scores, compute_total, WEIGHTS
from config import SCORE_BOUNDS, MAX_TOTAL_SCORE


def validate_and_normalize(scores: list[dict]) -> list[dict]:
    """
    Validate and normalize all scored brands.
    Operates on post-weightage scores (breakdown: 0-40, 0-30, 0-20, 0-10).
    """
    print(f"      🛡️  [Validation Agent] Validating {len(scores)} brands...")

    if not scores:
        return scores

    validated = []
    anomalies = []

    # Collect all totals for statistical outlier detection
    all_totals = [s.get("score", 0) for s in scores]
    avg_total = sum(all_totals) / len(all_totals) if all_totals else 50

    for s in scores:
        brand = s.get("brand", "Unknown")
        breakdown = s.get("breakdown", {})

        # 1. Clamp each dimension to valid weighted range
        clamped = validate_scores(breakdown)

        # 2. Recalculate total from clamped breakdown (authoritative)
        total = compute_total(clamped)

        # 3. Check for anomalies
        issues = []

        # Perfect weighted scores (should be extremely rare)
        for dim, (lo, hi) in SCORE_BOUNDS.items():
            if clamped.get(dim, 0) == hi:
                issues.append(f"perfect {dim}={hi}")
                # Cap at 95% of max
                clamped[dim] = int(hi * 0.95)

        # All dimensions identical (lazy AI response)
        vals = list(clamped.values())
        if len(set(vals)) == 1 and len(vals) > 1:
            issues.append("all dimensions identical — likely lazy response")

        # Extreme outlier: score deviates >30 points from industry average
        if abs(total - avg_total) > 30:
            issues.append(f"outlier: score {total} vs avg {avg_total:.0f}")

        # Suspiciously high total (>90 should be very rare)
        if total > 90:
            issues.append(f"suspiciously high total={total}")
            # Soft cap: reduce proportionally
            scale = 90 / total
            clamped = {k: int(round(v * scale)) for k, v in clamped.items()}

        if issues:
            anomalies.append((brand, issues))
            total = compute_total(clamped)  # Recalculate after adjustments

        validated.append({
            **s,
            "breakdown": clamped,
            "score": total,
        })

    # Print anomaly summary
    if anomalies:
        print(f"      ⚠️  [Validation] {len(anomalies)} anomalies detected:")
        for brand, issues in anomalies[:5]:
            print(f"         • {brand}: {', '.join(issues)}")
        if len(anomalies) > 5:
            print(f"         ... and {len(anomalies) - 5} more")
    else:
        print(f"      ✅ [Validation] All {len(validated)} brands passed checks")

    return validated
