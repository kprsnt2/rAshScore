import { z } from "zod";

// Available categories for brand analysis
export const BRAND_CATEGORIES = [
    { value: "general", label: "General / Auto-detect" },
    { value: "technology", label: "Technology & IT" },
    { value: "automotive", label: "Automotive" },
    { value: "ecommerce", label: "Retail & E-Commerce" },
    { value: "fashion", label: "Fashion & Apparel" },
    { value: "food-beverage", label: "Food & Beverage" },
    { value: "healthcare", label: "Healthcare & Pharma" },
    { value: "finance", label: "Finance & Banking" },
    { value: "telecom", label: "Telecommunications" },
    { value: "entertainment", label: "Entertainment & Media" },
    { value: "travel", label: "Travel & Hospitality" },
    { value: "energy", label: "Energy & Oil" },
    { value: "fmcg", label: "Consumer Goods (FMCG)" },
    { value: "realestate", label: "Real Estate & Construction" },
    { value: "edtech", label: "Education & EdTech" },
    { value: "logistics", label: "Logistics & Supply Chain" },
    { value: "consumer-electronics", label: "Consumer Electronics" },
    { value: "mobile-phones", label: "Mobile Phones" },
    { value: "home-appliances", label: "Home Appliances" },
    { value: "two-wheelers", label: "Two Wheelers" },
] as const;

// Brand name validation schema
export const brandSchema = z.object({
    brand: z
        .string()
        .min(1, "Brand name is required")
        .max(100, "Brand name must be less than 100 characters")
        .regex(/^[a-zA-Z0-9\s\-\.&']+$/, "Brand name contains invalid characters")
        .transform((val) => val.trim()),
    category: z
        .string()
        .optional()
        .default("general"),
});

// API response schema for type safety
export const brandCheckResponseSchema = z.object({
    brand: z.string(),
    score: z.number().min(0).max(100),
    responses: z.array(
        z.object({
            model: z.string(),
            modelType: z.enum(["free", "pro"]),
            text: z.string(),
            sentiment: z.enum(["positive", "neutral", "negative"]),
            mentionsCount: z.number(),
        })
    ),
    breakdown: z.object({
        recommendation: z.number(),
        sentiment: z.number(),
        prominence: z.number(),
        accuracy: z.number(),
    }),
    tips: z.array(z.string()),
});

// Error response schema
export const errorResponseSchema = z.object({
    error: z.string(),
    code: z.string().optional(),
    details: z.unknown().optional(),
});

// Type exports
export type BrandInput = z.infer<typeof brandSchema>;
export type BrandCheckResponse = z.infer<typeof brandCheckResponseSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

// Validation helper
export function validateBrandInput(data: unknown): { success: true; data: BrandInput } | { success: false; error: string } {
    const result = brandSchema.safeParse(data);
    if (result.success) {
        return { success: true, data: result.data };
    }
    return { success: false, error: result.error.issues[0]?.message || "Invalid input" };
}
