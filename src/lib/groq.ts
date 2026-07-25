/**
 * Groq AI Provider — Primary model with fallback chain.
 * Uses OpenAI-compatible API at api.groq.com.
 *
 * Primary: openai/gpt-oss-120b
 * Fallbacks: groq/compound → llama-3.3-70b-versatile → llama-3.1-8b-instant
 */
import { getEnv } from "./env";
import { generateStructuredBrandPrompt, parseAIScoreResponse, AIScoreResponse } from "./prompts";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

// Model configuration
const GROQ_PRIMARY_MODEL = "openai/gpt-oss-120b";
const GROQ_FALLBACK_MODELS = [
    "groq/compound",
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
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
 * Call Groq API with OpenAI-compatible format.
 * Tries primary model, then iterates through fallbacks on failure.
 */
async function callGroqAPI(
    messages: { role: string; content: string }[],
    maxTokens: number = 1000,
    temperature: number = 0.7,
    model?: string,
): Promise<{ text: string; modelUsed: string }> {
    const env = getEnv();
    if (!env.GROQ_API_KEY) {
        throw new Error("GROQ_API_KEY is not configured");
    }

    const modelsToTry = model
        ? [model, ...GROQ_FALLBACK_MODELS.filter(m => m !== model)]
        : [GROQ_PRIMARY_MODEL, ...GROQ_FALLBACK_MODELS];

    let lastError: Error | null = null;

    for (const currentModel of modelsToTry) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

            const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${env.GROQ_API_KEY}`,
                },
                body: JSON.stringify({
                    model: currentModel,
                    messages,
                    temperature,
                    max_tokens: maxTokens,
                }),
                signal: controller.signal,
            });

            clearTimeout(timeout);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Groq ${currentModel} API error: ${response.status} - ${errorText}`);
            }

            const data: OpenAIResponse = await response.json();
            const text = data.choices[0]?.message?.content || "";

            if (!text) {
                throw new Error(`Groq ${currentModel} returned empty response`);
            }

            return { text, modelUsed: currentModel };
        } catch (error) {
            console.warn(`[Groq ${currentModel}] Failed:`, error instanceof Error ? error.message : error);
            lastError = error instanceof Error ? error : new Error(String(error));
        }
    }

    throw lastError || new Error("All Groq models failed");
}

export type { StructuredModelResponse } from './types';
import type { StructuredModelResponse } from './types';

/**
 * Query Groq for brand analysis with structured JSON scoring.
 */
export async function queryGroq(brand: string, category: string): Promise<StructuredModelResponse> {
    const prompt = generateStructuredBrandPrompt(brand, category);

    const { text, modelUsed } = await callGroqAPI(
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
        model: `${displayModel} (Groq)`,
        modelType: "free" as const,
        structured: structured || undefined,
    };
}

/**
 * Query Groq with a raw prompt (used by pipeline for batch scoring).
 */
export async function queryGroqRaw(prompt: string, model?: string): Promise<{ text: string; model: string }> {
    const { text, modelUsed } = await callGroqAPI(
        [{ role: 'user', content: prompt }],
        8000,
        0.3,
        model,
    );

    const displayModel = modelUsed.includes("/")
        ? modelUsed.split("/").pop() || modelUsed
        : modelUsed;
    return { text, model: `${displayModel} (Groq)` };
}

/**
 * Query Groq for brand comparison.
 */
export async function queryGroqComparison(prompt: string): Promise<string> {
    const { text } = await callGroqAPI(
        [{ role: "user", content: prompt }],
        2000,
        0.7,
    );
    return text;
}
