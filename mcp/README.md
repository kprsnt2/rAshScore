# rAsh Score MCP Server

This directory contains the Model Context Protocol (MCP) server for rAsh Score, built with the `@modelcontextprotocol/sdk`.

This server exposes rAsh Score's BigQuery data as tools that any MCP-compatible AI assistant (like Claude Desktop, Cursor, or Windsurf) can use.

## Available Tools

- `get_brand_score`: Get the rAsh Score breakdown for a specific brand.
- `get_industry_rankings`: Get top ranked brands for a specific industry.
- `get_brand_insight`: Get the latest AI-generated narrative insight for an industry.
- `search_brands`: Search for brands across all industries.
- `compare_brands`: Compare two brands side-by-side.

## Available Resources

- `rashscore://industries`: List of all tracked industries.
- `rashscore://latest-run`: Information about the most recent pipeline run.

## Setup & Running

1. Install dependencies:
```bash
npm install
```

2. Build the project:
```bash
npm run build
```

3. Configure Claude Desktop (or Cursor):

Add the following to your Claude Desktop configuration file (usually located at `~/AppData/Roaming/Claude/claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "rashscore": {
      "command": "node",
      "args": ["C:/Users/kprsn/OneDrive/Desktop/RashScore/mcp/dist/server.js"],
      "env": {
        "GCP_PROJECT_ID": "rashscore",
        "GOOGLE_APPLICATION_CREDENTIALS": "path/to/your/service-account.json"
      }
    }
  }
}
```

*Note: You need valid Google Cloud credentials to query BigQuery. Make sure ADC is set up or provide the path to a service account key.*
