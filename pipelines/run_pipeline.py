"""
rAsh Score v2.0 — Main Pipeline Runner
Queries AI models to score 285 brands across 19 industries, writes to BigQuery.

Usage:
    python run_pipeline.py --provider=gemini
    python run_pipeline.py --provider=openai
    python run_pipeline.py --provider=claude
    python run_pipeline.py --provider=grok
    python run_pipeline.py --provider=all
"""

from __future__ import annotations
import argparse
import json
import os
import sys
import time
from datetime import date, datetime

import requests
import google.auth
import google.auth.transport.requests

from config import PROVIDERS, RETRY_DELAYS, DELAY_BETWEEN_INDUSTRIES
from industry_data import get_all_industries, get_total_brand_count
from prompts import generate_batch_prompt, parse_batch_response
from scoring import fuzzy_match_brand
from bq_writer import (
    generate_run_id,
    write_pipeline_run,
    write_brand_scores,
)


# ─── AI Model Callers ────────────────────────────────────────────────────────

def _get_gcp_token() -> str:
    """Get GCP access token via Application Default Credentials."""
    creds, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
    auth_req = google.auth.transport.requests.Request()
    creds.refresh(auth_req)
    return creds.token


def call_openai(prompt: str, model: str, provider_cfg: dict) -> tuple[str, str]:
    """Call OpenAI-compatible API."""
    api_key = os.environ.get(provider_cfg["api_key_env"], "")
    if not api_key:
        raise ValueError(f"{provider_cfg['api_key_env']} not set")

    resp = requests.post(
        f"{provider_cfg['base_url']}/chat/completions",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": provider_cfg["temperature"],
            "max_completion_tokens": provider_cfg["max_tokens"],
        },
        timeout=provider_cfg["timeout"],
    )
    resp.raise_for_status()
    data = resp.json()
    text = data["choices"][0]["message"]["content"]
    return text, model


def call_gemini(prompt: str, model: str, provider_cfg: dict) -> tuple[str, str]:
    """Call Google Generative Language API."""
    api_key = os.environ.get(provider_cfg["api_key_env"], "")
    if not api_key:
        raise ValueError(f"{provider_cfg['api_key_env']} not set")

    url = f"{provider_cfg['base_url']}/{model}:generateContent?key={api_key}"
    resp = requests.post(
        url,
        headers={"Content-Type": "application/json"},
        json={
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": provider_cfg["temperature"],
                "maxOutputTokens": provider_cfg["max_tokens"],
            },
        },
        timeout=provider_cfg["timeout"],
    )
    resp.raise_for_status()
    data = resp.json()
    text = data["candidates"][0]["content"]["parts"][0]["text"]
    return text, model


def call_vertex_claude(prompt: str, model: str, provider_cfg: dict) -> tuple[str, str]:
    """Call Vertex AI Claude (rawPredict, Anthropic format, global endpoint)."""
    token = _get_gcp_token()
    project_id = os.environ.get("GCP_PROJECT_ID", "rashscore")

    url = (
        f"https://aiplatform.googleapis.com/v1/projects/{project_id}"
        f"/locations/global/publishers/anthropic/models/{model}:rawPredict"
    )
    resp = requests.post(
        url,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json={
            "anthropic_version": "vertex-2023-10-16",
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": provider_cfg["max_tokens"],
            "temperature": provider_cfg["temperature"],
        },
        timeout=provider_cfg["timeout"],
    )
    resp.raise_for_status()
    data = resp.json()
    text = data["content"][0]["text"]
    return text, model


def call_vertex_openai(prompt: str, model: str, provider_cfg: dict) -> tuple[str, str]:
    """Call Vertex AI OpenAI-compatible endpoint (Grok, etc.)."""
    token = _get_gcp_token()
    project_id = os.environ.get("GCP_PROJECT_ID", "rashscore")

    url = (
        f"https://aiplatform.googleapis.com/v1/projects/{project_id}"
        f"/locations/global/endpoints/openapi/chat/completions"
    )
    resp = requests.post(
        url,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json={
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are an expert brand intelligence analyst. "
                        "You MUST respond ONLY with the requested JSON format."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            "max_tokens": provider_cfg["max_tokens"],
            "temperature": provider_cfg["temperature"],
            "stream": False,
        },
        timeout=provider_cfg["timeout"],
    )
    resp.raise_for_status()
    data = resp.json()
    text = data["choices"][0]["message"]["content"]
    return text, model


# Dispatcher
CALLERS = {
    "openai": call_openai,
    "gemini": call_gemini,
    "vertex-claude": call_vertex_claude,
    "vertex-openai": call_vertex_openai,
}


def call_model_with_retry(
    prompt: str,
    provider_name: str,
    provider_cfg: dict,
) -> tuple[str, str]:
    """
    Call AI model with primary→backup fallback and retry logic.
    Returns (response_text, model_used).
    """
    caller = CALLERS[provider_cfg["format"]]
    models_to_try = [provider_cfg["primary"], provider_cfg["backup"]]
    # Deduplicate
    models_to_try = list(dict.fromkeys(models_to_try))

    for model in models_to_try:
        for attempt in range(len(RETRY_DELAYS) + 1):
            try:
                text, used = caller(prompt, model, provider_cfg)
                if not text.strip():
                    raise ValueError(f"{model} returned empty response")
                return text, used
            except Exception as e:
                err_msg = str(e)
                is_quota = any(k in err_msg.lower() for k in ["429", "quota", "rate"])
                print(f"    ⚠ {model} attempt {attempt+1} failed"
                      f"{' (rate-limit)' if is_quota else ''}: {err_msg[:120]}")

                if attempt < len(RETRY_DELAYS):
                    delay = RETRY_DELAYS[attempt]
                    print(f"    ⏳ Retrying in {delay}s...")
                    time.sleep(delay)

        print(f"    ❌ {model} exhausted all retries, trying backup...")

    raise RuntimeError(f"All models failed for provider {provider_name}")


