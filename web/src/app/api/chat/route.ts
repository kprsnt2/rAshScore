import { streamText, tool } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import * as bq from '@/lib/bq';
import { NextResponse } from 'next/server';

// Allow responses up to 60 seconds
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured.' },
        { status: 500 }
      );
    }
    
    // Create a custom google instance if we are not using the default env var name
    // But @ai-sdk/google expects GOOGLE_GENERATIVE_AI_API_KEY by default.
    // We can inject it into the env for the provider.
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
        process.env.GOOGLE_GENERATIVE_AI_API_KEY = apiKey;
    }

    const result = await streamText({
      model: google('gemini-2.5-flash'),
      messages,
      system: `You are the rAsh Score AI Assistant, an expert in brand visibility and AI search rankings in India.
      You help users understand how AI models perceive different brands.
      
      Always use the provided tools to query real data. Never guess brand scores or rankings.
      If a user asks about a specific brand, use get_brand_score.
      If a user asks about an industry leader, use get_industry_rankings.
      If a user asks for AI insights, use get_brand_insight.
      If a user asks to compare brands, use compare_brands.
      
      Keep your responses concise, punchy, and analytical. Use formatting (bolding, lists) to make data easy to read.`,
      tools: {
        get_brand_score: tool({
          description: 'Get the rAsh Score breakdown for a specific brand',
          parameters: z.object({
            brand: z.string().describe("The name of the brand (e.g., 'Flipkart')")
          }),
          execute: async ({ brand }: { brand: string }) => {
            const date = await bq.getLatestRunDate();
            if (!date) return { error: "No data available." };
            return (await bq.getBrandScore(brand, date)) || { error: `Brand '${brand}' not found.` };
          }
        }),
        get_industry_rankings: tool({
          description: 'Get top ranked brands for a specific industry',
          parameters: z.object({
            industry: z.string().describe("The ID of the industry (e.g., 'technology', 'ecommerce')"),
            limit: z.number().optional().describe("Number of top brands to return (default: 5)")
          }),
          execute: async ({ industry, limit }: { industry: string; limit?: number }) => {
            const date = await bq.getLatestRunDate();
            if (!date) return { error: "No data available." };
            return await bq.getIndustryRankings(industry, date, limit || 5);
          }
        }),
        get_brand_insight: tool({
          description: 'Get the latest AI-generated narrative insight for an industry',
          parameters: z.object({
            industry: z.string().describe("The ID of the industry (e.g., 'ecommerce')")
          }),
          execute: async ({ industry }: { industry: string }) => {
            return (await bq.getLatestInsight(industry)) || { error: `No insights found for industry '${industry}'.` };
          }
        }),
        search_brands: tool({
          description: 'Search for brands across all industries',
          parameters: z.object({
            query: z.string().describe("The search term")
          }),
          execute: async ({ query }: { query: string }) => {
            const date = await bq.getLatestRunDate();
            if (!date) return { error: "No data available." };
            return await bq.searchBrands(query, date);
          }
        })
      },
      maxSteps: 3, // Allow the model to call a tool and then respond
    });

    return result.toDataStreamResponse();
  } catch (error: any) {
    console.error('Chat API Error:', error);
    return NextResponse.json(
      { error: 'An error occurred during your request.', details: error.message },
      { status: 500 }
    );
  }
}
