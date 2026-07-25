"use client";

import { useState } from "react";
import { BrandCheckResult } from "@/app/page";

interface CompetitorComparisonProps {
    brandResult: BrandCheckResult;
    competitorResult: BrandCheckResult | null;
    onCompare: (competitor: string) => void;
    loading: boolean;
}

export default function CompetitorComparison({
    brandResult,
    competitorResult,
    onCompare,
    loading
}: CompetitorComparisonProps) {
    const [competitor, setCompetitor] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (competitor.trim()) {
            onCompare(competitor.trim());
        }
    };

    // Calculate advantage using ORIGINAL brand score vs competitor score
    const advantage = competitorResult
        ? brandResult.score - competitorResult.score
        : null;

    return (
        <div className="card p-6">
            <h3 className="text-xl font-semibold mb-4">⚔️ Competitor Comparison</h3>

            {/* Competitor Input */}
            <form onSubmit={handleSubmit} className="mb-6">
                <div className="flex gap-3">
                    <input
                        type="text"
                        value={competitor}
                        onChange={(e) => setCompetitor(e.target.value)}
                        placeholder="Enter competitor brand..."
                        className="flex-1 px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                       placeholder-gray-500"
                        disabled={loading}
                    />
                    <button
                        type="submit"
                        disabled={loading || !competitor.trim()}
                        className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium
                       transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? "Analyzing..." : "Compare"}
                    </button>
                </div>
            </form>

            {/* Comparison Results - Uses ORIGINAL brand score, not re-scored */}
            {competitorResult && (
                <div className="space-y-4">
                    {/* Score Comparison */}
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="p-4 bg-primary-500/10 rounded-lg border border-primary-500/30">
                            <p className="text-sm text-gray-400 mb-1">Your Brand</p>
                            <p className="text-2xl font-bold text-primary-400">{brandResult.score}</p>
                            <p className="text-sm text-gray-500">{brandResult.brand}</p>
                        </div>

                        <div className="p-4 flex items-center justify-center">
                            <div className={`text-2xl font-bold ${advantage && advantage > 0 ? "text-green-400" :
                                advantage && advantage < 0 ? "text-red-400" : "text-gray-400"
                                }`}>
                                {advantage !== null && (
                                    <>
                                        {advantage > 0 ? "+" : ""}{advantage}
                                        <span className="text-sm block text-gray-500">
                                            {advantage > 0 ? "Ahead" : advantage < 0 ? "Behind" : "Tied"}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                            <p className="text-sm text-gray-400 mb-1">Competitor</p>
                            <p className="text-2xl font-bold text-gray-300">{competitorResult.score}</p>
                            <p className="text-sm text-gray-500">{competitorResult.brand}</p>
                        </div>
                    </div>

                    {/* Detailed Breakdown */}
                    <div className="mt-6">
                        <h4 className="text-sm font-semibold text-gray-400 mb-3">Score Breakdown</h4>
                        <div className="space-y-2">
                            {[
                                { label: "Recommendation", you: brandResult.breakdown.recommendation, them: competitorResult.breakdown.recommendation, max: 40 },
                                { label: "Sentiment", you: brandResult.breakdown.sentiment, them: competitorResult.breakdown.sentiment, max: 30 },
                                { label: "Prominence", you: brandResult.breakdown.prominence, them: competitorResult.breakdown.prominence, max: 20 },
                                { label: "Accuracy", you: brandResult.breakdown.accuracy, them: competitorResult.breakdown.accuracy, max: 10 },
                            ].map((item) => (
                                <div key={item.label} className="space-y-1">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">{item.label}</span>
                                        <span className="text-gray-300">
                                            <span className="text-primary-400">{item.you}</span> vs <span className="text-gray-400">{item.them}</span>
                                        </span>
                                    </div>
                                    <div className="flex gap-1 h-2">
                                        <div className="flex-1 bg-gray-700 rounded-l-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary-500 rounded-l-full transition-all duration-500"
                                                style={{ width: `${(item.you / item.max) * 100}%` }}
                                            />
                                        </div>
                                        <div className="flex-1 bg-gray-700 rounded-r-full overflow-hidden flex justify-end">
                                            <div
                                                className="h-full bg-gray-500 rounded-r-full transition-all duration-500"
                                                style={{ width: `${(item.them / item.max) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Competitive Insight */}
                    <div className="mt-4 p-4 bg-gray-800/30 rounded-lg border border-gray-700">
                        <p className="text-sm text-gray-300">
                            <span className="font-semibold">🎯 Competitive Analysis:</span>{" "}
                            {advantage && advantage > 10 ? (
                                <>You have a strong lead over {competitorResult.brand}. Maintain your AI presence!</>
                            ) : advantage && advantage > 0 ? (
                                <>Slight advantage over {competitorResult.brand}. Room to extend your lead.</>
                            ) : advantage && advantage < -10 ? (
                                <>{competitorResult.brand} has better AI visibility. Focus on content optimization.</>
                            ) : advantage && advantage < 0 ? (
                                <>{competitorResult.brand} is slightly ahead. Small improvements can flip this.</>
                            ) : (
                                <>Evenly matched with {competitorResult.brand}. Differentiation is key.</>
                            )}
                        </p>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!competitorResult && !loading && (
                <p className="text-gray-500 text-center py-4">
                    Enter a competitor brand name to compare AI visibility scores
                </p>
            )}

            {/* Loading State */}
            {loading && (
                <div className="flex items-center justify-center py-8">
                    <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="ml-3 text-gray-400">Analyzing competitor...</span>
                </div>
            )}
        </div>
    );
}
