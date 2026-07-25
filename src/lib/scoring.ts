import { AIScoreResponse } from "./prompts";

export interface ScoringInput {
    text: string;
    brand: string;
}

export interface Breakdown {
    recommendation: number;  // 0-40
    sentiment: number;       // 0-30
    prominence: number;      // 0-20
    accuracy: number;        // 0-10
}

// Aggregate scores from multiple AI responses (averaging)
export function aggregateStructuredScores(responses: AIScoreResponse[]): {
    score: number;
    breakdown: Breakdown;
    tips: string[];
    overallSentiment: "positive" | "neutral" | "negative";
} {
    if (responses.length === 0) {
        return {
            score: 0,
            breakdown: { recommendation: 0, sentiment: 0, prominence: 0, accuracy: 0 },
            tips: [],
            overallSentiment: "neutral"
        };
    }

    // Average all scores
    const totals = responses.reduce((acc, r) => ({
        recommendation: acc.recommendation + r.scores.recommendation,
        sentiment: acc.sentiment + r.scores.sentiment,
        prominence: acc.prominence + r.scores.prominence,
        accuracy: acc.accuracy + r.scores.accuracy,
    }), { recommendation: 0, sentiment: 0, prominence: 0, accuracy: 0 });

    const count = responses.length;
    const breakdown: Breakdown = {
        recommendation: Math.round(totals.recommendation / count),
        sentiment: Math.round(totals.sentiment / count),
        prominence: Math.round(totals.prominence / count),
        accuracy: Math.round(totals.accuracy / count),
    };

    const score = Math.min(100, breakdown.recommendation + breakdown.sentiment + breakdown.prominence + breakdown.accuracy);

    // Aggregate tips (take unique tips from all responses, max 4)
    const allTips = responses.flatMap(r => r.tips);
    const uniqueTips = [...new Set(allTips)].slice(0, 4);

    // Determine overall sentiment by majority
    const sentimentCounts = responses.reduce((acc, r) => {
        acc[r.overallSentiment] = (acc[r.overallSentiment] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    let overallSentiment: "positive" | "neutral" | "negative" = "neutral";
    let maxCount = 0;
    for (const [sentiment, count] of Object.entries(sentimentCounts)) {
        if (count > maxCount) {
            maxCount = count;
            overallSentiment = sentiment as "positive" | "neutral" | "negative";
        }
    }

    return { score, breakdown, tips: uniqueTips, overallSentiment };
}

// FALLBACK: Original keyword-based scoring for when AI doesn't return structured data
export function calculateLLMOScore(responses: ScoringInput[]): { score: number; breakdown: Breakdown } {
    if (responses.length === 0) {
        return { score: 0, breakdown: { recommendation: 0, sentiment: 0, prominence: 0, accuracy: 0 } };
    }

    let totalRecommendation = 0;
    let totalSentiment = 0;
    let totalProminence = 0;
    let totalAccuracy = 0;

    responses.forEach(({ text, brand }) => {
        const lowerText = text.toLowerCase();
        const lowerBrand = brand.toLowerCase();

        // 1. Recommendation Score (0-40)
        const recommendationKeywords = ["best", "recommend", "top", "leading", "excellent", "great choice"];
        const hasRecommendation = recommendationKeywords.some(kw => lowerText.includes(kw));
        const brandNearRecommendation = hasRecommendation && lowerText.includes(lowerBrand);
        totalRecommendation += brandNearRecommendation ? 40 : hasRecommendation ? 20 : 10;

        // 2. Sentiment Score (0-30)
        const positiveWords = ["excellent", "great", "outstanding", "innovative", "trusted", "quality", "popular", "successful"];
        const negativeWords = ["poor", "bad", "controversial", "struggling", "failing", "criticized"];
        const positiveCount = positiveWords.filter(w => lowerText.includes(w)).length;
        const negativeCount = negativeWords.filter(w => lowerText.includes(w)).length;
        const sentimentRatio = positiveCount - negativeCount;
        totalSentiment += Math.min(30, Math.max(0, 15 + sentimentRatio * 5));

        // 3. Prominence Score (0-20)
        const brandMentions = (lowerText.match(new RegExp(lowerBrand, "g")) || []).length;
        const first500Chars = lowerText.substring(0, 500);
        const isProminent = first500Chars.includes(lowerBrand);
        totalProminence += Math.min(20, brandMentions * 3 + (isProminent ? 8 : 0));

        // 4. Accuracy Score (0-10)
        // Check if response seems knowledgeable (has specific details)
        const hasSpecifics = lowerText.includes("founded") ||
            lowerText.includes("headquarter") ||
            lowerText.includes("products") ||
            lowerText.includes("services") ||
            /\d{4}/.test(text); // Contains a year
        totalAccuracy += hasSpecifics ? 10 : 5;
    });

    const count = responses.length;
    const breakdown: Breakdown = {
        recommendation: Math.round(totalRecommendation / count),
        sentiment: Math.round(totalSentiment / count),
        prominence: Math.round(totalProminence / count),
        accuracy: Math.round(totalAccuracy / count),
    };

    const score = Math.min(100, breakdown.recommendation + breakdown.sentiment + breakdown.prominence + breakdown.accuracy);

    return { score, breakdown };
}

export function analyzeSentiment(text: string): "positive" | "neutral" | "negative" {
    const lowerText = text.toLowerCase();

    const positiveWords = ["excellent", "great", "outstanding", "innovative", "trusted", "quality", "popular", "leading", "best", "recommend"];
    const negativeWords = ["poor", "bad", "controversial", "struggling", "failing", "criticized", "problem", "issue", "concern"];

    const positiveCount = positiveWords.filter(w => lowerText.includes(w)).length;
    const negativeCount = negativeWords.filter(w => lowerText.includes(w)).length;

    if (positiveCount > negativeCount + 1) return "positive";
    if (negativeCount > positiveCount + 1) return "negative";
    return "neutral";
}

export function countBrandMentions(text: string, brand: string): number {
    const regex = new RegExp(brand, "gi");
    return (text.match(regex) || []).length;
}

export function generateTips(score: number, breakdown: Breakdown, brand: string): string[] {
    const tips: string[] = [];

    if (breakdown.recommendation < 25) {
        tips.push(`Create more content that positions ${brand} as a top recommendation in your category.`);
    }

    if (breakdown.sentiment < 20) {
        tips.push("Focus on highlighting positive reviews and success stories in your marketing content.");
    }

    if (breakdown.prominence < 12) {
        tips.push("Increase brand visibility by being mentioned first in comparative content.");
    }

    if (breakdown.accuracy < 7) {
        tips.push("Ensure your brand information (founding date, key facts) is widely available online.");
    }

    if (score >= 80) {
        tips.push(`Great AI visibility! ${brand} is well-represented across AI models.`);
    } else if (score >= 60) {
        tips.push("Good foundation. Focus on the areas above to improve further.");
    } else if (score >= 40) {
        tips.push("Moderate visibility. Consider a content strategy focused on AI training data presence.");
    } else {
        tips.push("Low AI visibility. Your brand may need more online presence and structured content.");
    }

    return tips.slice(0, 4);
}
