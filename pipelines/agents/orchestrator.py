"""
Orchestrator — Agentic Pipeline Workflow Manager

Manages the multi-agent workflow with 3 modes:
  --mode=simple        → Direct LLM scoring (1 call, no agents)
  --mode=agentic       → LLM-only research + context-enriched scoring (2 LLM calls)
  --mode=agentic-live  → Tavily web search + LLM synthesis + scoring (1 Tavily + 2 LLM calls)

Agent workflow:
  1. Research Agent  → Gather brand context (LLM-only or Tavily-enriched)
  2. Scoring Agent   → Context-enriched scoring with full SCORING_GUIDELINES
  3. Validation Agent → Clamp ranges, detect outliers, cap suspicious scores
  4. Insight Agent   → Produce structured analytics summary
"""

from __future__ import annotations
import time

from .research_agent import (
    build_research_prompt,
    build_tavily_enriched_prompt,
    run_tavily_search,
    parse_research_response,
)
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
    live: bool = False,
    tracer=None,
) -> dict:
    """
    Run the full agentic workflow for a single industry.

    Args:
        industry: Industry dict with id, name, category, top_brands
        provider_name: AI provider key (e.g. "gemini")
        provider_cfg: Provider config dict from config.PROVIDERS
        call_model_fn: Function(prompt, provider_name, provider_cfg) -> (text, model)
        live: If True, use Tavily web search for real-time research
        tracer: Optional PipelineTracer for observability

    Returns:
        dict with "model_used", "scores", and "insight" keys.
    """
    category = industry["category"]
    brands = industry["top_brands"]
    industry_name = industry["name"]
    mode_label = "AGENTIC-LIVE" if live else "AGENTIC"

    print(f"    🤖 [{mode_label}] Starting 4-agent workflow for {industry_name}...")
    workflow_start = time.time()

    # ── Step 1: Research Agent ────────────────────────────────────────────
    step_label = "Step 1/4"
    research_mode = "Tavily + LLM" if live else "LLM-only"
    print(f"    📡 [{step_label}] Research Agent ({research_mode})...")

    try:
        if live:
            # Tavily mode: 1 web search per industry, then LLM synthesis
            if tracer:
                span = tracer.span("research-tavily", {"industry": industry["id"]})
                span.__enter__()

            tavily_results = run_tavily_search(brands, category)
            has_tavily_data = bool(tavily_results.get("answer"))

            if has_tavily_data:
                research_prompt = build_tavily_enriched_prompt(brands, category, tavily_results)
                print(f"      🌐 Tavily returned {len(tavily_results.get('sources', []))} sources")
            else:
                print(f"      ⚠️  Tavily returned no data. Falling back to LLM-only research.")
                research_prompt = build_research_prompt(brands, category)

            if tracer:
                span.__exit__(None, None, None)
        else:
            # LLM-only research
            research_prompt = build_research_prompt(brands, category)

        if tracer:
            span = tracer.span("research-llm", {"industry": industry["id"]})
            span.__enter__()

        research_text, _ = call_model_fn(research_prompt, provider_name, provider_cfg)
        brands_with_context = parse_research_response(research_text, brands)

        if tracer:
            span.__exit__(None, None, None)

        print(f"    ✅ [{step_label}] Research complete — {len(brands_with_context)} brands contextualized")

    except Exception as e:
        if tracer:
            tracer.record_error("research", industry["id"], str(e))
        print(f"    ⚠️  [{step_label}] Research failed ({e}). Proceeding with empty context.")
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
    step_label = "Step 2/4"
    print(f"    🧠 [{step_label}] Scoring Agent — evaluating {len(brands)} brands...")

    if tracer:
        span = tracer.span("scoring", {"industry": industry["id"]})
        span.__enter__()

    text, model_used = run_scoring(
        brands_with_context, category, call_model_fn, provider_name, provider_cfg
    )

    if tracer:
        span.__exit__(None, None, None)

    # Parse the JSON response (applies weightage: 0-100 → 0-40/30/20/10)
    scores = parse_batch_response(text)

    if not scores:
        print(f"    ❌ [{step_label}] Scoring failed — could not parse LLM response")
        return {"model_used": model_used, "scores": [], "insight": None}

    # Fuzzy-match parsed brand names to expected list
    matched_scores = []
    for s in scores:
        matched = fuzzy_match_brand(s["brand"], brands)
        if matched:
            s["brand"] = matched
            matched_scores.append(s)

    print(f"    ✅ [{step_label}] Scored {len(matched_scores)}/{len(brands)} brands matched")

    # ── Step 3: Validation Agent ─────────────────────────────────────────
    step_label = "Step 3/4"
    print(f"    🛡️  [{step_label}] Validation Agent — quality control...")

    if tracer:
        span = tracer.span("validation", {"industry": industry["id"]})
        span.__enter__()

    validated_scores = validate_and_normalize(matched_scores)

    if tracer:
        span.__exit__(None, None, None)

    # ── Step 4: Insight Agent ────────────────────────────────────────────
    step_label = "Step 4/4"
    print(f"    💡 [{step_label}] Insight Agent — synthesizing results...")

    if tracer:
        span = tracer.span("insight", {"industry": industry["id"]})
        span.__enter__()

    insight = generate_insights(validated_scores, category)

    if tracer:
        span.__exit__(None, None, None)
        tracer.record_scores(industry["id"], validated_scores)

    elapsed = time.time() - workflow_start
    print(f"    🏁 [{mode_label}] Workflow complete in {elapsed:.1f}s — "
          f"{len(validated_scores)} brands, avg score {insight.get('avg_score', 0)}/100")

    return {
        "model_used": model_used,
        "scores": validated_scores,
        "insight": insight,
    }
