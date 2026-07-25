import { NextRequest, NextResponse } from "next/server";
import { BrandAnalysisPipeline } from "@/lib/pipeline";
import { getEnv } from "@/lib/env";

// Simple in-memory rate limiter
import { LRUCache } from "@/lib/cache";

const rateLimiter = new LRUCache<{ count: number; resetTime: number }>(50);

function getRateLimitKey(request: NextRequest): string {
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0] : "unknown";
    return ip.trim();
}

function checkRateLimit(key: string): { allowed: boolean; remaining: number; resetIn: number } {
    const env = getEnv();
    const now = Date.now();
    const windowMs = env.RATE_LIMIT_WINDOW_MS * 50; // Very long window for full pipeline
    const maxRequests = 1; // Only 1 full pipeline per window

    const existing = rateLimiter.get(key);

    if (!existing || now > existing.resetTime) {
        rateLimiter.set(key, { count: 1, resetTime: now + windowMs });
        return { allowed: true, remaining: maxRequests - 1, resetIn: windowMs };
    }

    if (existing.count >= maxRequests) {
        return { allowed: false, remaining: 0, resetIn: existing.resetTime - now };
    }

    existing.count++;
    return { allowed: true, remaining: maxRequests - existing.count, resetIn: existing.resetTime - now };
}

function errorResponse(message: string, status: number, code?: string) {
    return NextResponse.json(
        { error: message, code: code || "ERROR" },
        { status }
    );
}

export async function POST(request: NextRequest) {
    const startTime = Date.now();

    try {
        // Rate limiting - very strict for full pipeline
        const rateLimitKey = getRateLimitKey(request);
        const rateLimit = checkRateLimit(rateLimitKey);

        if (!rateLimit.allowed) {
            return errorResponse(
                `Full pipeline rate limit exceeded. Try again in ${Math.ceil(rateLimit.resetIn / 1000)} seconds.`,
                429,
                "FULL_PIPELINE_RATE_LIMIT_EXCEEDED"
            );
        }

        // Initialize pipeline with very conservative settings
        const pipeline = new BrandAnalysisPipeline({
            delayBetweenIndustries: 5000,
            timeoutMs: 120000,
        });

        console.log("Starting full pipeline analysis for all industries");
        const results = await pipeline.analyzeAllIndustries();

        const responseTime = Date.now() - startTime;

        // Calculate overall statistics
        const allBrandResults = results.flatMap(r => r.brandResults);
        const successfulAnalyses = allBrandResults.filter(r => !r.error);
        const failedAnalyses = allBrandResults.filter(r => r.error);

        const overallStats = {
            totalIndustries: results.length,
            totalBrands: allBrandResults.length,
            successfulAnalyses: successfulAnalyses.length,
            failedAnalyses: failedAnalyses.length,
            averageScore: successfulAnalyses.length > 0 
                ? Math.round(successfulAnalyses.reduce((sum, r) => sum + r.score, 0) / successfulAnalyses.length)
                : 0,
            highestScore: successfulAnalyses.length > 0 
                ? Math.max(...successfulAnalyses.map(r => r.score))
                : 0,
            lowestScore: successfulAnalyses.length > 0 
                ? Math.min(...successfulAnalyses.map(r => r.score))
                : 0,
            industriesCompleted: results.filter(r => !r.error).length,
            industriesFailed: results.filter(r => r.error).length
        };

        // Add rate limit headers
        const response = NextResponse.json({
            results,
            summary: overallStats,
            meta: {
                responseTime,
                timestamp: new Date().toISOString(),
                pipelineConfig: {
                    batchMode: true,
                    delayBetweenIndustries: 5000,
                    timeoutMs: 120000
                },
                estimatedCost: {
                    apiCalls: results.length * 3, // 1 per industry per model
                    processingTime: `${Math.round(responseTime / 1000)}s`
                }
            }
        });

        response.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));
        response.headers.set("X-RateLimit-Reset", String(Math.ceil(rateLimit.resetIn / 1000)));

        return response;
    } catch (error) {
        console.error("Error in full pipeline API:", error);

        return errorResponse(
            "Full pipeline execution failed. Please try again later.",
            500,
            "FULL_PIPELINE_ERROR"
        );
    }
}

export async function GET() {
    return NextResponse.json({
        message: "Full industries pipeline endpoint",
        usage: "POST to run analysis on all industries",
        warning: "This is a resource-intensive operation that analyzes 120+ brands across 12 industries",
        estimatedTime: "10-20 minutes depending on API response times",
        rateLimit: "1 request per hour per IP"
    });
}
