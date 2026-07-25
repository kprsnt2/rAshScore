# Data Dictionary — rAsh Score

> Complete documentation of all database tables, columns, and metrics.

---

## Tables Overview

| Table | Purpose | Approximate Rows/Run |
|-------|---------|---------------------|
| `pipeline_runs` | One record per daily pipeline execution | 1 |
| `industry_results` | Industry-level aggregated scores per run | 19 |
| `brand_results` | Per-brand scores (aggregated + per-model) | ~855 (285 × 3 models) |
| `industry_insights` | AI-generated daily narrative insights | 19 |
| `live_search_results` | User-initiated live brand searches (cached) | Variable |

---

## Table: `pipeline_runs`

Stores metadata about each daily pipeline execution.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | INTEGER | No | Auto-increment primary key |
| `run_date` | TEXT | No | ISO date of the run (e.g., `2026-06-25`) |
| `total_industries` | INTEGER | No | Number of industries processed |
| `total_brands` | INTEGER | No | Total brands attempted |
| `successful_brands` | INTEGER | No | Brands that returned valid scores |
| `average_score` | REAL | No | Mean score across all brands |
| `highest_score` | REAL | No | Max score in this run |
| `lowest_score` | REAL | No | Min score in this run |
| `total_time_ms` | INTEGER | No | Total pipeline execution time in milliseconds |
| `created_at` | TEXT | No | ISO timestamp of record creation |

**Indexes:** None (queried by `id DESC` or `run_date`)

---

## Table: `industry_results`

Industry-level aggregated metrics per pipeline run.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | INTEGER | No | Auto-increment primary key |
| `run_id` | INTEGER | No | FK → `pipeline_runs.id` |
| `industry_id` | TEXT | No | Industry identifier (e.g., `technology`, `automotive`) |
| `industry_name` | TEXT | No | Display name (e.g., `Technology & IT`) |
| `avg_score` | REAL | No | Mean rAsh Score for this industry |
| `avg_recommendation` | REAL | No | Mean recommendation score (0–40) |
| `avg_sentiment` | REAL | No | Mean sentiment score (0–30) |
| `avg_prominence` | REAL | No | Mean prominence score (0–20) |
| `avg_accuracy` | REAL | No | Mean accuracy score (0–10) |
| `total_brands` | INTEGER | No | Brands in this industry |
| `successful_brands` | INTEGER | No | Brands with valid scores |
| `response_time_ms` | INTEGER | No | Processing time for this industry |
| `error` | TEXT | Yes | Error message if processing failed |

**Indexes:** `idx_industry_results_run` on `(run_id)`

---

## Table: `brand_results`

Individual brand scores — the core data table.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | INTEGER | No | Auto-increment primary key |
| `run_id` | INTEGER | No | FK → `pipeline_runs.id` |
| `industry_id` | TEXT | No | Industry identifier |
| `brand` | TEXT | No | Brand name (e.g., `Tata Consultancy Services`) |
| `category` | TEXT | No | Industry category |
| `score` | INTEGER | No | Total rAsh Score (0–100) |
| `recommendation` | INTEGER | No | Recommendation dimension (0–40) |
| `sentiment` | INTEGER | No | Sentiment dimension (0–30) |
| `prominence` | INTEGER | No | Prominence dimension (0–20) |
| `accuracy` | INTEGER | No | Accuracy dimension (0–10) |
| `response_time_ms` | INTEGER | No | AI model response time |
| `error` | TEXT | Yes | Error message if scoring failed |
| `model` | TEXT | Yes | **`NULL` = aggregated across models**, non-NULL = per-model score |

> **Key Design Decision:** Each brand gets multiple rows per run:
> - One row with `model = NULL` → aggregated (averaged) score across all models
> - One row per model (e.g., `model = 'nvidia/nemotron-3-ultra-550b-a55b'`) → that model's individual score
>
> The aggregated row is used for rankings. Per-model rows enable bias analysis.

