"""
Scoring Agent — Context-aware brand scoring

Takes research context and generates a scoring prompt that includes:
1. The full SCORING_GUIDELINES from prompts.py (critical — was missing before)
2. The SOCIAL_MEDIA_RESEARCH instructions
3. The per-brand research context from the Research Agent
4. Proper JSON output format

This produces better scores than simple mode because the model has
brand-specific context to reason about.
"""

from __future__ import annotations
from prompts import SCORING_GUIDELINES, SOCIAL_MEDIA_RESEARCH


def build_scoring_prompt(
    brands_with_context: list[dict],
    category: str,
) -> str:
    """
    Build a context-enriched scoring prompt.
    Returns the prompt string (caller is responsible for LLM call).
    """
    brand_names = [b["brand"] for b in brands_with_context]

    # Build per-brand context blocks
    context_section = "\n".join(
        f"### {b['brand']}\n"
        f"  Context: {b['context']}\n"
        f"  Sentiment signal: {b.get('sentiment_signal', 'neutral')}\n"
        f"  Market trend: {b.get('market_trend', 'stable')}\n"
        for b in brands_with_context
    )

    brand_list = "\n".join(f"{i+1}. {b}" for i, b in enumerate(brand_names))

    return f"""You are an expert brand intelligence analyst. Score these {len(brand_names)} brands in the Indian {category} industry for AI visibility.

{SOCIAL_MEDIA_RESEARCH}

## Pre-collected Research Intelligence
We have already gathered the following context for each brand. Use this to inform your scores:

{context_section}

## Brands to Score
{brand_list}

Score EACH dimension on a scale of 0 to 100.

Respond ONLY with valid JSON (no markdown, no explanation):
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

{SCORING_GUIDELINES}

Score ALL {len(brand_names)} brands. Use the research context above to be more accurate."""


def run_scoring(
    brands_with_context: list[dict],
    category: str,
    call_model_fn,
    provider_name: str,
    provider_cfg: dict,
) -> tuple[str, str]:
    """
    Build the scoring prompt, call the model, and return raw text + model name.
    Returns (response_text, model_used).
    """
    print(f"      🧠 [Scoring Agent] Evaluating {len(brands_with_context)} brands with research context...")

    prompt = build_scoring_prompt(brands_with_context, category)
    text, model_used = call_model_fn(prompt, provider_name, provider_cfg)
    return text, model_used
