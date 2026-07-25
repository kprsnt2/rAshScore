import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as bq from "./bq-client.js";

const server = new McpServer({
  name: "rashscore-mcp-server",
  version: "1.0.0",
});

// --- RESOURCES ---

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

// --- TOOLS ---

server.tool(
  "get_brand_score",
  "Get the rAsh Score for a specific brand",
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
  "Search for brands across all industries",
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
  "Compare two brands side-by-side",
  { 
    brand1: z.string().describe("Name of the first brand"),
    brand2: z.string().describe("Name of the second brand")
  },
  async ({ brand1, brand2 }) => {
    try {
      const date = await bq.getLatestRunDate();
      if (!date) return { content: [{ type: "text", text: "No data available." }] };
      
      const res1 = await bq.getBrandScore(brand1, date);
      const res2 = await bq.getBrandScore(brand2, date);
      
      return {
        content: [{ type: "text", text: JSON.stringify({ [brand1]: res1 || "Not found", [brand2]: res2 || "Not found" }, null, 2) }]
      };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
  }
);

// Connect and start serving
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("rAsh Score MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
