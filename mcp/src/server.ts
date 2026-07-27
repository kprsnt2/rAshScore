import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as bq from "./bq-client.js";

const server = new McpServer({
  name: "rashscore-mcp-server",
  version: "2.0.0",
});

// ─── RESOURCES ──────────────────────────────────────────────────────────────

server.resource(
  "industries",
  "rashscore://industries",
  async (uri) => {
    const industries = await bq.getIndustriesList();
    return {
      contents: [{
        uri: uri.href,
        text: JSON.stringify(industries, null, 2),
        mimeType: "application/json",
      }]
    };
  }
);

server.resource(
  "latest-run",
  "rashscore://latest-run",
  async (uri) => {
    const latestDate = await bq.getLatestRunDate();
    return {
      contents: [{
        uri: uri.href,
        text: JSON.stringify({ latest_run_date: latestDate }),
        mimeType: "application/json",
      }]
    };
  }
);

// ─── TOOLS ──────────────────────────────────────────────────────────────────

server.tool(
  "get_brand_score",
  "Get the rAsh Score breakdown for a specific brand",
  { brand: z.string().describe("The name of the brand (e.g., 'Flipkart')") },
  async ({ brand }) => {
    try {
      const date = await bq.getLatestRunDate();
      if (!date) return { content: [{ type: "text", text: "No data available." }] };
      
      const result = await bq.getBrandScore(brand, date);
      if (!result) return { content: [{ type: "text", text: `Brand '${brand}' not found.` }] };

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
      };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
  }
);

server.tool(
  "get_industry_rankings",
  "Get top ranked brands for a specific industry",
  { 
    industry: z.string().describe("The ID of the industry (e.g., 'technology', 'ecommerce')"),
    limit: z.number().optional().describe("Number of top brands to return (default: 10)")
  },
  async ({ industry, limit }) => {
    try {
      const date = await bq.getLatestRunDate();
      if (!date) return { content: [{ type: "text", text: "No data available." }] };
      
      const results = await bq.getIndustryRankings(industry, date, limit || 10);
      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }]
      };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
  }
);

server.tool(
  "get_brand_insight",
  "Get the latest AI-generated narrative insight for an industry",
  { industry: z.string().describe("The ID of the industry (e.g., 'ecommerce')") },
  async ({ industry }) => {
    try {
      const insight = await bq.getBrandInsight(industry);
      if (!insight) return { content: [{ type: "text", text: `No insights found for industry '${industry}'.` }] };

      return {
        content: [{ type: "text", text: JSON.stringify(insight, null, 2) }]
      };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
  }
);

server.tool(
  "search_brands",
  "Search for brands across all industries by name",
  { query: z.string().describe("The search term") },
  async ({ query }) => {
    try {
      const date = await bq.getLatestRunDate();
      if (!date) return { content: [{ type: "text", text: "No data available." }] };
      
      const results = await bq.searchBrands(query, date);
      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }]
      };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
  }
);

server.tool(
  "compare_brands",
  "Compare two brands side-by-side with full score breakdowns",
  { 
    brand1: z.string().describe("Name of the first brand"),
    brand2: z.string().describe("Name of the second brand")
  },
  async ({ brand1, brand2 }) => {
    try {
      const date = await bq.getLatestRunDate();
      if (!date) return { content: [{ type: "text", text: "No data available." }] };
      
      const [res1, res2] = await Promise.all([
        bq.getBrandScore(brand1, date),
        bq.getBrandScore(brand2, date),
      ]);

      const comparison: any = {
        [brand1]: res1 || "Not found",
        [brand2]: res2 || "Not found",
      };

      if (res1 && res2) {
        comparison._analysis = {
          score_difference: res1.score - res2.score,
          leader: res1.score > res2.score ? brand1 : res2.score > res1.score ? brand2 : "Tied",
          dimension_leaders: {
            recommendation: res1.recommendation > res2.recommendation ? brand1 : brand2,
            sentiment: res1.sentiment > res2.sentiment ? brand1 : brand2,
            prominence: res1.prominence > res2.prominence ? brand1 : brand2,
            accuracy: res1.accuracy > res2.accuracy ? brand1 : brand2,
          },
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify(comparison, null, 2) }]
      };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
  }
);

// NEW: Trend analysis tool
server.tool(
  "analyze_brand_trend",
  "Analyze a brand's score trend over the last N days — detects improvement, decline, or stability",
  {
    brand: z.string().describe("The brand name"),
    days: z.number().optional().describe("Lookback period in days (default: 30)")
  },
  async ({ brand, days }) => {
    try {
      const result = await bq.getBrandTrend(brand, days || 30);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
      };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
  }
);

// NEW: Industry trend tool
server.tool(
  "analyze_industry_trend",
  "Analyze an industry's average score trend over the last N days",
  {
    industry: z.string().describe("The industry ID"),
    days: z.number().optional().describe("Lookback period in days (default: 14)")
  },
  async ({ industry, days }) => {
    try {
      const result = await bq.getIndustryTrend(industry, days || 14);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
      };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
  }
);

// ─── PROMPTS (pre-built analysis templates) ─────────────────────────────────

server.prompt(
  "brand_deep_dive",
  "Deep analysis of a specific brand's AI visibility",
  [{ name: "brand", description: "Brand name to analyze", required: true }],
  async ({ brand }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Perform a comprehensive AI visibility analysis for "${brand}" in India:

1. First, use the get_brand_score tool to get the current score
2. Then use analyze_brand_trend to check the trend over 30 days
3. Use search_brands to find similar brands and context

Based on the data, provide:
- Current score assessment (is it good/average/poor for their industry?)
- Trend analysis (improving, stable, or declining?)
- Dimension breakdown: which areas are strong vs weak?
- Actionable recommendations to improve their rAsh Score
- Comparison with likely competitors

Format as a professional brand intelligence report.`
      }
    }]
  })
);

server.prompt(
  "industry_report",
  "Comprehensive industry competitive landscape report",
  [{ name: "industry", description: "Industry ID (e.g., technology, ecommerce)", required: true }],
  async ({ industry }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Generate a comprehensive competitive landscape report for the "${industry}" industry in India:

1. Use get_industry_rankings to get the top 10 brands
2. Use get_brand_insight to get the latest AI insight
3. Use analyze_industry_trend to check the industry's trend

Provide:
- Industry overview with current average score
- Top 3 leaders deep dive (why they lead)
- Notable movers (who's rising/falling?)
- Industry-wide trends and patterns
- Key takeaways for brand managers in this industry

Format as a professional industry intelligence report with clear sections.`
      }
    }]
  })
);

server.prompt(
  "head_to_head",
  "Head-to-head comparison between two brands",
  [
    { name: "brand1", description: "First brand name", required: true },
    { name: "brand2", description: "Second brand name", required: true },
  ],
  async ({ brand1, brand2 }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Perform a head-to-head comparison between "${brand1}" and "${brand2}":

1. Use compare_brands to get side-by-side scores
2. Use analyze_brand_trend for both brands to see momentum
3. If they're in the same industry, use get_industry_rankings for context

Analyze:
- Overall score comparison
- Dimension-by-dimension breakdown (who wins each category and why)
- Trend momentum (who's improving faster?)
- Strategic advantages each brand has
- What each brand could learn from the other

Present as a competitive intelligence briefing.`
      }
    }]
  })
);

// ─── START SERVER ───────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("rAsh Score MCP Server v2.0 running on stdio");
  console.error("Tools: 7 | Resources: 2 | Prompts: 3");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
