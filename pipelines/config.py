"""
rAsh Score v2.0 — Pipeline Configuration
GCP project settings, AI model definitions, and shared constants.
"""

import os

# ─── GCP Settings ────────────────────────────────────────────────────────────

GCP_PROJECT_ID = os.environ.get("GCP_PROJECT_ID", "rashscore")
GCP_REGION = os.environ.get("GCP_REGION", "us-central1")
BQ_DATASET = "brand_intelligence"
BQ_FULL_DATASET = f"{GCP_PROJECT_ID}.{BQ_DATASET}"

# ─── AI Provider Configurations ──────────────────────────────────────────────

PROVIDERS = {
    "openai": {
        "primary": "gpt-5.4-mini",
        "backup": "gpt-5.4-nano",
        "base_url": "https://api.openai.com/v1",
        "api_key_env": "OPENAI_API_KEY",
        "format": "openai",  # OpenAI chat completions format
        "timeout": 60,
        "max_tokens": 8000,
        "temperature": 0.3,
    },
    "gemini": {
        "primary": "gemini-2.5-flash",
        "backup": "gemini-2.5-flash-lite",
        "base_url": "https://generativelanguage.googleapis.com/v1beta/models",
        "api_key_env": "GEMINI_API_KEY",
        "format": "gemini",  # Google Generative Language format
        "timeout": 60,
        "max_tokens": 8000,
        "temperature": 0.3,
    },
    "claude": {
        "primary": "claude-sonnet-5",
        "backup": "claude-sonnet-4",
        "format": "vertex-claude",  # Vertex AI rawPredict (Anthropic format)
        "timeout": 120,
        "max_tokens": 8000,
        "temperature": 0.3,
    },
    "grok": {
        "primary": "xai/grok-4.20-non-reasoning",
        "backup": "xai/grok-4.3",
        "format": "vertex-openai",  # Vertex AI OpenAI-compatible endpoint
        "timeout": 120,
        "max_tokens": 8000,
        "temperature": 0.3,
    },
}

# ─── Retry Configuration ─────────────────────────────────────────────────────

RETRY_DELAYS = [30, 60, 90]  # seconds between retries
MAX_RETRIES = len(RETRY_DELAYS)
DELAY_BETWEEN_INDUSTRIES = 12  # seconds between industry API calls (rate limit)

# ─── Scoring Bounds ──────────────────────────────────────────────────────────

SCORE_BOUNDS = {
    "recommendation": (0, 40),
    "sentiment": (0, 30),
    "prominence": (0, 20),
    "accuracy": (0, 10),
}
MAX_TOTAL_SCORE = 100
