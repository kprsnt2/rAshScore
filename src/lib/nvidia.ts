/**
 * NVIDIA AI Provider — Primary model with fallback chain.
 * Uses OpenAI-compatible API at integrate.api.nvidia.com.
 *
 * Primary: nvidia/nemotron-3-ultra-550b-a55b
 * Fallbacks: stepfun-ai/step-3.7-flash → z-ai/glm-5.1
 */
import { getEnv } from "./env";
import { generateStructuredBrandPrompt, parseAIScoreResponse, AIScoreResponse } from "./prompts";

const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";

// Model configuration
const NVIDIA_PRIMARY_MODEL = "nvidia/nemotron-3-ultra-550b-a55b";
const NVIDIA_FALLBACK_MODELS = [
    "stepfun-ai/step-3.7-flash",
    "z-ai/glm-5.1",
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
 * Call NVIDIA API with OpenAI-compatible format.
 * Tries primary model, then iterates through fallbacks on failure.
 */
async function callNvidiaAPI(
    messages: { role: string; content: string }[],
    maxTokens: number = 2000,
    temperature: number = 0.7,
    model?: string,
): Promise<{ text: string; modelUsed: string }> {
    const env = getEnv();
    if (!env.NVIDIA_API_KEY) {
        throw new Error("NVIDIA_API_KEY is not configured");
    }

    const modelsToTry = model
        ? [model, ...NVIDIA_FALLBACK_MODELS.filter(m => m !== model)]
        : [NVIDIA_PRIMARY_MODEL, ...NVIDIA_FALLBACK_MODELS];

    let lastError: Error | null = null;

    for (const currentModel of modelsToTry) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 12000); // 12s timeout (Vercel limit ~25s)

            const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${env.NVIDIA_API_KEY}`,
                },
                body: JSON.stringify({
                    model: currentModel,
                    messages,
                    temperature,
                    top_p: 0.95,
                    max_tokens: maxTokens,
                }),
                signal: controller.signal,
            });

            clearTimeout(timeout);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`NVIDIA ${currentModel} API error: ${response.status} - ${errorText}`);
            }

            const data: OpenAIResponse = await response.json();
            const text = data.choices[0]?.message?.content || "";

            if (!text) {
                throw new Error(`NVIDIA ${currentModel} returned empty response`);
            }

            return { text, modelUsed: currentModel };
        } catch (error) {
            console.warn(`[NVIDIA ${currentModel}] Failed:`, error instanceof Error ? error.message : error);
            lastError = error instanceof Error ? error : new Error(String(error));
        }
    }

    throw lastError || new Error("All NVIDIA models failed");
}

export type { StructuredModelResponse } from './types';
import type { StructuredModelResponse } from './types';

/**
 * Query NVIDIA for brand analysis with structured JSON scoring.
 */
export async function queryNvidia(brand: string, category: string): Promise<StructuredModelResponse> {
    const prompt = generateStructuredBrandPrompt(brand, category);

    const { text, modelUsed } = await callNvidiaAPI(
        [{ role: "user", content: prompt }],
        2000,
        0.7,
    );

    // Extract display name from model path
    const displayModel = modelUsed.split("/").pop() || modelUsed;

    // Try to parse structured response
    const structured = parseAIScoreResponse(text);

    return {
        text,
        model: `${displayModel} (NVIDIA)`,
        modelType: "free" as const,
        structured: structured || undefined,
    };
}

/**
 * Query NVIDIA with a raw prompt (used by pipeline for batch scoring).
 */
export async function queryNvidiaRaw(prompt: string, model?: string): Promise<{ text: string; model: string }> {
    const { text, modelUsed } = await callNvidiaAPI(
        [{ role: 'user', content: prompt }],
        8000,
        0.3,
        model,
    );

    const displayModel = modelUsed.split("/").pop() || modelUsed;
    return { text, model: `${displayModel} (NVIDIA)` };
}

/**
 * Query NVIDIA for brand comparison.
 */
export async function queryNvidiaComparison(prompt: string): Promise<string> {
    const { text } = await callNvidiaAPI(
        [{ role: "user", content: prompt }],
        2000,
        0.7,
    );
    return text;
}
