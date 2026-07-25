"""
rAsh Score v2.0 — Daily AI Insight Generation
Generates narrative insights per industry using latest scoring data.

Usage:
    python run_insights.py
    python run_insights.py --industry=technology
"""

from __future__ import annotations
import argparse
import os
import sys
import time
from datetime import date

import requests
import google.auth
import google.auth.transport.requests

from config import GCP_PROJECT_ID, RETRY_DELAYS
from industry_data import get_all_industries, get_industry_by_id
from prompts import build_first_time_insight_prompt, build_update_insight_prompt
from bq_writer import (
    write_insight,
    query_latest_scores,
    query_latest_insight,
    query_previous_day_scores,
)


# ─── AI Caller for Insights ──────────────────────────────────────────────────

def _get_gcp_token() -> str:
    creds, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
    auth_req = google.auth.transport.requests.Request()
    creds.refresh(auth_req)
    return creds.token


def call_vertex_gemini(prompt: str, model: str = "gemini-3.5-flash") -> tuple[str, str]:
    """Call Vertex AI Gemini for insight generation."""
    token = _get_gcp_token()
    project_id = os.environ.get("GCP_PROJECT_ID", GCP_PROJECT_ID)

    # gemini-3.5-flash uses global endpoint
    url = (
        f"https://aiplatform.googleapis.com/v1/projects/{project_id}"
        f"/locations/global/publishers/google/models/{model}:generateContent"
    )
    resp = requests.post(
        url,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json={
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.5, "maxOutputTokens": 2048},
        },
        timeout=120,
    )
    resp.raise_for_status()
    data = resp.json()
    text = data["candidates"][0]["content"]["parts"][0]["text"]
    return text, model


INSIGHT_MODEL_CHAIN = [
    ("vertex-gemini", "gemini-3.5-flash"),
    ("vertex-gemini", "gemini-2.5-flash"),
]


def generate_insight_text(prompt: str) -> tuple[str, str]:
    """Try model chain for insight generation. Returns (text, generated_by)."""
    for i, (provider, model) in enumerate(INSIGHT_MODEL_CHAIN):
        for attempt in range(len(RETRY_DELAYS) + 1):
            try:
                text, used = call_vertex_gemini(prompt, model)
                if text.strip():
                    return text.strip(), f"{provider}-{used}"
            except Exception as e:
                err_msg = str(e)[:120]
                print(f"    ⚠ {model} attempt {attempt+1} failed: {err_msg}")
                if attempt < len(RETRY_DELAYS):
                    time.sleep(RETRY_DELAYS[attempt])

    raise RuntimeError("All insight models failed")


# ─── Main Logic ──────────────────────────────────────────────────────────────

def generate_industry_insight(industry: dict) -> bool:
    """Generate and save an insight for one industry. Returns True on success."""
    industry_id = industry["id"]
    industry_name = industry["name"]
    today_str = date.today().isoformat()

    print(f"  🧠 {industry_name}...")

    try:
        # Get today's latest scores
        today_scores = query_latest_scores(industry_id)
        if not today_scores:
            print(f"    ⚠ No scores found for {industry_name}, skipping")
            return False

        today_run_date = today_scores[0].get("run_date", today_str)
        avg_score = round(sum(s["score"] for s in today_scores) / len(today_scores)) if today_scores else 0

        today_snapshot = {
            "run_date": today_run_date,
            "avg_score": avg_score,
            "brands": today_scores,
        }

        # Get previous insight for context chaining
        prev_insight = query_latest_insight(industry_id)
        prev_scores = query_previous_day_scores(industry_id, today_run_date)

        # Build prompt
        if prev_insight and prev_scores:
            prev_avg = round(sum(s["score"] for s in prev_scores) / len(prev_scores)) if prev_scores else 0

            # Compute deltas
            prev_map = {s["brand"]: s for s in prev_scores}
            for s in today_scores:
                prev = prev_map.get(s["brand"])
                if prev:
                    s["score_change"] = s["score"] - prev["score"]
                    s["rank_change"] = prev["rank"] - s["rank"]  # positive = moved up

            prompt = build_update_insight_prompt(
                industry_name,
                prev_insight["insight_text"],
                prev_insight["insight_date"],
                today_snapshot,
            )
        elif prev_scores:
            prev_avg = round(sum(s["score"] for s in prev_scores) / len(prev_scores)) if prev_scores else 0
            prev_snapshot = {
                "run_date": prev_scores[0].get("run_date", ""),
                "avg_score": prev_avg,
                "brands": prev_scores,
            }
            prompt = build_first_time_insight_prompt(industry_name, prev_snapshot, today_snapshot)
        else:
            prompt = build_update_insight_prompt(industry_name, "", "", today_snapshot)

        # Generate insight
        text, generated_by = generate_insight_text(prompt)

        # Write to BigQuery
        write_insight(
            industry_id=industry_id,
            insight_date=today_str,
            insight_text=text,
            generated_by=generated_by,
        )

        print(f"  ✅ {industry_name} — insight saved ({generated_by})")
        return True

    except Exception as e:
        print(f"  ❌ {industry_name} failed: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="rAsh Score Insight Generator")
    parser.add_argument("--industry", help="Generate for a specific industry ID only")
    args = parser.parse_args()

    print("🧠 rAsh Score — AI Insight Generation")
    print("=" * 45)

    if args.industry:
        ind = get_industry_by_id(args.industry)
        if not ind:
            print(f"❌ Unknown industry: {args.industry}")
            sys.exit(1)
        industries = [ind]
    else:
        industries = get_all_industries()

    print(f"📊 {len(industries)} industries\n")

    success_count = 0
    for i, industry in enumerate(industries):
        ok = generate_industry_insight(industry)
        if ok:
            success_count += 1

        # Small delay between industries
        if i < len(industries) - 1:
            time.sleep(5)

    print(f"\n📊 Results: {success_count}/{len(industries)} industries")
    print("✅ Insight generation complete!")


if __name__ == "__main__":
    main()
