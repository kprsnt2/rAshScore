import { NextRequest, NextResponse } from "next/server";
import { queryNvidia } from "@/lib/nvidia";
import { queryGroq } from "@/lib/groq";
import { calculateLLMOScore, analyzeSentiment, countBrandMentions, generateTips, aggregateStructuredScores, Breakdown } from "@/lib/scoring";
import { validateBrandInput } from "@/lib/validation";
import { hasApiKeys } from "@/lib/env";
import { AIScoreResponse } from "@/lib/prompts";

// Simple in-memory rate limiter
import { LRUCache } from "@/lib/cache";

// LRU Cache for rate limiting (max 1000 IPs tracked)
const rateLimiter = new LRUCache<{ count: number; resetTime: number }>(1000);

function getRateLimitKey(request: NextRequest): string {
    // Use IP address or forwarded header
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0] : "unknown";
    return ip.trim();
}

function checkRateLimit(key: string): { allowed: boolean; remaining: number; resetIn: number } {
    const { getEnv } = require("@/lib/env");
    const env = getEnv();
    const now = Date.now();
    const windowMs = env.RATE_LIMIT_WINDOW_MS;
    const maxRequests = env.RATE_LIMIT_REQUESTS;

    const existing = rateLimiter.get(key);

    if (!existing || now > existing.resetTime) {
        rateLimiter.set(key, { count: 1, resetTime: now + windowMs });
        return { allowed: true, remaining: maxRequests - 1, resetIn: windowMs };
    }

    if (existing.count >= maxRequests) {
        return { allowed: false, remaining: 0, resetIn: existing.resetTime - now };
    }

    // Update count
    existing.count++;

    return { allowed: true, remaining: maxRequests - existing.count, resetIn: existing.resetTime - now };
}

// Error response helper
function errorResponse(message: string, status: number, code?: string) {
    return NextResponse.json(
        { error: message, code: code || "ERROR" },
        { status }
    );
}

/**
 * Try to find existing brand data in the DB before calling AI.
 */
