"""
Research Agent
Finds recent news and social sentiment about a brand.
"""
import time

def run_research(brand: str, category: str) -> dict:
    """
    Simulates researching a brand on social media and news.
    In a full production environment, this would call SerpAPI, Reddit API, etc.
    """
    print(f"      🔍 [Research Agent] Researching {brand}...")
    
    # Simulated API delay
    time.sleep(0.2)
    
    # Generate mock context (would be replaced by actual search results)
    context = (
        f"Recent mentions for {brand} in {category} show steady engagement. "
        f"Customer sentiment on Reddit is mostly neutral to positive. "
        f"No major PR crises in the last 24 hours. "
        f"Brand visibility remains stable among competitors."
    )
    
    return {
        "brand": brand,
        "context": context,
        "sentiment_signal": "neutral-positive",
        "recent_news": "No major breaking news."
    }
