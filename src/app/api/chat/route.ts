import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateInsight } from '@/lib/insights';

const SCHEMA = `
TABLE pipeline_runs (
  id INTEGER PRIMARY KEY,
  run_date TEXT NOT NULL,          -- format: YYYY-MM-DD
  total_industries INTEGER,
  total_brands INTEGER,
  successful_brands INTEGER,
  average_score REAL,
  highest_score INTEGER,           -- 0-100 scale
  lowest_score INTEGER,            -- 0-100 scale
  total_time_ms INTEGER,
  created_at TEXT
)
TABLE industry_results (
  id INTEGER PRIMARY KEY,
  run_id INTEGER NOT NULL,         -- FK to pipeline_runs
  industry_id TEXT NOT NULL,       -- e.g. 'technology', 'automotive'
  industry_name TEXT NOT NULL,     -- e.g. 'Technology', 'Automotive'
  avg_score REAL,                  -- 0-100 scale
  avg_recommendation REAL,         -- 0-40 scale
  avg_sentiment REAL,              -- 0-30 scale
  avg_prominence REAL,             -- 0-20 scale
  avg_accuracy REAL,               -- 0-10 scale
  total_brands INTEGER,
  successful_brands INTEGER,
  response_time_ms INTEGER,
  error TEXT
)
TABLE brand_results (
  id INTEGER PRIMARY KEY,
  run_id INTEGER NOT NULL,         -- FK to pipeline_runs
  industry_id TEXT NOT NULL,
  brand TEXT NOT NULL,
  category TEXT,
  score INTEGER,                   -- OVERALL SCORE: 0-100 (sum of the 4 components below)
  recommendation INTEGER,          -- COMPONENT: 0-40 scale (40% weight)
  sentiment INTEGER,               -- COMPONENT: 0-30 scale (30% weight)
  prominence INTEGER,              -- COMPONENT: 0-20 scale (20% weight)
  accuracy INTEGER,                -- COMPONENT: 0-10 scale (10% weight)
  response_time_ms INTEGER,
  error TEXT,
  model TEXT                       -- NULL = aggregated across all models; otherwise specific model name
)
TABLE industry_insights (
  id INTEGER PRIMARY KEY,
  industry_id TEXT NOT NULL,
  insight_date TEXT NOT NULL,
  insight_text TEXT NOT NULL,
  generated_by TEXT NOT NULL,
  previous_insight_id INTEGER,
  created_at TEXT
)

SCORING SYSTEM:
- "score" is the OVERALL score out of 100.
- It is the SUM of 4 sub-scores: recommendation (max 40) + sentiment (max 30) + prominence (max 20) + accuracy (max 10) = 100.
- When a user says "recommendation rate > 80%", convert to absolute: 80% of 40 = 32, so use "recommendation > 32".
- When a user says "score > 80", use "score > 80" directly (it's already 0-100).
`;

const MAX_MESSAGE_LENGTH = 500;

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ error: `Message too long (max ${MAX_MESSAGE_LENGTH} characters)` }, { status: 400 });
    }

    // Step 1: Text-to-SQL
    const sqlPrompt = `You are a Text-to-SQL agent for a SQLite database measuring AI brand visibility in India.
Schema:
${SCHEMA}

CRITICAL RULES:
1. Always filter brand_results WHERE model IS NULL AND score > 0 unless the user specifically asks about a particular model.
2. The "score" column is 0-100. The sub-scores have DIFFERENT RANGES: recommendation is 0-40, sentiment is 0-30, prominence is 0-20, accuracy is 0-10.
3. If the user asks about PERCENTAGES (e.g. "recommendation > 80%"), convert to the correct absolute value (80% of 40 = 32).
4. If the user asks about the latest data, use the most recent run_id: (SELECT MAX(id) FROM pipeline_runs).
5. Only return the raw SQL SELECT statement. No markdown, no explanation, no backticks.

User Question: "${message}"`;


    const { text: sqlRaw } = await generateInsight(sqlPrompt);
    // Clean up in case the LLM returned markdown blocks
    const sqlQuery = sqlRaw.replace(/\`\`\`sql/gi, '').replace(/\`\`\`/g, '').trim();

    // Step 2: Execute SQL securely against read-only memory DB
    const db = await getDb();
    let queryResult = '';
    
    try {
      // Disallow dangerous keywords just to be safe, though sql.js is in-memory
      if (sqlQuery.toUpperCase().match(/\b(DROP|DELETE|UPDATE|INSERT|ALTER|CREATE)\b/)) {
        throw new Error('Only SELECT queries are allowed.');
      }
      
      const res = db.exec(sqlQuery);
      if (res.length > 0) {
        // Convert to array of objects
        const cols = res[0].columns;
        const rows = res[0].values.map(row => {
          const obj: any = {};
          cols.forEach((c, i) => obj[c] = row[i]);
          return obj;
        });
        queryResult = JSON.stringify(rows.slice(0, 50)); // Limit to 50 rows to avoid blowing up context
      } else {
        queryResult = '[]';
      }
    } catch (dbError) {
      console.error('SQL Execution Error:', dbError, 'Query:', sqlQuery);
      queryResult = `Error executing query: ${(dbError as Error).message}`;
    }

    // Step 3: Natural Language Response
    const answerPrompt = `You are an AI Data Analyst assistant for "rAsh Score".
The user asked a question. You translated it to SQL, executed it, and got the following JSON result from the database.

User Question: "${message}"
Generated SQL: ${sqlQuery}
SQL Result: ${queryResult}

Write a helpful, conversational, and direct answer to the user's question based on the SQL result. 
Do not talk about SQL, databases, or schemas to the user. Just provide the insight they asked for. Use markdown for formatting.`;

    const { text: finalAnswer, generatedBy } = await generateInsight(answerPrompt);

    return NextResponse.json({
      answer: finalAnswer,
      sql: sqlQuery,
      data: queryResult,
      generatedBy,
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
