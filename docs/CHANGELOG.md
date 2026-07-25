# Changelog

All notable changes to rAsh Score are documented here.

## [1.2.0] - 2026-06-27

### Added
- **Advanced Analytics page** (`/analytics`) with:
  - Anomaly Detection — Z-score method flagging brands with score changes >2σ from historical mean
  - Trend Forecasting — Linear regression per industry with R², slope, and 3-day forecast
  - Brand Volatility Index — Top 15 most unpredictable brands ranked by Coefficient of Variation
  - Weekly Summary Report — This week vs last week performance with top improvers/decliners
  - Score Stability Report — Donut chart showing % of brands with stable/minor/moderate/major changes
  - Sparkline charts with forecast overlay (dashed purple line)
- New API endpoint: `GET /api/analytics` for anomaly detection, forecasting, and volatility data
- Navigation: added "Analytics" link in header

## [1.1.0] - 2026-06-26

### Added
- Cross-Industry Intelligence page (`/intelligence`) with:
  - Industry Leaderboard — All 19 industries ranked by AI visibility score
  - Model Bias Heatmap — How NVIDIA Nemotron vs Groq models score each industry differently
  - Top Movers — Biggest score gainers and decliners across all industries
  - Score Distribution — Min/max/avg/median/stddev per industry with visual range chart
  - Correlation Matrix — Pearson correlations between scoring dimensions
  - Data Coverage stats — Total brands, runs, days of data
- **New API endpoint**: `GET /api/intelligence` for cross-industry analytics
  - Uses SQL window functions (ROW_NUMBER) and CTEs
  - Computes Pearson correlation in pure TypeScript
  - Statistical calculations: median, standard deviation
- Navigation link to Intelligence page in header

### Changed
- Extracted shared `scoreColor`, `scoreGradient`, `scoreLabel` utilities to `src/lib/ui-utils.ts`
- Extracted shared `StructuredModelResponse` interface to `src/lib/types.ts`
- Bumped version to 1.1.0
- Updated package.json: corrected repo URL, homepage, and keywords

### Fixed
- HTML export bug: `<div="summary-card">` → `<div class="summary-card">` in `export.ts`

### Removed
- Dead code: `src/lib/scheduler.ts` (in-memory scheduler, unusable on Vercel serverless)
- Dead code: `src/app/api/scheduler/route.ts` (depended on deleted scheduler)
- Unused dependencies: `@anthropic-ai/sdk`, `@google/generative-ai`, `groq-sdk` (app uses raw `fetch()`)

### Documentation
- Architecture documentation (`docs/ARCHITECTURE.md`)
  - System overview with Mermaid data flow diagram
  - Database ER diagram
  - Pipeline stage diagram
  - Tech stack rationale table
  - Deployment topology
- **Data Dictionary** (`docs/DATA_DICTIONARY.md`)
  - All 5 tables documented with column types, indexes, and constraints
  - Metric definitions for all scoring dimensions
  - Score interpretation guide
- **Intelligence documentation** (`docs/INTELLIGENCE.md`)
  - Feature documentation for each Intelligence page section
  - API response schema
  - SQL query examples
  - Interpretation guide for model bias heatmap
- **This Changelog** (`docs/CHANGELOG.md`)

## [1.0.0] - 2026-01-27

### Initial Release
- Live brand AI visibility check via multi-model analysis
- India rAsh Index dashboard with 19 industries, 285 brands
- Daily automated pipeline via GitHub Actions (01:30 UTC)
- Daily AI-generated insights via GitHub Actions (03:00 UTC)
- Multi-model scoring: NVIDIA Nemotron + Groq (Llama, GPT-OSS)
- Brand detail pages with historical trends (SSR + ISR)
- Custom SVG charts: timeline, score breakdown, trend lines
- Competitor comparison feature
- Score breakdown: Recommendation (40), Sentiment (30), Prominence (20), Accuracy (10)
- Export functionality (CSV, JSON, PDF-via-print)
- Industry/model filter and brand search
- Share and Compare modes in dashboard
- Rate limiting (10 requests/min per IP)
- Full SEO: OpenGraph, Twitter Cards, JSON-LD structured data
- Accessibility: ARIA labels, keyboard navigation, skip-to-content
