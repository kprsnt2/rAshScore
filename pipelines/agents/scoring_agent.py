"""
Scoring Agent
Uses the research context to score brands with high accuracy.
"""
import json
import time

# We reuse the provider calling logic from run_pipeline
def run_scoring(
    brands_with_context: list[dict],
    category: str,
    call_model_fn,
    provider_name: str,
    provider_cfg: dict
) -> list[dict]:
    """
    Takes research context for each brand and asks the LLM to score them.
    """
    print(f"      🧠 [Scoring Agent] Evaluating {len(brands_with_context)} brands using context...")
    
    # Build a context-aware prompt
    context_blocks = "\n".join(
        f"Brand: {b['brand']}\nResearch Context: {b['context']}\n"
        for b in brands_with_context
    )
    
    brand_names = [b["brand"] for b in brands_with_context]
    brand_list_str = "\n".join(f"{i+1}. {b}" for i, b in enumerate(brand_names))
    
    prompt = f"""You are an expert brand intelligence analyst. Score these {len(brand_names)} brands in the {category} industry.
    
We have conducted recent social media and news research for you. Use this context to inform your scores:

RESEARCH CONTEXT:
{context_blocks}

Based on this context and your internal knowledge, score EACH dimension on a scale of 0 to 100.
- recommendation: 0-100
- sentiment: 0-100
- prominence: 0-100
- accuracy: 0-100

Respond ONLY with valid JSON:
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
"""
    
    text, model_used = call_model_fn(prompt, provider_name, provider_cfg)
    return text, model_used
