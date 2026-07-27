# rAsh Score — AI Brand Intelligence Platform

> **How do AI models perceive your brand?** rAsh Score measures the visibility and reputation of 285+ Indian brands across 18 industries, as seen by GPT, Gemini, Claude, and Grok.

🌐 **Live:** [rashscore.live](https://rashscore.live) · 📧 **Contact:** hey@rashscore.live · 👤 **Author:** [Prashanth Kumar Kadasi](https://kprsnt.in)

---

## 🧠 What is rAsh Score?

rAsh Score is a **brand intelligence platform** that queries multiple AI models to score brands on 4 dimensions:

| Dimension | Weight | What it measures |
|-----------|--------|-----------------|
| **Recommendation** | 40% | How likely AI assistants are to recommend this brand |
| **Sentiment** | 30% | Overall public & social media sentiment |
| **Prominence** | 20% | Brand awareness and visibility |
| **Accuracy** | 10% | How much verified data AI models have |

Each model scores 0–100 per dimension → weighted → aggregated into a single **rAsh Score (0–100)**.

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    rAsh Score v2.2                        │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────┐  │
│  │  Scoring     │   │   Agentic    │   │   MCP        │  │
│  │  Pipeline    │   │   Pipeline   │   │   Server     │  │
│  │  (simple)    │   │  (4 agents)  │   │  (7 tools)   │  │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘  │
│         │                  │                   │          │
│         ▼                  ▼                   ▼          │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              BigQuery Data Warehouse                │  │
│  │  brand_scores · pipeline_runs · industry_insights   │  │
│  └──────────────────────┬──────────────────────────────┘  │
│                         │                                 │
│         ┌───────────────┼───────────────┐                 │
│         ▼               ▼               ▼                 │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐          │
│  │ Dashboard  │  │ Public API │  │ Chat       │          │
│  │ (Next.js)  │  │ (REST v1)  │  │ Assistant  │          │
│  └────────────┘  └────────────┘  └────────────┘          │
│                                                          │
│              Cloud Run · GitHub Actions CI/CD             │
└──────────────────────────────────────────────────────────┘
```

---

## ✨ Key Features

### 🤖 Multi-Agent Scoring Pipeline
Three execution modes with increasing intelligence:

```bash
# Simple: 1 LLM call per industry
python run_pipeline.py --provider=gemini --mode=simple

# Agentic: LLM research + context-enriched scoring (2 LLM calls)
python run_pipeline.py --provider=gemini --mode=agentic

# Agentic-Live: Tavily web search + LLM synthesis + scoring
python run_pipeline.py --provider=gemini --mode=agentic-live
```

**Agent workflow (agentic-live):**
1. **Research Agent** — Tavily AI Search for real-time brand news + LLM synthesis
2. **Scoring Agent** — Context-aware scoring with full guidelines
3. **Validation Agent** — Outlier detection, range clamping, lazy-response detection
4. **Insight Agent** — Structured analytics (avg, spread, clustering warnings)

### 🔌 MCP Server (Model Context Protocol)
Connect any MCP-compatible AI assistant (Claude Desktop, Cursor, Windsurf) to live rAsh Score data:

```json
{
  "mcpServers": {
    "rashscore": {
      "command": "node",
      "args": ["mcp/dist/server.js"]
    }
  }
}
```

**7 Tools:** `get_brand_score` · `get_industry_rankings` · `compare_brands` · `search_brands` · `analyze_brand_trend` · `analyze_industry_trend` · `get_brand_insight`

**3 Prompts:** `brand_deep_dive` · `industry_report` · `head_to_head`

### 📊 AI Evals Framework
Cross-model agreement scoring and temporal drift detection:

```bash
python -m evals.run_evals --date=2026-07-28
```

- **Cross-model agreement** — Kendall's tau rank correlation across GPT/Gemini/Claude/Grok
- **Drift detection** — Flags industries/brands with >5pt/10pt score shifts vs 7-day average
- **Model bias detection** — Identifies which models consistently score higher/lower

### 🔍 Pipeline Observability
Built-in tracing with per-agent performance metrics:

```
🔍 Pipeline Trace Report
══════════════════════════
  Run ID:    abc123...
  Provider:  gemini
  Mode:      agentic-live
  Duration:  142.3s

📊 Agent Performance:
  research-tavily       avg  1.2s | 18/18 success ✅
  research-llm          avg  2.1s | 18/18 success ✅
  scoring               avg  4.5s | 18/18 success ✅
  validation            avg  0.0s | 18/18 success ✅
```

### 💬 Dashboard Chat Assistant
AI-powered chat widget on the dashboard — ask questions in natural language:
- *"What's Flipkart's rAsh score?"*
- *"Who leads the technology sector?"*
- *"Compare Zomato and Swiggy"*

Powered by Vercel AI SDK + Gemini 2.5 Flash with tool-calling against live BigQuery data.

### 🌐 Public REST API

```bash
# Get a brand's score
curl https://rashscore.live/api/v1/score/Flipkart

# Get industry rankings
curl https://rashscore.live/api/v1/rankings/technology?limit=5

# Get brand trend
curl https://rashscore.live/api/v1/trends/Flipkart?days=30

# API documentation
curl https://rashscore.live/api/v1
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **AI Models** | GPT-5.4, Gemini 2.5 Flash, Claude Sonnet 5, Grok 4 |
| **Agentic Framework** | Custom 4-agent pipeline with tool-calling (Tavily AI Search) |
| **MCP** | Model Context Protocol SDK (TypeScript) — 7 tools, 3 prompts |
| **Data** | BigQuery (warehouse) + Dataform (transformations) |
| **Backend** | Python 3.12 (pipelines) + Next.js 16 (web) |
| **Frontend** | React 18, Tailwind CSS, Framer Motion, Vercel AI SDK |
| **Infrastructure** | Google Cloud Run, GitHub Actions CI/CD |
| **Evals** | Custom framework — cross-model agreement (Kendall's tau), drift detection |
| **Observability** | Pipeline tracing with spans, error tracking, BQ export |
| **Search** | Tavily AI Search (real-time brand intelligence) |

---

## 📁 Project Structure

```
rAshScore/
├── .github/workflows/
│   └── deploy-cloudrun.yml      # CI/CD to Cloud Run
│
├── pipelines/                   # Python scoring pipeline
│   ├── agents/                  # 🤖 Agentic pipeline
│   │   ├── orchestrator.py      #    Workflow manager (3 modes)
│   │   ├── research_agent.py    #    LLM/Tavily research
│   │   ├── scoring_agent.py     #    Context-enriched scoring
│   │   ├── validation_agent.py  #    Anomaly detection
│   │   ├── insight_agent.py     #    Analytics synthesis
│   │   └── tools/
│   │       └── tavily_search.py #    Tavily AI Search integration
│   ├── evals/                   # 📊 AI evaluation framework
│   │   ├── score_evaluator.py   #    Cross-model agreement
│   │   ├── drift_detector.py    #    Temporal drift detection
│   │   └── run_evals.py         #    CLI entry point
│   ├── observability.py         # 🔍 Pipeline tracing
│   ├── run_pipeline.py          # Main pipeline runner
│   ├── run_insights.py          # Daily insight generation
│   ├── prompts.py               # Scoring prompts + parsing
│   ├── scoring.py               # Weightage + validation
│   ├── config.py                # Provider configs
│   ├── industry_data.py         # 18 industries, 285 brands
│   ├── bq_writer.py             # BigQuery write operations
│   └── setup_schema.py          # BQ table creation
│
├── mcp/                         # 🔌 MCP Server
│   ├── src/
│   │   ├── server.ts            #    7 tools, 2 resources, 3 prompts
│   │   └── bq-client.ts         #    BigQuery queries
│   ├── package.json
│   └── tsconfig.json
│
├── web/                         # 🌐 Next.js Dashboard
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/
│   │   │   │   ├── chat/route.ts       # Chat assistant API
│   │   │   │   └── v1/                 # Public REST API
│   │   │   │       ├── route.ts        #   API docs
│   │   │   │       ├── score/[brand]/  #   GET /api/v1/score/:brand
│   │   │   │       ├── rankings/[industry]/ # GET /api/v1/rankings/:industry
│   │   │   │       └── trends/[brand]/ #   GET /api/v1/trends/:brand
│   │   │   └── dashboard/page.tsx
│   │   └── components/
│   │       └── ChatAssistant.tsx        # AI chat widget
│   └── package.json
│
└── dataform/                    # BigQuery SQL transformations
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js ≥ 20
- Python ≥ 3.10
- GCP project with BigQuery enabled
- API keys: `GEMINI_API_KEY` (required), `TAVILY_API_KEY` (optional, for agentic-live)

### Setup

```bash
# 1. Clone
git clone https://github.com/kprsnt2/rAshScore.git
cd rAshScore

# 2. Pipeline setup
cd pipelines
pip install -r requirements.txt
python setup_schema.py  # Create BigQuery tables

# 3. Run pipeline
python run_pipeline.py --provider=gemini --mode=agentic-live

# 4. Web dashboard
cd ../web
npm install
npm run dev  # → http://localhost:3000

# 5. MCP server (optional)
cd ../mcp
npm install && npm run build
# Add to Claude Desktop config
```

---

## 📈 Scoring Methodology

1. AI model receives brand list + industry context + scoring guidelines
2. Each dimension scored **0–100** with strict calibration rules
3. Weighted: Recommendation (×0.40) + Sentiment (×0.30) + Prominence (×0.20) + Accuracy (×0.10)
4. **Agentic mode** adds: real-time research context → higher accuracy
5. Validation agent catches outliers, lazy AI responses, and suspicious scores
6. Scores aggregated across models → stored in BigQuery → served on dashboard

---

## 📄 License

MIT © [Prashanth Kumar Kadasi](https://kprsnt.in)