async function findBrandInDb(brand: string, category: string) {
    try {
        const { getDb } = await import("@/lib/db");
        const db = await getDb();

        // 1. Check live_search_results first (user-initiated searches)
        const safeBrand = brand.replace(/'/g, "''");
        const safeCategory = category.replace(/'/g, "''");

        // Initialize the live_search_results table if it doesn't exist
        try {
            db.run(`CREATE TABLE IF NOT EXISTS live_search_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                brand TEXT NOT NULL,
                category TEXT NOT NULL,
                score INTEGER NOT NULL,
                recommendation INTEGER NOT NULL,
                sentiment INTEGER NOT NULL,
                prominence INTEGER NOT NULL,
                accuracy INTEGER NOT NULL,
                overall_sentiment TEXT,
                tips TEXT,
                responses TEXT,
                models_queried INTEGER,
                response_time_ms INTEGER,
                created_at TEXT DEFAULT (datetime('now'))
            )`);
        } catch {
            // Table might already exist, ignore
        }

        const liveResults = db.exec(
            `SELECT * FROM live_search_results WHERE brand COLLATE NOCASE = '${safeBrand}' AND category = '${safeCategory}' ORDER BY created_at DESC LIMIT 1`
        );

        if (liveResults.length > 0 && liveResults[0].values.length > 0) {
            const cols = liveResults[0].columns;
            const vals = liveResults[0].values[0];
            const row: Record<string, unknown> = {};
            cols.forEach((c, i) => row[c] = vals[i]);

            return {
                source: "database" as const,
                brand: String(row.brand),
                category: String(row.category),
                score: Number(row.score),
                breakdown: {
                    recommendation: Number(row.recommendation),
                    sentiment: Number(row.sentiment),
                    prominence: Number(row.prominence),
                    accuracy: Number(row.accuracy),
                },
                overallSentiment: (String(row.overall_sentiment) || "neutral") as "positive" | "neutral" | "negative",
                tips: JSON.parse(String(row.tips || "[]")),
                responses: JSON.parse(String(row.responses || "[]")),
                meta: {
                    responseTime: 0,
                    modelsQueried: Number(row.models_queried) || 0,
                    structuredResponses: 0,
                    timestamp: String(row.created_at),
                    source: "database",
                },
            };
        }

        // 2. Check pipeline brand_results (from scheduled pipeline runs)
        const pipelineResults = db.exec(
            `SELECT br.*, pr.run_date FROM brand_results br
             JOIN pipeline_runs pr ON br.run_id = pr.id
             WHERE br.brand COLLATE NOCASE = '${safeBrand}' AND br.model IS NULL AND br.score > 0
             ORDER BY pr.run_date DESC LIMIT 1`
        );

        if (pipelineResults.length > 0 && pipelineResults[0].values.length > 0) {
            const cols = pipelineResults[0].columns;
            const vals = pipelineResults[0].values[0];
            const row: Record<string, unknown> = {};
            cols.forEach((c, i) => row[c] = vals[i]);

            // Also get per-model data for this brand
            const modelResults = db.exec(
                `SELECT model, score, recommendation, sentiment, prominence, accuracy
                 FROM brand_results
                 WHERE run_id = ${row.run_id} AND brand COLLATE NOCASE = '${safeBrand}' AND model IS NOT NULL AND score > 0
                 ORDER BY score DESC`
            );

            const modelResponses: Array<{
                model: string;
                modelType: "free" | "pro";
                text: string;
                sentiment: "positive" | "neutral" | "negative";
                mentionsCount: number;
            }> = [];

            if (modelResults.length > 0) {
                const mCols = modelResults[0].columns;
                for (const mVals of modelResults[0].values) {
                    const mRow: Record<string, unknown> = {};
                    mCols.forEach((c, i) => mRow[c] = mVals[i]);
                    modelResponses.push({
                        model: String(mRow.model),
                        modelType: "free",
                        text: `Score: ${mRow.score}/100 (Rec: ${mRow.recommendation}/40, Sent: ${mRow.sentiment}/30, Prom: ${mRow.prominence}/20, Acc: ${mRow.accuracy}/10)`,
                        sentiment: "neutral",
                        mentionsCount: 0,
                    });
                }
            }

            return {
                source: "database" as const,
                brand: String(row.brand),
                category: String(row.category || category),
                score: Number(row.score),
                breakdown: {
                    recommendation: Number(row.recommendation),
                    sentiment: Number(row.sentiment),
                    prominence: Number(row.prominence),
                    accuracy: Number(row.accuracy),
                },
                overallSentiment: "neutral" as const,
                tips: [
                    `Data from pipeline run on ${row.run_date}. Use "Re-analyze with AI" for fresh results.`
                ],
                responses: modelResponses,
                meta: {
                    responseTime: 0,
                    modelsQueried: modelResponses.length,
                    structuredResponses: 0,
                    timestamp: String(row.run_date),
                    source: "database",
                },
            };
        }

        return null;
    } catch (error) {
        console.warn("DB lookup failed, falling back to AI:", error);
        return null;
    }
}

/**
 * Save AI analysis results to the live_search_results table.
 */
async function saveBrandToDb(data: {
    brand: string;
    category: string;
    score: number;
    breakdown: Breakdown;
    overallSentiment: string;
    tips: string[];
    responses: unknown[];
    modelsQueried: number;
    responseTime: number;
}) {
    try {
        const { getDb } = await import("@/lib/db");
        const db = await getDb();

        const safeBrand = data.brand.replace(/'/g, "''");
        const safeCategory = data.category.replace(/'/g, "''");
        const safeSentiment = data.overallSentiment.replace(/'/g, "''");
        const safeTips = JSON.stringify(data.tips).replace(/'/g, "''");
        const safeResponses = JSON.stringify(data.responses).replace(/'/g, "''");

        // Initialize table if needed
        try {
            db.run(`CREATE TABLE IF NOT EXISTS live_search_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                brand TEXT NOT NULL,
                category TEXT NOT NULL,
                score INTEGER NOT NULL,
                recommendation INTEGER NOT NULL,
                sentiment INTEGER NOT NULL,
                prominence INTEGER NOT NULL,
                accuracy INTEGER NOT NULL,
                overall_sentiment TEXT,
                tips TEXT,
                responses TEXT,
                models_queried INTEGER,
                response_time_ms INTEGER,
                created_at TEXT DEFAULT (datetime('now'))
            )`);
        } catch {
            // Table might already exist
        }

        // Delete old entry for same brand+category if exists
        db.run(`DELETE FROM live_search_results WHERE brand COLLATE NOCASE = '${safeBrand}' AND category = '${safeCategory}'`);

        // Insert new result
        db.run(`INSERT INTO live_search_results (brand, category, score, recommendation, sentiment, prominence, accuracy, overall_sentiment, tips, responses, models_queried, response_time_ms)
                VALUES ('${safeBrand}', '${safeCategory}', ${data.score}, ${data.breakdown.recommendation}, ${data.breakdown.sentiment}, ${data.breakdown.prominence}, ${data.breakdown.accuracy}, '${safeSentiment}', '${safeTips}', '${safeResponses}', ${data.modelsQueried}, ${data.responseTime})`);

        // Export updated DB to file
        // Vercel serverless has read-only filesystem — use /tmp/ there
        const fs = await import("fs");
        const path = await import("path");
        const dbData = db.export();
        const isVercel = !!process.env.VERCEL;
        const dbPath = isVercel
            ? path.join("/tmp", "brand-intelligence.db")
            : path.join(process.cwd(), "data", "brand-intelligence.db");
        fs.writeFileSync(dbPath, Buffer.from(dbData));

        console.log(`✅ Saved brand "${data.brand}" to live_search_results`);
    } catch (error) {
        console.error("Failed to save brand to DB:", error);
        // Don't throw — saving is best-effort, don't break the user's response
    }
}

export async function POST(request: NextRequest) {
    const startTime = Date.now();

    try {
        // Rate limiting
        const rateLimitKey = getRateLimitKey(request);
        const rateLimit = checkRateLimit(rateLimitKey);

        if (!rateLimit.allowed) {
            return errorResponse(
                `Rate limit exceeded. Try again in ${Math.ceil(rateLimit.resetIn / 1000)} seconds.`,
                429,
                "RATE_LIMIT_EXCEEDED"
            );
        }

        // Parse request body
        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return errorResponse("Invalid JSON in request body", 400, "INVALID_JSON");
        }

        // Validate input
        const validation = validateBrandInput(body);
        if (!validation.success) {
            return errorResponse(validation.error, 400, "VALIDATION_ERROR");
        }

        const { brand, category } = validation.data;

        // ===== STEP 1: Check DB first =====
        const dbResult = await findBrandInDb(brand, category);

        if (dbResult) {
            const response = NextResponse.json({
                ...dbResult,
                meta: {
                    ...dbResult.meta,
                    responseTime: Date.now() - startTime,
                },
            });
            response.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));
            response.headers.set("X-RateLimit-Reset", String(Math.ceil(rateLimit.resetIn / 1000)));
            return response;
        }

        // ===== STEP 2: Not in DB — query AI providers =====
        const apiKeys = hasApiKeys();
        if (!apiKeys.nvidia && !apiKeys.groq) {
            return errorResponse(
                "No AI providers configured. Please set NVIDIA_API_KEY and/or GROQ_API_KEY.",
                503,
                "NO_API_KEYS"
            );
        }

        // Groq = primary, NVIDIA = backup (sequential, not parallel)
        type ModelResult = {
            text: string;
            model: string;
            modelType: "free" | "pro";
            structured?: AIScoreResponse;
            error?: unknown;
        };

        const results: ModelResult[] = [];

        // Step A: Try Groq first (fast, reliable)
        if (apiKeys.groq) {
            try {
                const groqResult = await queryGroq(brand, category);
                results.push(groqResult);
                console.log(`✅ Groq responded for "${brand}"`);
            } catch (e) {
                console.warn(`⚠ Groq failed for "${brand}":`, e instanceof Error ? e.message : e);
            }
        }

        // Step B: Only try NVIDIA if Groq failed or not configured
        if (results.filter(r => !r.error).length === 0 && apiKeys.nvidia) {
            try {
                const nvidiaResult = await queryNvidia(brand, category);
                results.push(nvidiaResult);
                console.log(`✅ NVIDIA responded for "${brand}" (fallback)`);
            } catch (e) {
                console.warn(`⚠ NVIDIA also failed for "${brand}":`, e instanceof Error ? e.message : e);
            }
        }

        // Filter out complete failures
        const validResults = results.filter(r => !r.error || r.text.length > 0);

        if (validResults.length === 0) {
            return errorResponse(
                "All AI providers failed to respond. Please try again.",
                502,
                "ALL_PROVIDERS_FAILED"
            );
        }

        // Collect structured responses for aggregation
        const structuredResponses: AIScoreResponse[] = validResults
            .filter(r => r.structured)
            .map(r => r.structured as AIScoreResponse);

        let score: number;
        let breakdown: Breakdown;
        let tips: string[];
        let overallSentiment: "positive" | "neutral" | "negative";

        // Use structured scoring if we have at least one structured response
        if (structuredResponses.length > 0) {
            const aggregated = aggregateStructuredScores(structuredResponses);
            score = aggregated.score;
            breakdown = aggregated.breakdown;
            tips = aggregated.tips;
            overallSentiment = aggregated.overallSentiment;
        } else {
            // FALLBACK: Use keyword-based scoring
            const scoringInputs = validResults.map(r => ({ text: r.text, brand }));
            const calculated = calculateLLMOScore(scoringInputs);
            score = calculated.score;
            breakdown = calculated.breakdown;
            tips = generateTips(score, breakdown, brand);
            // Use first valid response for sentiment
            overallSentiment = validResults.length > 0
                ? analyzeSentiment(validResults[0].text)
                : "neutral";
        }

        // Process responses for display (include analysis from structured data if available)
        const responses = validResults.map(result => {
            if (result.structured) {
                return {
                    model: result.model,
                    modelType: result.modelType,
                    text: result.structured.analysis.description,
                    sentiment: result.structured.overallSentiment,
                    mentionsCount: countBrandMentions(result.text, brand),
                    analysis: result.structured.analysis,
                    scores: result.structured.scores,
                };
            }
            // Fallback for non-structured responses
            return {
                model: result.model,
                modelType: result.modelType,
                text: result.text,
                sentiment: analyzeSentiment(result.text),
                mentionsCount: countBrandMentions(result.text, brand),
            };
        });

        const responseTime = Date.now() - startTime;

        // ===== STEP 3: Save to DB for next time =====
        saveBrandToDb({
            brand,
            category,
            score,
            breakdown,
            overallSentiment,
            tips,
            responses,
            modelsQueried: validResults.length,
            responseTime,
        });

        // Add rate limit headers
        const response = NextResponse.json({
            brand,
            category,
            score,
            responses,
            breakdown,
            tips,
            overallSentiment,
            source: "ai",
            meta: {
                responseTime,
                modelsQueried: validResults.length,
                structuredResponses: structuredResponses.length,
                timestamp: new Date().toISOString(),
                source: "ai",
            },
        });

        response.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));
        response.headers.set("X-RateLimit-Reset", String(Math.ceil(rateLimit.resetIn / 1000)));

        return response;
    } catch (error) {
        console.error("Error in check-brand API:", error);

        if (error instanceof Error && error.message === "Request timeout") {
            return errorResponse("Request timed out. Please try again.", 504, "TIMEOUT");
        }

        return errorResponse(
            "An unexpected error occurred. Please try again.",
            500,
            "INTERNAL_ERROR"
        );
    }
}

// OPTIONS for CORS preflight
export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        },
    });
}
