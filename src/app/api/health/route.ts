import { NextResponse } from "next/server";
import { hasApiKeys, getEnv } from "@/lib/env";

export async function GET() {
    const startTime = Date.now();

    try {
        const apiKeys = hasApiKeys();
        const env = getEnv();

        const status = {
            status: "ok",
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: env.NODE_ENV,
            services: {
                nvidia: apiKeys.nvidia ? "configured" : "not_configured",
                groq: apiKeys.groq ? "configured" : "not_configured",
            },
            responseTime: 0,
        };

        status.responseTime = Date.now() - startTime;

        // Return degraded status if no providers configured
        if (!apiKeys.nvidia && !apiKeys.groq) {
            return NextResponse.json(
                { ...status, status: "degraded", message: "No AI providers configured" },
                { status: 503 }
            );
        }

        return NextResponse.json(status, { status: 200 });
    } catch (error) {
        console.error("Health check failed:", error);
        return NextResponse.json(
            {
                status: "error",
                timestamp: new Date().toISOString(),
                message: error instanceof Error ? error.message : "Unknown error",
                responseTime: Date.now() - startTime,
            },
            { status: 500 }
        );
    }
}
