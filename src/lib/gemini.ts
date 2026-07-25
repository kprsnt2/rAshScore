/**
 * Gemini AI Provider — Primary model with fallback chain.
 * Uses Google Generative Language API at generativelanguage.googleapis.com.
 *
 * Primary: gemini-2.5-flash
 * Fallback: gemini-2.5-flash-lite
 */
import { getEnv } from "./env";
import { generateStructuredBrandPrompt, parseAIScoreResponse, AIScoreResponse } from "./prompts";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

// Model configuration
const GEMINI_PRIMARY_MODEL = "gemini-2.5-flash";
const GEMINI_FALLBACK_MODELS = [
    "gemini-2.5-flash-lite",
];

interface GeminiResponse {
    candidates: {
        content: {
            parts: {
                text: string;
            }[];
        };
        finishReason?: string;
    }[];
    usageMetadata?: {
        promptTokenCount: number;
        candidatesTokenCount: number;
        totalTokenCount: number;
    };
}

/**
 * Call Gemini API with Google Generative Language format.
 * Tries primary model, then iterates through fallbacks on failure.
 * If apiKeyOverride is provided, uses it instead of the env key.
 */
async function callGeminiAPI(
    prompt: string,
    maxTokens: number = 1000,
    temperature: number = 0.7,
    model?: string,
    apiKeyOverride?: string,
): Promise<{ text: string; modelUsed: string }> {
    const env = getEnv();
    const apiKey = apiKeyOverride || env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not configured");
    }

    const modelsToTry = model
        ? [model, ...GEMINI_FALLBACK_MODELS.filter(m => m !== model)]
        : [GEMINI_PRIMARY_MODEL, ...GEMINI_FALLBACK_MODELS];

    let lastError: Error | null = null;

    for (const currentModel of modelsToTry) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

            const response = await fetch(`${GEMINI_BASE_URL}/${currentModel}:generateContent?key=${apiKey}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature,
                        maxOutputTokens: maxTokens,
                    },
                }),
                signal: controller.signal,
            });

            clearTimeout(timeout);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Gemini ${currentModel} API error: ${response.status} - ${errorText}`);
            }

            const data: GeminiResponse = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

            if (!text) {
                throw new Error(`Gemini ${currentModel} returned empty response`);
            }

            return { text, modelUsed: currentModel };
        } catch (error) {
            console.warn(`[Gemini ${currentModel}] Failed:`, error instanceof Error ? error.message : error);
            lastError = error instanceof Error ? error : new Error(String(error));
        }
    }

    throw lastError || new Error("All Gemini models failed");
}

export type { StructuredModelResponse } from './types';
import type { StructuredModelResponse } from './types';

/**
 * Query Gemini for brand analysis with structured JSON scoring.
 */
export async function queryGemini(brand: string, category: string): Promise<StructuredModelResponse> {
    const prompt = generateStructuredBrandPrompt(brand, category);

    const { text, modelUsed } = await callGeminiAPI(
        prompt,
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
        model: `${displayModel} (Gemini)`,
        modelType: "free" as const,
        structured: structured || undefined,
    };
}

/**
 * Query Gemini with a raw prompt (used by pipeline for batch scoring).
 */
export async function queryGeminiRaw(prompt: string, model?: string): Promise<{ text: string; model: string }> {
    const { text, modelUsed } = await callGeminiAPI(
        prompt,
        8000,
        0.3,
        model,
    );

    const displayModel = modelUsed.includes("/")
        ? modelUsed.split("/").pop() || modelUsed
        : modelUsed;
    return { text, model: `${displayModel} (Gemini)` };
}

/**
 * Query Gemini for brand comparison.
 */
export async function queryGeminiComparison(prompt: string): Promise<string> {
    const { text } = await callGeminiAPI(
        prompt,
        2000,
        0.7,
    );
    return text;
}