# ─── Pipeline Logic ──────────────────────────────────────────────────────────

def run_industry(
    industry: dict,
    provider_name: str,
    provider_cfg: dict,
    run_id: str,
    run_date: str,
) -> dict:
    """Run pipeline for a single industry. Returns summary dict."""
    industry_id = industry["id"]
    brands = industry["top_brands"]
    category = industry["category"]

    print(f"  📋 {industry['name']} ({len(brands)} brands)...")
    start = time.time()

    try:
        prompt = generate_batch_prompt(brands, category)
        text, model_used = call_model_with_retry(prompt, provider_name, provider_cfg)

        scores = parse_batch_response(text)

        if not scores:
            print(f"    ⚠ Unparseable response from {model_used}: {text[:200]}")
            return {"industry_id": industry_id, "success": 0, "total": len(brands), "error": "unparseable"}

        # Fuzzy-match parsed brand names to expected list
        matched_scores = []
        for s in scores:
            matched = fuzzy_match_brand(s["brand"], brands)
            if matched:
                s["brand"] = matched
                matched_scores.append(s)

        elapsed_ms = int((time.time() - start) * 1000)

        # Write to BigQuery
        written = write_brand_scores(
            matched_scores, run_id, run_date,
            model=model_used, industry_id=industry_id, category=category,
        )

        print(f"  ✅ {industry['name']}: {written}/{len(brands)} brands scored in {elapsed_ms/1000:.1f}s")
        return {"industry_id": industry_id, "success": written, "total": len(brands), "scores": matched_scores}

    except Exception as e:
        elapsed_ms = int((time.time() - start) * 1000)
        print(f"  ❌ {industry['name']} failed: {e}")
        return {"industry_id": industry_id, "success": 0, "total": len(brands), "error": str(e)}


def run_pipeline(provider_name: str) -> None:
    """Run the full pipeline for a single provider."""
    if provider_name not in PROVIDERS:
        print(f"❌ Unknown provider: {provider_name}")
        print(f"   Available: {', '.join(PROVIDERS.keys())}")
        sys.exit(1)

    provider_cfg = PROVIDERS[provider_name]
    industries = get_all_industries()
    total_brands = get_total_brand_count()
    run_id = generate_run_id()
    run_date = date.today().isoformat()

    print(f"🇮🇳 rAsh Score Pipeline — {provider_name}")
    print("=" * 50)
    print(f"📊 {len(industries)} industries, {total_brands} brands")
    print(f"🎯 Provider: {provider_name} → {provider_cfg['primary']} (backup: {provider_cfg['backup']})")
    print(f"📅 Date: {run_date}")
    print(f"🔑 Run ID: {run_id[:8]}...")
    print(f"\n🚀 Starting analysis...\n")

    start_time = time.time()
    results = []
    all_scores = []

    for i, industry in enumerate(industries):
        result = run_industry(industry, provider_name, provider_cfg, run_id, run_date)
        results.append(result)
        if result.get("scores"):
            all_scores.extend(result["scores"])

        # Rate limit delay between industries
        if i < len(industries) - 1:
            time.sleep(DELAY_BETWEEN_INDUSTRIES)

    total_time_ms = int((time.time() - start_time) * 1000)

    # Summary
    successful = sum(r["success"] for r in results)
    failed_industries = [r for r in results if r.get("error")]
    avg_score = (
        round(sum(s["score"] for s in all_scores) / len(all_scores))
        if all_scores else 0
    )

    # Guard: don't record empty runs
    if successful == 0:
        print("\n⚠️ All brands failed. Not recording pipeline run.")
        sys.exit(0)

    # Write pipeline run summary
    write_pipeline_run(
        run_id=run_id,
        run_date=run_date,
        provider=provider_name,
        model=provider_cfg["primary"],
        total_industries=len(industries),
        total_brands=total_brands,
        successful_brands=successful,
        average_score=avg_score,
        execution_time_ms=total_time_ms,
        status="partial" if failed_industries else "success",
    )

    # Print summary
    print(f"\n📊 Pipeline Summary")
    print("=" * 30)
    print(f"Industries: {len(industries) - len(failed_industries)}/{len(industries)}")
    print(f"Brands: {successful}/{total_brands}")
    print(f"Average Score: {avg_score}/100")
    print(f"Time: {total_time_ms / 1000:.0f}s")

    if failed_industries:
        names = ", ".join(r["industry_id"] for r in failed_industries)
        print(f"\n⚠️ Failed: {names}")

    if all_scores:
        top = sorted(all_scores, key=lambda s: s["score"], reverse=True)[:10]
        print(f"\n🏆 Top 10 Brands:")
        for i, s in enumerate(top):
            print(f"  {i+1}. {s['brand']} — {s['score']}")

    print("\n✅ Pipeline complete!")


# ─── Entry Point ──────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="rAsh Score Pipeline Runner")
    parser.add_argument(
        "--provider",
        required=True,
        choices=["openai", "gemini", "claude", "grok", "all"],
        help="AI provider to use",
    )
    args = parser.parse_args()

    if args.provider == "all":
        for p in PROVIDERS:
            print(f"\n{'='*60}")
            print(f"  Running provider: {p}")
            print(f"{'='*60}\n")
            try:
                run_pipeline(p)
            except Exception as e:
                print(f"❌ Provider {p} failed entirely: {e}")
            time.sleep(30)  # pause between providers
    else:
        run_pipeline(args.provider)


if __name__ == "__main__":
    main()
