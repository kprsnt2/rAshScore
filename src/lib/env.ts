import { z } from "zod";

// Environment variable schema
const envSchema = z.object({
    NVIDIA_API_KEY: z.string().optional().default(""),
    GROQ_API_KEY: z.string().optional().default(""),
    OPENAI_API_KEY: z.string().optional().default(""),
    GEMINI_API_KEY: z.string().optional().default(""),
    GROQ_API_KEY_2: z.string().optional().default(""),
    NVIDIA_API_KEY_2: z.string().optional().default(""),
    GEMINI_API_KEY_2: z.string().optional().default(""),
    GCP_PROJECT_ID: z.string().optional().default("rashscore"),
    GCP_REGION: z.string().optional().default("us-central1"),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    RATE_LIMIT_REQUESTS: z.coerce.number().default(10),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
    CACHE_TTL_MS: z.coerce.number().default(300000), // 5 minutes
});

type Env = z.infer<typeof envSchema>;

// Cache the validated env
let cachedEnv: Env | null = null;

/**
 * Get validated environment variables
 * Throws if required variables are missing
 */
export function getEnv(): Env {
    if (cachedEnv) return cachedEnv;

    const result = envSchema.safeParse(process.env);

    if (!result.success) {
        const missingVars = result.error.issues
            .map((e) => `${e.path.join(".")}: ${e.message}`)
            .join(", ");

        // In development, warn but don't crash
        if (process.env.NODE_ENV === "development") {
            console.warn(`⚠️ Environment validation warnings: ${missingVars}`);
            // Return defaults for development
            cachedEnv = {
                NVIDIA_API_KEY: process.env.NVIDIA_API_KEY || "",
                GROQ_API_KEY: process.env.GROQ_API_KEY || "",
                OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
                GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
                GROQ_API_KEY_2: process.env.GROQ_API_KEY_2 || "",
                NVIDIA_API_KEY_2: process.env.NVIDIA_API_KEY_2 || "",
                GEMINI_API_KEY_2: process.env.GEMINI_API_KEY_2 || "",
                GCP_PROJECT_ID: process.env.GCP_PROJECT_ID || "rashscore",
                GCP_REGION: process.env.GCP_REGION || "us-central1",
                NODE_ENV: "development",
                RATE_LIMIT_REQUESTS: 10,
                RATE_LIMIT_WINDOW_MS: 60000,
                CACHE_TTL_MS: 300000,
            };
            return cachedEnv;
        }

        throw new Error(`Environment validation failed: ${missingVars}`);
    }

    cachedEnv = result.data;
    return cachedEnv;
}

/**
 * Check if API keys are configured
 */
export function hasApiKeys(): { nvidia: boolean; groq: boolean; openai: boolean; gemini: boolean; vertexGemini: boolean; vertexClaude: boolean; vertexGrok: boolean } {
    const env = getEnv();
    
    // In GitHub actions, GCP credentials are provided via WIF (Application Default Credentials).
    // We assume Vertex is always available if the pipeline is running.
    const hasGcp = true; 
    
    return {
        nvidia: env.NVIDIA_API_KEY.length > 0,
        groq: env.GROQ_API_KEY.length > 0,
        openai: env.OPENAI_API_KEY.length > 0,
        gemini: env.GEMINI_API_KEY.length > 0,
        vertexGemini: hasGcp,
        vertexClaude: hasGcp,
        vertexGrok: hasGcp,
    };
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
    return getEnv().NODE_ENV === "production";
}
