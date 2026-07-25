/**
 * Vertex AI Gemini Provider
 * Connects to Google Cloud Vertex AI REST API for Gemini models.
 * 
 * Primary: gemini-3.5-flash
 * Backup: gemini-2.5-flash
 */
import { getAccessToken, getProjectId, getRegion } from './gcp-auth';
import { generateStructuredBrandPrompt, parseAIScoreResponse, AIScoreResponse } from './prompts';

const VERTEX_PRIMARY_MODEL = "gemini-3.5-flash";
const VERTEX_FALLBACK_MODELS = [
    "gemini-2.5-flash",
];

interface VertexGeminiResponse {
    candidates: {
        content: {
            parts: {
                text: string;
            }[];
        };
        finishReason?: string;
    }[];
}

/**
 * Call Vertex AI Gemini REST API.
 */
async function callVertexGeminiAPI(
    prompt: string,
    maxTokens: number = 1000,
    temperature: number = 0.7,
    model?: string,
): Promise<{ text: string; modelUsed: string }> {
    const token = await getAccessToken();
    const projectId = getProjectId();
    const region = getRegion();

    const modelsToTry = model
        ? [model, ...VERTEX_FALLBACK_MODELS.filter(m => m !== model)]
        : [VERTEX_PRIMARY_MODEL, ...VERTEX_FALLBACK_MODELS];

    let lastError: Error | null = null;

    for (const currentModel of modelsToTry) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 120000); // 120s timeout for batch calls

            // Vertex AI Endpoint (gemini-3.5-flash uses the global endpoint)
            const isGlobal = region === 'global' || currentModel === 'gemini-3.5-flash';
            const host = isGlobal ? 'aiplatform.googleapis.com' : `${region}-aiplatform.googleapis.com`;
            const loc = isGlobal ? 'global' : region;
            const url = `https://${host}/v1/projects/${projectId}/locations/${loc}/publishers/google/models/${currentModel}:generateContent`;

            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
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
                throw new Error(`Vertex Gemini ${currentModel} API error: ${response.status} - ${errorText}`);
            }

            const data: VertexGeminiResponse = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

            if (!text) {
                throw new Error(`Vertex Gemini ${currentModel} returned empty response`);
            }

            return { text, modelUsed: currentModel };
        } catch (error) {
            console.warn(`[Vertex Gemini ${currentModel}] Failed:`, error instanceof Error ? error.message : error);
            lastError = error instanceof Error ? error : new Error(String(error));
        }
    }

    throw lastError || new Error("All Vertex Gemini models failed");
}

/**
 * Query Vertex Gemini with a raw prompt (used by pipeline for batch scoring).
 */
export async function queryVertexGeminiRaw(prompt: string, model?: string): Promise<{ text: string; model: string }> {
    const { text, modelUsed } = await callVertexGeminiAPI(
        prompt,
        8000,
        0.3,
        model,
    );

    const displayModel = modelUsed.includes("/")
        ? modelUsed.split("/").pop() || modelUsed
        : modelUsed;
    return { text, model: `${displayModel} (Vertex)` };
}
