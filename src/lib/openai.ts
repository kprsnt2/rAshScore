/**
 * OpenAI Provider — Primary model with fallback chain.
 * Uses OpenAI-compatible API at api.openai.com.
 *
 * Primary: gpt-5.4-mini
 * Fallback: gpt-5.4-nano
 */
import { getEnv } from "./env";
import { generateStructuredBrandPrompt, parseAIScoreResponse, AIScoreResponse } from "./prompts";

const OPENAI_BASE_URL = "https://api.openai.com/v1";

// Model configuration
const OPENAI_PRIMARY_MODEL = "gpt-5.4-mini";
const OPENAI_FALLBACK_MODELS = [
    "gpt-5.4-nano",
];

interface OpenAIResponse {
    id: string;
    choices: {
        index: number;
        message: {
            role: string;
            content: string;
        };
        finish_reason: string;
    }[];
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

/**
 * Call OpenAI API with OpenAI-compatible format.
 * Tries primary model, then iterates through fallbacks on failure.
 * If apiKeyOverride is provided, uses it instead of the env key.
 */
async function callOpenAIAPI(
    messages: { role: string; content: string }[],
    maxTokens: number = 1000,
    temperature: number = 0.7,
    model?: string,
    apiKeyOverride?: string,
): Promise<{ text: string; modelUsed: string }> {
    const env = getEnv();
    const apiKey = apiKeyOverride || env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error("OPENAI_API_KEY is not configured");
    }

    const modelsToTry = model
        ? [model, ...OPENAI_FALLBACK_MODELS.filter(m => m !== model)]
        : [OPENAI_PRIMARY_MODEL, ...OPENAI_FALLBACK_MODELS];

    let lastError: Error | null = null;

    for (const currentModel of modelsToTry) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

            const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: currentModel,
                    messages,
                    temperature,
                    max_completion_tokens: maxTokens,
                }),
                signal: controller.signal,
            });

            clearTimeout(timeout);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OpenAI ${currentModel} API error: ${response.status} - ${errorText}`);
            }

            const data: OpenAIResponse = await response.json();
            const text = data.choices[0]?.message?.content || "";

            if (!text) {
                throw new Error(`OpenAI ${currentModel} returned empty response`);
            }

            return { text, modelUsed: currentModel };
        } catch (error) {
            console.warn(`[OpenAI ${currentModel}] Failed:`, error instanceof Error ? error.message : error);
            lastError = error instanceof Error ? error : new Error(String(error));
        }
    }

    throw lastError || new Error("All OpenAI models failed");
}

export type { StructuredModelResponse } from './types';
import type { StructuredModelResponse } from './types';

/**
 * Query OpenAI for brand analysis with structured JSON scoring.
 */
export async function queryOpenAI(brand: string, category: string): Promise<StructuredModelResponse> {
    const prompt = generateStructuredBrandPrompt(brand, category);

    const { text, modelUsed } = await callOpenAIAPI(
        [{ role: "user", content: prompt }],
        1000,
        0.7,
    );

    // Extract display name
    const displayModel = modelUsed.includes("/")
        ? modelUsed.split("/").pop() || modelUsed
        : modelUsed;

    // Try to parse structured response
    const structured = parseAIScoreResponse(text);

    return {
        text,
        model: `${displayModel} (OpenAI)`,
        modelType: "free" as const,
        structured: structured || undefined,
    };
}

/**
 * Query OpenAI with a raw prompt (used by pipeline for batch scoring).
 */
export async function queryOpenAIRaw(prompt: string, model?: string): Promise<{ text: string; model: string }> {
    const { text, modelUsed } = await callOpenAIAPI(
        [{ role: "user", content: prompt }],
        8000,
        0.3,
        model,
    );

    const displayModel = modelUsed.includes("/")
        ? modelUsed.split("/").pop() || modelUsed
        : modelUsed;
    return { text, model: `${displayModel} (OpenAI)` };
}

/**
 * Query OpenAI for brand comparison.
 */
export async function queryOpenAIComparison(prompt: string): Promise<string> {
    const { text } = await callOpenAIAPI(
        [{ role: "user", content: prompt }],
        2000,
        0.7,
    );
    return text;
}
