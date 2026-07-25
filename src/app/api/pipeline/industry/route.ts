import { NextRequest, NextResponse } from "next/server";
import { BrandAnalysisPipeline } from "@/lib/pipeline";
import { validateBrandInput } from "@/lib/validation";
import { getEnv } from "@/lib/env";

// Simple in-memory rate limiter
import { LRUCache } from "@/lib/cache";

const rateLimiter = new LRUCache<{ count: number; resetTime: number }>(100);

function getRateLimitKey(request: NextRequest): string {
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0] : "unknown";
    return ip.trim();
}

function checkRateLimit(key: string): { allowed: boolean; remaining: number; resetIn: number } {
    const env = getEnv();
    const now = Date.now();
    const windowMs = env.RATE_LIMIT_WINDOW_MS * 10; // Longer window for pipeline
    const maxRequests = Math.floor(env.RATE_LIMIT_REQUESTS / 5); // Fewer requests for pipeline

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
        // Rate limiting
        const rateLimitKey = getRateLimitKey(request);
        const rateLimit = checkRateLimit(rateLimitKey);

        if (!rateLimit.allowed) {
            return errorResponse(
                `Pipeline rate limit exceeded. Try again in ${Math.ceil(rateLimit.resetIn / 1000)} seconds.`,
                429,
                "PIPELINE_RATE_LIMIT_EXCEEDED"
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

        const { category } = validation.data;
        
        // Extract industry ID from category or use category directly
        const industryId = category;

        // Initialize pipeline with conservative settings for API usage
        const pipeline = new BrandAnalysisPipeline({
            delayBetweenIndustries: 5000,
            timeoutMs: 120000,
        });

        // Run pipeline analysis
        console.log(`Starting pipeline analysis for industry: ${industryId}`);
        const result = await pipeline.analyzeIndustry(industryId);

        const responseTime = Date.now() - startTime;

        // Add rate limit headers
        const response = NextResponse.json({
            industry: result.industry,
            brandResults: result.brandResults,
            industryAverage: result.industryAverage,
            topPerformers: result.topPerformers,
            bottomPerformers: result.bottomPerformers,
            summary: {
                totalBrands: result.brandResults.length,
                successfulAnalyses: result.brandResults.filter(r => !r.error).length,
                failedAnalyses: result.brandResults.filter(r => r.error).length,
                averageScore: result.industryAverage.score,
                highestScore: Math.max(...result.brandResults.filter(r => !r.error).map(r => r.score)),
                lowestScore: Math.min(...result.brandResults.filter(r => !r.error).map(r => r.score))
            },
            meta: {
                responseTime,
                timestamp: result.timestamp,
                pipelineConfig: {
                    batchMode: true,
                    timeoutMs: 120000
                }
            }
        });

        response.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));
        response.headers.set("X-RateLimit-Reset", String(Math.ceil(rateLimit.resetIn / 1000)));

        return response;
    } catch (error) {
        console.error("Error in pipeline API:", error);

        if (error instanceof Error && error.message.includes("not found")) {
            return errorResponse(
                "Industry not found. Please check the industry ID.",
                404,
                "INDUSTRY_NOT_FOUND"
            );
        }

        return errorResponse(
            "Pipeline execution failed. Please try again.",
            500,
            "PIPELINE_ERROR"
        );
    }
}

export async function GET() {
    return NextResponse.json({
        message: "Industry pipeline endpoint",
        usage: "POST with { category: 'industry-id' }",
        availableIndustries: [
            "technology",
            "automotive", 
            "ecommerce",
            "fashion",
            "food-beverage",
            "healthcare",
            "finance",
            "telecom",
            "entertainment",
            "travel",
            "energy",
            "fmcg",
            "realestate",
            "edtech",
            "logistics"
        ]
    });
}
