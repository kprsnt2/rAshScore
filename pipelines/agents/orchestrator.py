"""
Orchestrator — Agentic Pipeline Workflow Manager

Manages the 4-agent workflow:
  1. Research Agent  → LLM call to gather brand context (real, not mocked)
  2. Scoring Agent   → Context-enriched LLM scoring (includes full SCORING_GUIDELINES)
  3. Validation Agent → Clamps ranges, detects outliers, caps suspicious scores
  4. Insight Agent   → Produces structured summary with analytics

Key improvements over v1:
  - Research uses an actual LLM call (not hardcoded strings)
  - Scoring prompt includes SCORING_GUIDELINES + SOCIAL_MEDIA_RESEARCH
  - Validation uses scoring.validate_scores() and detects anomalies
  - Error handling with fallback to simple mode on research failure
  - Insight summary is returned (not discarded)
"""

from __future__ import annotations
import time

from .research_agent import build_research_prompt, parse_research_response
from .scoring_agent import run_scoring
from .validation_agent import validate_and_normalize
from .insight_agent import generate_insights
from prompts import parse_batch_response
from scoring import fuzzy_match_brand


def run_agentic_pipeline(
    industry: dict,
    provider_name: str,
    provider_cfg: dict,
    call_model_fn,
) -> dict:
    """
    Run the full agentic workflow for a single industry.

    Args:
        industry: Industry dict with id, name, category, top_brands
        provider_name: AI provider key (e.g. "gemini")
        provider_cfg: Provider config dict from config.PROVIDERS
        call_model_fn: Function(prompt, provider_name, provider_cfg) -> (text, model)

    Returns:
        dict with "model_used", "scores", and "insight" keys.
    """
    category = industry["category"]
    brands = industry["top_brands"]
    industry_name = industry["name"]

    print(f"    🤖 [Agentic] Starting 4-agent workflow for {industry_name}...")
    workflow_start = time.time()

    # ── Step 1: Research Agent ────────────────────────────────────────────
    print(f"    📡 [Step 1/4] Research Agent — gathering brand intelligence...")
    try:
        research_prompt = build_research_prompt(brands, category)
        research_text, _ = call_model_fn(research_prompt, provider_name, provider_cfg)
        brands_with_context = parse_research_response(research_text, brands)
        print(f"    ✅ [Step 1/4] Research complete — {len(brands_with_context)} brands contextualized")
    except Exception as e:
        print(f"    ⚠️  [Step 1/4] Research failed ({e}). Proceeding with empty context.")
        brands_with_context = [
            {
                "brand": b,
                "context": f"No specific recent intelligence available for {b}.",
                "sentiment_signal": "neutral",
                "market_trend": "stable",
            }
            for b in brands
        ]

    # ── Step 2: Scoring Agent ────────────────────────────────────────────
    print(f"    🧠 [Step 2/4] Scoring Agent — evaluating {len(brands)} brands...")
    text, model_used = run_scoring(
        brands_with_context, category, call_model_fn, provider_name, provider_cfg
    )

    # Parse the JSON response (applies weightage: 0-100 → 0-40/30/20/10)
    scores = parse_batch_response(text)

    if not scores:
        print(f"    ❌ [Step 2/4] Scoring failed — could not parse LLM response")
        return {"model_used": model_used, "scores": [], "insight": None}

    # Fuzzy-match parsed brand names to expected list
    matched_scores = []
    for s in scores:
        matched = fuzzy_match_brand(s["brand"], brands)
        if matched:
            s["brand"] = matched
            matched_scores.append(s)

    print(f"    ✅ [Step 2/4] Scored {len(matched_scores)}/{len(brands)} brands matched")

    # ── Step 3: Validation Agent ─────────────────────────────────────────
    print(f"    🛡️  [Step 3/4] Validation Agent — quality control...")
    validated_scores = validate_and_normalize(matched_scores)

    # ── Step 4: Insight Agent ────────────────────────────────────────────
    print(f"    💡 [Step 4/4] Insight Agent — synthesizing results...")
    insight = generate_insights(validated_scores, category)

    elapsed = time.time() - workflow_start
    print(f"    🏁 [Agentic] Workflow complete in {elapsed:.1f}s — "
          f"{len(validated_scores)} brands, avg score {insight.get('avg_score', 0)}/100")

    return {
        "model_used": model_used,
        "scores": validated_scores,
        "insight": insight,
    }
