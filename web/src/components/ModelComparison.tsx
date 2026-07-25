"use client";

interface ModelComparisonProps {
    responses: {
        model: string;
        modelType: "free" | "pro";
        text: string;
        sentiment: "positive" | "neutral" | "negative";
        mentionsCount: number;
    }[];
    brand: string;
}

export default function ModelComparison({ responses, brand }: ModelComparisonProps) {
    // Helper to get partial score if we wanted to show per-model scores
    // But currently the scoring is aggregated. We'll show specific sentiment/stats per model.

    return (
        <div className="card p-6">
            <h3 className="text-xl font-semibold mb-6 text-center">
                🆚 Model Comparison
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {responses.map((response, idx) => (
                    <div key={idx} className="bg-gray-900/40 rounded-xl p-4 border border-gray-800 flex flex-col h-full hover:border-primary-500/30 transition-colors">
                        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-800">
                            <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center text-lg">
                                {response.model.toLowerCase().includes("nvidia") || response.model.toLowerCase().includes("nemotron") || response.model.toLowerCase().includes("step") || response.model.toLowerCase().includes("glm") ? "⚡" :
                                    response.model.toLowerCase().includes("groq") || response.model.toLowerCase().includes("llama") || response.model.toLowerCase().includes("gpt-oss") ? "🚀" : "🤖"}
                            </div>
                            <div>
                                <h4 className="font-semibold text-sm text-gray-200">{response.model}</h4>
                                <p className="text-xs text-gray-500 capitalize">Free Model</p>
                            </div>
                        </div>

                        <div className="flex-grow space-y-3">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-400">Sentiment:</span>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${response.sentiment === "positive" ? "bg-green-500/10 text-green-400" :
                                        response.sentiment === "negative" ? "bg-red-500/10 text-red-400" :
                                            "bg-yellow-500/10 text-yellow-400"
                                    }`}>
                                    {response.sentiment.toUpperCase()}
                                </span>
                            </div>

                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-400">Mentions:</span>
                                <span className="text-gray-200 font-mono">{response.mentionsCount}</span>
                            </div>

                            <div className="mt-3 pt-3 border-t border-gray-800/50">
                                <p className="text-xs text-gray-500 line-clamp-3 italic">
                                    &quot;{response.text.substring(0, 100)}...&quot;
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-6 p-4 bg-primary-900/10 rounded-lg border border-primary-500/20">
                <p className="text-sm text-center text-primary-200">
                    <span className="mr-2">💡</span>
                    Comparing results across multiple models gives a more accurate picture of your brand&apos;s overall AI visibility.
                </p>
            </div>
        </div>
    );
}
