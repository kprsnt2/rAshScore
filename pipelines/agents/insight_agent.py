"""
Insight Agent
Generates narrative insights based on the validated scores.
"""

def generate_insights(scores: list[dict], category: str) -> str:
    """
    Generates a quick narrative summary of the scoring run.
    """
    print(f"      💡 [Insight Agent] Synthesizing results...")
    
    top_brands = sorted(scores, key=lambda x: x["score"], reverse=True)[:3]
    top_names = [b["brand"] for b in top_brands]
    
    return f"Leaders in {category} are {', '.join(top_names)}."
