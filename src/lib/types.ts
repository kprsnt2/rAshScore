/**
 * Shared TypeScript interfaces used across multiple modules.
 * Extracted to eliminate code duplication between nvidia.ts and groq.ts.
 */
import type { AIScoreResponse } from './prompts';

/** Response from a structured AI model query (brand analysis with JSON scores) */
export interface StructuredModelResponse {
    text: string;
    model: string;
    modelType: "free" | "pro";
    structured?: AIScoreResponse;
}
