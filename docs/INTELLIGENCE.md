# Cross-Industry Intelligence — Feature Documentation

> Analyzing AI brand visibility patterns across all 19 Indian industries.

## Overview

The Intelligence page (`/intelligence`) provides a bird's-eye view of AI brand visibility across **all industries simultaneously**. While the Dashboard shows per-industry rankings, the Intelligence page answers cross-cutting questions:

- **Which industries have the highest AI visibility?**
- **Do different AI models have systematic biases?**
- **Which brands are moving the most across India?**
- **How are scores distributed within each industry?**
- **Are the scoring dimensions correlated?**

---

## API Endpoint

### `GET /api/intelligence`

Returns all cross-industry analytics data in a single response.

**Caching:** ISR with 1-hour revalidation (`revalidate = 3600`)

**Response Structure:**

```json
{
  "industryLeaderboard": [
    {
      "industry_id": "technology",
      "industry_name": "Technology & IT",
      "avg_score": 65.3,
      "avg_recommendation": 26.1,
      "avg_sentiment": 19.4,
      "avg_prominence": 13.2,
      "avg_accuracy": 6.6,
      "total_brands": 15,
      "top_brand": "Zoho",
      "top_score": 73
    }
  ],
  "modelBias": {
    "technology": {
      "nvidia/nemotron-3-ultra": { "avg_score": 68.2, "brand_count": 15 },
      "groq/llama-3.3-70b": { "avg_score": 62.1, "brand_count": 15 }
    }
  },
  "models": ["nvidia/nemotron-3-ultra", "groq/llama-3.3-70b"],
  "topMovers": {
    "gainers": [{ "brand": "...", "change": 5, "score": 72 }],
    "decliners": [{ "brand": "...", "change": -4, "score": 55 }]
  },
  "scoreDistribution": [
    {
      "industry_id": "technology",
      "min": 45, "max": 73, "avg": 65.3,
      "median": 66, "stddev": 7.2, "count": 15,
      "scores": [45, 48, 52, ...]
    }
  ],
  "correlationMatrix": {
    "recommendation": { "recommendation": 1.0, "sentiment": 0.85, "prominence": 0.72, "accuracy": 0.61 },
    "sentiment": { ... },
    "prominence": { ... },
    "accuracy": { ... }
  },
  "coverage": {
    "totalBrands": 285,
    "totalIndustries": 19,
    "totalRuns": 45,
    "daysOfData": 45,
    "latestRunDate": "2026-06-25",
    "firstRunDate": "2026-04-26"
  }
}
```

---

## Sections

### 1. Data Coverage

Summary statistics showing the scale of the dataset:
- Total brands tracked
- Total industries monitored
- Number of pipeline runs completed
- Days of historical data
- Number of AI models used

### 2. Industry Leaderboard

All 19 industries ranked by average rAsh Score. Each card shows:
- Industry name with emoji icon
- Average score with gradient coloring
- Mini score breakdown bar (recommendation/sentiment/prominence/accuracy)
- Top-performing brand
- Total brands in the industry
- Links to the industry's dashboard page

**SQL Used:**
```sql
SELECT ir.*, tb.brand as top_brand, tb.score as top_score
FROM industry_results ir
LEFT JOIN (
  SELECT industry_id, brand, score,
    ROW_NUMBER() OVER (PARTITION BY industry_id ORDER BY score DESC) as rn
  FROM brand_results WHERE run_id = ? AND model IS NULL AND score > 0
) tb ON tb.industry_id = ir.industry_id AND tb.rn = 1
WHERE ir.run_id = ?
ORDER BY ir.avg_score DESC
```

### 3. Model Bias Heatmap

A color-coded matrix showing **industries (rows) × AI models (columns)**. Each cell shows the average score that specific model gave to brands in that industry.

**How to Interpret:**
- **Horizontal patterns:** An industry scoring consistently high/low across all models = genuine AI visibility
- **Vertical patterns:** A model scoring consistently higher/lower than others = model bias
- **Outlier cells:** A specific industry-model combination that deviates = model-specific perception

**Color Scale:** Dark purple (low scores) → Bright cyan (high scores)

### 4. Top Movers

Shows the brands with the biggest score changes between the latest two pipeline runs:
- **Biggest Gainers** (green) — Brands whose AI visibility improved most
- **Biggest Decliners** (red) — Brands whose AI visibility dropped most

Each entry shows: brand name, industry, score change, and current score.

### 5. Score Distribution

Horizontal range chart per industry showing:
- **Full range** (min to max) as light bar
- **Average ± standard deviation** as colored overlay
- **Average** marked with a filled circle (●)
- **Median** marked with a vertical line (|)

Helps identify:
- Industries with tight score clustering vs high variance
- Industries where scores are skewed

### 6. Score Dimension Correlations

Pearson correlation matrix between the four scoring dimensions:
- **Recommendation** vs **Sentiment** vs **Prominence** vs **Accuracy**

**Interpretation:**
- Values close to 1.0 = strong positive correlation (scores move together)
- Values close to 0.0 = no correlation (independent dimensions)
- Values close to -1.0 = negative correlation (inverse relationship)

**Color:** Cyan = positive correlation, Red = negative correlation

---

## Technical Implementation

### Statistics (Pure TypeScript)

All statistical computations are done in TypeScript without external libraries:

- **Median:** Sort array, pick middle element
- **Standard Deviation:** √(Σ(xi - μ)² / N)
- **Pearson Correlation:** (nΣxy - ΣxΣy) / √((nΣx² - (Σx)²)(nΣy² - (Σy)²))

### SVG Charts

All visualizations are custom SVG — no charting library:
- **Heatmap:** `<rect>` elements with dynamic fill colors
- **Distribution:** `<rect>` + `<circle>` + `<line>` elements
- **Correlation:** `<rect>` elements with opacity based on correlation value

---

## Future Enhancements

- [ ] Time-series analysis: How do industry rankings change over time?
- [ ] Anomaly detection: Flag unusual score changes automatically
- [ ] Trend forecasting: Predict next-week scores using linear regression
- [ ] Export: Download intelligence data as CSV/PDF report
- [ ] Clustering: Group brands by score profile similarity
