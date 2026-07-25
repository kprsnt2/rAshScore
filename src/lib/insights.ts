/**
 * AI Industry Insights Generator
 *
 * Generates daily per-industry insights using NVIDIA (primary) with Groq fallback.
 *
 * Generation logic:
 * - First time (no prior insight): uses data from last 2 pipeline runs
 * - Subsequent days: uses yesterday's insight + today's new data
 *
 * Fallback chain: NVIDIA (nemotron → step-3.7-flash → glm-5.1) → Groq (gpt-oss-120b → compound → llama-3.3)
 * Retry delays for GitHub Actions: 30s, 60s, 90s between attempts
 *
 * Output format: bullet-point list with emojis (3–5 bullets)
 */

import { getEnv } from './env';
import { queryVertexGeminiRaw } from './vertex-gemini';

export interface InsightRow {
  id: number;
  industry_id: string;
  insight_date: string;
  insight_text: string;
  generated_by: string;
  previous_insight_id: number | null;
  created_at: string;
}

export interface IndustryDataSnapshot {
  industryId: string;
  industryName: string;
  runDate: string;
  avgScore: number;
  brands: {
    brand: string;
    score: number;
    rank: number;
    scoreChange: number | null;
    rankChange: number | null;
  }[];
}

// ─── Prompt Builders ────────────────────────────────────────────────────────

function buildFirstTimePrompt(
  industryName: string,
  day1: IndustryDataSnapshot,
  day2: IndustryDataSnapshot
): string {
  const formatBrands = (snap: IndustryDataSnapshot) =>
    snap.brands
      .slice(0, 10)
      .map((b, i) => `  ${i + 1}. ${b.brand}: ${b.score}/100`)
      .join('\n');

  return `You are an AI brand intelligence analyst covering India's top brands.

Analyze the AI visibility data below for the ${industryName} industry across two days and generate exactly 4–5 bullet-point insights.

Day 1 (${day1.runDate}) – Industry avg: ${day1.avgScore}
${formatBrands(day1)}

Day 2 (${day2.runDate}) – Industry avg: ${day2.avgScore}
${formatBrands(day2)}

Rules:
- Write exactly 4–5 bullet points
- Each bullet MUST start with a relevant emoji (📈 📉 🏆 🔄 ⚠️ 🚀 💡 🎯 etc.)
- Be specific: mention brand names and actual scores/ranks
- Note who is leading, who moved up/down, and any notable trends
- Keep each bullet to 1–2 concise sentences
- Do NOT include headers, markdown bold/italic, or any text outside the bullets
- Output ONLY the bullet list, nothing else`;
}

function buildUpdatePrompt(
  industryName: string,
  prevInsight: string,
  prevDate: string,
  today: IndustryDataSnapshot
): string {
  const topBrands = today.brands
    .slice(0, 10)
    .map((b, i) => {
      const change =
        b.scoreChange !== null && b.scoreChange !== 0
          ? ` (score ${b.scoreChange > 0 ? '+' : ''}${b.scoreChange})`
          : '';
      const rankChg =
        b.rankChange !== null && b.rankChange !== 0
          ? `, rank ${b.rankChange > 0 ? '▲' : '▼'}${Math.abs(b.rankChange)}`
          : '';
      return `  ${i + 1}. ${b.brand}: ${b.score}/100${change}${rankChg}`;
    })
    .join('\n');

  return `You are an AI brand intelligence analyst covering India's top brands.

Here is yesterday's insight (${prevDate}) for the ${industryName} industry:
${prevInsight}

Today's new data (${today.runDate}) – Industry avg: ${today.avgScore}:
${topBrands}

Generate exactly 4–5 updated bullet-point insights reflecting what changed today compared to yesterday.

Rules:
- Write exactly 4–5 bullet points
- Each bullet MUST start with a relevant emoji (📈 📉 🏆 🔄 ⚠️ 🚀 💡 🎯 etc.)
- Be specific: mention brand names, scores, and rank movements
- Focus on changes: who moved up, who dropped, new leaders, surprising shifts
- Keep each bullet to 1–2 concise sentences
- Do NOT include headers, markdown bold/italic, or any text outside the bullets
- Output ONLY the bullet list, nothing else`;
}


// ─── AI Callers ──────────────────────────────────────────────────────────────

// Retry delays: 30s → 60s → 90s (increasing gap for GitHub Actions rate limits)
const RETRY_DELAYS_MS = [30_000, 60_000, 90_000];

const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

// All models to try in order (Vertex Gemini primary → Groq backup → NVIDIA fallback)
interface ModelConfig {
  provider: 'nvidia' | 'groq' | 'vertex-gemini';
  model: string;
  label: string;
  baseUrl?: string;
  apiKeyField?: 'NVIDIA_API_KEY' | 'GROQ_API_KEY';
}