**Indexes:**
- `idx_brand_results_run` on `(run_id)`
- `idx_brand_results_industry` on `(industry_id)`
- `idx_brand_results_model` on `(model)`

---

## Table: `industry_insights`

AI-generated daily narrative insights per industry.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | INTEGER | No | Auto-increment primary key |
| `industry_id` | TEXT | No | Industry identifier |
| `insight_date` | TEXT | No | ISO date of the insight |
| `insight_text` | TEXT | No | Multi-line AI-generated insight text |
| `generated_by` | TEXT | No | Model name that generated the insight |
| `previous_insight_id` | INTEGER | Yes | FK → self, for insight chaining |
| `created_at` | TEXT | No | ISO timestamp |

**Unique Constraint:** `(industry_id, insight_date)` — one insight per industry per day

**Indexes:**
- `idx_insights_industry` on `(industry_id)`
- `idx_insights_date` on `(insight_date)`

---

## Table: `live_search_results`

Caches user-initiated brand searches from the live check feature.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | INTEGER | No | Auto-increment primary key |
| `brand` | TEXT | No | Brand name searched |
| `category` | TEXT | No | Detected category |
| `score` | INTEGER | No | Total rAsh Score |
| `recommendation` | INTEGER | No | Recommendation dimension |
| `sentiment` | INTEGER | No | Sentiment dimension |
| `prominence` | INTEGER | No | Prominence dimension |
| `accuracy` | INTEGER | No | Accuracy dimension |
| `overall_sentiment` | TEXT | No | `positive` / `neutral` / `negative` |
| `tips` | TEXT | No | JSON array of optimization tips |
| `responses` | TEXT | No | JSON array of model responses |
| `models_queried` | INTEGER | No | Number of models queried |
| `response_time_ms` | INTEGER | No | Total response time |
| `created_at` | TEXT | No | ISO timestamp |

---

## Metric Definitions

### rAsh Score (0–100)

The composite AI visibility score. Sum of four dimensions:

| Dimension | Range | Weight | What It Measures |
|-----------|-------|--------|-----------------|
| **Recommendation** | 0–40 | 40% | How strongly AI models recommend the brand when asked for suggestions. Keywords: "best", "recommend", "top choice", "leading" |
| **Sentiment** | 0–30 | 30% | Overall tone of AI responses about the brand. Positive words vs negative words, enthusiasm level |
| **Prominence** | 0–20 | 20% | How prominently the brand appears in AI responses. Measured by: mention count, position in response, whether mentioned in first 500 characters |
| **Accuracy** | 0–10 | 10% | Factual accuracy of AI's knowledge about the brand. Presence of specific facts: founding date, products, CEO, market position |

### Score Interpretation

| Score Range | Rating | Meaning |
|------------|--------|---------|
| 85–100 | 🟢 Excellent | Brand dominates AI recommendations |
| 70–84 | 🟢 Good | Strong AI visibility, consistently recommended |
| 55–69 | 🟡 Moderate | Decent presence but room for improvement |
| 40–54 | 🟠 Low | Minimal AI visibility, rarely recommended |
| 0–39 | 🔴 Poor | Brand is largely invisible to AI models |

---

## Data Flow

```
Daily Pipeline (GitHub Actions)
  │
  ├─ Query AI models with standardized prompts
  │   ├─ NVIDIA Nemotron 550B
  │   ├─ Groq GPT-OSS 120B
  │   └─ Groq Llama 3.3 70B
  │
  ├─ Parse JSON responses → extract per-model scores
  │
  ├─ Aggregate scores across models (average)
  │
  ├─ Store in SQLite (brand_results table)
  │   ├─ Per-model rows (model = model_name)
  │   └─ Aggregated rows (model = NULL)
  │
  ├─ Compute industry averages (industry_results table)
  │
  └─ Generate AI insights (industry_insights table)
      └─ Uses score data + previous insight for context
```
