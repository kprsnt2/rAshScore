/**
 * Vertex AI Claude Provider
 * Connects to Google Cloud Vertex AI REST API for Anthropic Claude models.
 * 
 * Primary: claude-sonnet-5
 * Backup: claude-sonnet-4@20250514
 * 
 * Note: Model naming conventions in Vertex AI Model Garden differ slightly from Anthropic API.
 * As of mid-2026, Claude Sonnet 5 uses a dateless ID format.
 */
import { getAccessToken, getProjectId, getRegion } from './gcp-auth';

// User can override the exact model string via the pipeline arguments
const VERTEX_CLAUDE_PRIMARY = "claude-sonnet-5";
const VERTEX_CLAUDE_FALLBACK = "claude-sonnet-4";

interface VertexClaudeResponse {
    content: {
        text: string;
        type: string;
    }[];
    stop_reason?: string;
    usage?: {
        input_tokens: number;
        output_tokens: number;
    };
}

/**
 * Call Vertex AI Claude REST API.
 * Uses the Anthropic Messages API format wrapped for Vertex.
 */
async function callVertexClaudeAPI(
    prompt: string,
    maxTokens: number = 8000,
    temperature: number = 0.3,
    model?: string,
): Promise<{ text: string; modelUsed: string }> {
    const token = await getAccessToken();
    const projectId = getProjectId();
    const region = getRegion();

    const modelsToTry = model
        ? [model, VERTEX_CLAUDE_FALLBACK].filter((m, i, self) => self.indexOf(m) === i)
        : [VERTEX_CLAUDE_PRIMARY, VERTEX_CLAUDE_FALLBACK];

    let lastError: Error | null = null;

    for (const currentModel of modelsToTry) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout for Claude

            // Vertex AI Global Endpoint for Anthropic (Claude models use global, not regional)
            const url = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/publishers/anthropic/models/${currentModel}:rawPredict`;

            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    anthropic_version: "vertex-2023-10-16",
                    messages: [
                        { role: "user", content: prompt }
                    ],
                    max_tokens: maxTokens,
                    temperature: temperature,
                }),
                signal: controller.signal,
            });

            clearTimeout(timeout);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Vertex Claude ${currentModel} API error: ${response.status} - ${errorText}`);
            }

            const data: VertexClaudeResponse = await response.json();
            const text = data.content?.[0]?.text || "";

            if (!text) {
                throw new Error(`Vertex Claude ${currentModel} returned empty response`);
            }

            return { text, modelUsed: currentModel };
        } catch (error) {
            console.warn(`[Vertex Claude ${currentModel}] Failed:`, error instanceof Error ? error.message : error);
            lastError = error instanceof Error ? error : new Error(String(error));
        }
    }

    throw lastError || new Error("All Vertex Claude models failed");
}

/**
 * Query Vertex Claude with a raw prompt (used by pipeline for batch scoring).
 */
export async function queryVertexClaudeRaw(prompt: string, model?: string): Promise<{ text: string; model: string }> {
    const { text, modelUsed } = await callVertexClaudeAPI(
        prompt,
        8000,
        0.3,
        model,
    );

    const displayModel = modelUsed.split("@")[0] || modelUsed;
    return { text, model: `${displayModel} (Vertex)` };
}
