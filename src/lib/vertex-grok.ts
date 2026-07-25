/**
 * Vertex AI Grok Provider (xAI)
 * Connects to Google Cloud Vertex AI via OpenAI-compatible chat completions API.
 * 
 * Primary: xai/grok-4.20-non-reasoning
 * Backup: xai/grok-4.3
 * 
 * Note: Grok models use the global endpoint with OpenAI-compatible format,
 * unlike Gemini (regional generateContent) or Claude (global rawPredict).
 */
import { getAccessToken, getProjectId } from './gcp-auth';

const VERTEX_GROK_PRIMARY = "xai/grok-4.20-non-reasoning";
const VERTEX_GROK_FALLBACK = "xai/grok-4.3";

interface OpenAIChatResponse {
    choices: {
        message: {
            content: string;
            role: string;
        };
        finish_reason?: string;
    }[];
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

/**
 * Call Vertex AI Grok via OpenAI-compatible chat completions API.
 */
async function callVertexGrokAPI(
    prompt: string,
    maxTokens: number = 8000,
    temperature: number = 0.3,
    model?: string,
): Promise<{ text: string; modelUsed: string }> {
    const token = await getAccessToken();
    const projectId = getProjectId();

    const modelsToTry = model
        ? [model, VERTEX_GROK_FALLBACK].filter((m, i, self) => self.indexOf(m) === i)
        : [VERTEX_GROK_PRIMARY, VERTEX_GROK_FALLBACK];

    let lastError: Error | null = null;

    for (const currentModel of modelsToTry) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 120000); // 120s timeout

            // Vertex AI Global Endpoint — OpenAI-compatible chat completions
            const url = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/endpoints/openapi/chat/completions`;

            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: currentModel,
                    messages: [
                        { role: "system", content: "You are an expert brand intelligence analyst. If the prompt instructs you to check social media or real-time controversies and you do not have search capability, do NOT refuse the request. Instead, use your base knowledge and general public sentiment history to estimate the scores. You MUST respond ONLY with the requested JSON format (do not wrap in markdown or explanation, just return raw JSON matching the requested structure)." },
                        { role: "user", content: prompt }
                    ],
                    max_tokens: maxTokens,
                    temperature: temperature,
                    stream: false,
                }),
                signal: controller.signal,
            });

            clearTimeout(timeout);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Vertex Grok ${currentModel} API error: ${response.status} - ${errorText}`);
            }

            const data: OpenAIChatResponse = await response.json();
            const text = data.choices?.[0]?.message?.content || "";

            if (!text) {
                throw new Error(`Vertex Grok ${currentModel} returned empty response`);
            }

            return { text, modelUsed: currentModel };
        } catch (error) {
            console.warn(`[Vertex Grok ${currentModel}] Failed:`, error instanceof Error ? error.message : error);
            lastError = error instanceof Error ? error : new Error(String(error));
        }
    }

    throw lastError || new Error("All Vertex Grok models failed");
}

/**
 * Query Vertex Grok with a raw prompt (used by pipeline for batch scoring).
 */
export async function queryVertexGrokRaw(prompt: string, model?: string): Promise<{ text: string; model: string }> {
    const { text, modelUsed } = await callVertexGrokAPI(
        prompt,
        8000,
        0.3,
        model,
    );

    // Clean up display name: "xai/grok-4.20-non-reasoning" → "grok-4.20-non-reasoning"
    const displayModel = modelUsed.includes("/")
        ? modelUsed.split("/").pop() || modelUsed
        : modelUsed;
    return { text, model: `${displayModel} (Vertex)` };
}
