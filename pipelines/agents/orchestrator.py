"""
Orchestrator
Manages the workflow between Research -> Scoring -> Validation -> Insight agents.
"""
from .research_agent import run_research
from .scoring_agent import run_scoring
from .validation_agent import validate_and_normalize
from .insight_agent import generate_insights
from prompts import parse_batch_response
from scoring import fuzzy_match_brand

def run_agentic_pipeline(
    industry: dict,
    provider_name: str,
    provider_cfg: dict,
    call_model_fn
) -> dict:
    """
    Runs the agentic workflow for a single industry.
    Returns parsed and validated scores.
    """
    category = industry["category"]
    brands = industry["top_brands"]
    
    # 1. Research Agent
    brands_with_context = []
    for brand in brands:
        context_data = run_research(brand, category)
        brands_with_context.append(context_data)
        
    # 2. Scoring Agent
    text, model_used = run_scoring(
        brands_with_context, category, call_model_fn, provider_name, provider_cfg
    )
    
    # Parse the JSON response
    scores = parse_batch_response(text)
    
    # Fuzzy match brand names
    matched_scores = []
    for s in scores:
        matched = fuzzy_match_brand(s["brand"], brands)
        if matched:
            s["brand"] = matched
            matched_scores.append(s)
            
    # 3. Validation Agent
    validated_scores = validate_and_normalize(matched_scores)
    
    # 4. Insight Agent (Generates quick synthesis, though we have a separate insight script)
    insight_summary = generate_insights(validated_scores, category)
    print(f"      📝 [Agentic Workflow] Summary: {insight_summary}")
    
    return {
        "model_used": model_used,
        "scores": validated_scores
    }
