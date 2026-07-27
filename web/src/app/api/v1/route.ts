/**
 * Public API v1 — Documentation
 * GET /api/v1
 *
 * Returns OpenAPI-style documentation for the rAsh Score public API.
 */
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    name: "rAsh Score Public API",
    version: "v1",
    description: "AI Brand Intelligence API — Score, rank, and track 285+ Indian brands across 18 industries using multi-model AI evaluation.",
    base_url: "https://rashscore.live/api/v1",
    author: {
      name: "Prashanth Kumar Kadasi",
      url: "https://kprsnt.in",
    },
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/score/{brand}",
        description: "Get the latest rAsh Score for a specific brand",
        example: "/api/v1/score/Flipkart",
        response: {
          brand: "Flipkart",
          score: 72,
          rank: 2,
          industry: "ecommerce",
          breakdown: { recommendation: 30, sentiment: 22, prominence: 14, accuracy: 6 },
        },
      },
      {
        method: "GET",
        path: "/api/v1/rankings/{industry}",
        description: "Get top ranked brands for an industry",
        params: { limit: "Number of brands to return (default: 10)" },
        example: "/api/v1/rankings/technology?limit=5",
        response: {
          industry: "technology",
          count: 5,
          brands: [{ rank: 1, brand: "TCS", score: 75, breakdown: {} }],
        },
      },
      {
        method: "GET",
        path: "/api/v1/trends/{brand}",
        description: "Get score trend for a brand over time",
        params: { days: "Lookback period (default: 30)" },
        example: "/api/v1/trends/Flipkart?days=14",
        response: {
          brand: "Flipkart",
          trend: "improving",
          score_change: 3,
          current_score: 72,
          history: [{ date: "2026-07-01", score: 69 }],
        },
      },
    ],
    industries: [
      "technology", "automotive", "ecommerce", "fashion", "food-beverage",
      "healthcare", "finance", "telecom", "entertainment", "travel",
      "energy", "fmcg", "realestate", "edtech", "logistics",
      "consumer-electronics", "mobile-phones", "home-appliances",
    ],
    rate_limits: "No rate limits currently enforced. Please be respectful.",
    mcp_server: {
      description: "An MCP server is also available for direct AI assistant integration",
      tools: ["get_brand_score", "get_industry_rankings", "compare_brands", "search_brands", "analyze_brand_trend", "analyze_industry_trend", "get_brand_insight"],
      prompts: ["brand_deep_dive", "industry_report", "head_to_head"],
    },
  });
}