const MODEL_CHAIN: ModelConfig[] = [
  { provider: 'vertex-gemini', model: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash (Vertex)' },
  { provider: 'groq', model: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B (Groq)', baseUrl: GROQ_BASE_URL, apiKeyField: 'GROQ_API_KEY' },
  { provider: 'groq', model: 'groq/compound', label: 'Compound (Groq)', baseUrl: GROQ_BASE_URL, apiKeyField: 'GROQ_API_KEY' },
  { provider: 'groq', model: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (Groq)', baseUrl: GROQ_BASE_URL, apiKeyField: 'GROQ_API_KEY' },
  { provider: 'nvidia', model: 'nvidia/nemotron-3-ultra-550b-a55b', label: 'Nemotron Ultra (NVIDIA)', baseUrl: NVIDIA_BASE_URL, apiKeyField: 'NVIDIA_API_KEY' },
  { provider: 'nvidia', model: 'stepfun-ai/step-3.7-flash', label: 'Step 3.7 Flash (NVIDIA)', baseUrl: NVIDIA_BASE_URL, apiKeyField: 'NVIDIA_API_KEY' },
  { provider: 'nvidia', model: 'z-ai/glm-5.1', label: 'GLM 5.1 (NVIDIA)', baseUrl: NVIDIA_BASE_URL, apiKeyField: 'NVIDIA_API_KEY' },
];

async function callModel(config: ModelConfig, prompt: string): Promise<string> {
  if (config.provider === 'vertex-gemini') {
    const res = await queryVertexGeminiRaw(prompt, config.model);
    return res.text;
  }

  const env = getEnv();
  const apiKey = config.apiKeyField ? env[config.apiKeyField] : undefined;
  if (!apiKey) throw new Error(`${config.apiKeyField} is not configured`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000); // 60s timeout for insights

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.5,
        max_tokens: 2048,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`${config.label} API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim() || '';
    if (!text) throw new Error(`${config.label} returned empty response`);
    return text;
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate an insight for an industry.
 * Tries NVIDIA models first, then Groq models as backup.
 * Waits 30s → 60s → 90s between failed attempts (for GitHub Actions rate limits).
 * Throws if all models fail.
 */
export async function generateInsight(
  prompt: string
): Promise<{ text: string; generatedBy: string }> {
  const env = getEnv();

  // Filter to models we have API keys for or GCP auth
  const availableModels = MODEL_CHAIN.filter(m => {
    if (m.provider === 'vertex-gemini') return true; // GCP credential-based (always assumed available)
    const key = m.apiKeyField ? env[m.apiKeyField] : undefined;
    return key && key.length > 0;
  });

  if (availableModels.length === 0) {
    throw new Error('No AI provider API keys configured (need Vertex Gemini, NVIDIA_API_KEY, or GROQ_API_KEY)');
  }

  for (let i = 0; i < availableModels.length; i++) {
    const config = availableModels[i];
    try {
      if (i > 0) console.log(`  ⏩ Trying ${config.label} fallback...`);
      const text = await callModel(config, prompt);
      return { text, generatedBy: `${config.provider}-${config.model.split('/').pop()}` };
    } catch (err) {
      const msg = (err as Error).message || '';
      const isQuota = msg.includes('429') || msg.includes('quota') || msg.includes('rate');
      console.warn(`  ⚠ ${config.label} failed${isQuota ? ' (quota/rate-limit)' : ''}: ${msg.split('\n')[0]}`);

      // Wait with increasing delay before trying the next model (skip wait after the last)
      if (i < availableModels.length - 1) {
        const delay = RETRY_DELAYS_MS[Math.min(i, RETRY_DELAYS_MS.length - 1)];
        console.warn(`  ⏳ Waiting ${delay / 1000}s before trying next model...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`All AI models failed for insight generation`);
}

/**
 * Build the appropriate prompt based on whether a previous insight exists.
 */
export function buildInsightPrompt(
  industryName: string,
  todaySnapshot: IndustryDataSnapshot,
  previousSnapshot: IndustryDataSnapshot | null,
  previousInsight: { text: string; date: string } | null
): string {
  if (!previousInsight || !previousSnapshot) {
    // First time — need two snapshots
    if (previousSnapshot) {
      return buildFirstTimePrompt(industryName, previousSnapshot, todaySnapshot);
    }
    // Only one day of data — use simplified prompt
    return buildUpdatePrompt(industryName, '', '', todaySnapshot);
  }

  return buildUpdatePrompt(
    industryName,
    previousInsight.text,
    previousInsight.date,
    todaySnapshot
  );
}
