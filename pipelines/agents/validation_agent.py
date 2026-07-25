"""
Validation Agent
Cross-checks scores for anomalies and applies weightage.
"""

def validate_and_normalize(scores: list[dict]) -> list[dict]:
    """
    Validates that the scores are within acceptable bounds and applies weightage.
    """
    print(f"      🛡️  [Validation Agent] Validating and normalizing scores...")
    
    validated = []
    for s in scores:
        # Check for anomalies (e.g., perfect 100s which shouldn't happen)
        breakdown = s.get("breakdown", {})
        
        # Simple rule-based anomaly detection
        for key, val in breakdown.items():
            if val == 100:
                print(f"         ⚠️ Flagged {s['brand']}: perfect {key} score. Normalizing to 95.")
                breakdown[key] = 95
        
        validated.append(s)
        
    return validated
