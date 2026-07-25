"use client";

interface LLMOScoreProps {
    score: number;
    breakdown: {
        recommendation: number;
        sentiment: number;
        prominence: number;
        accuracy: number;
    };
}

export default function LLMOScore({ score, breakdown }: LLMOScoreProps) {
    const getScoreColor = (score: number) => {
        if (score >= 80) return "text-green-400";
        if (score >= 60) return "text-yellow-400";
        if (score >= 40) return "text-orange-400";
        return "text-red-400";
    };

    const getScoreLabel = (score: number) => {
        if (score >= 80) return "Excellent";
        if (score >= 60) return "Good";
        if (score >= 40) return "Needs Work";
        return "Poor";
    };

    const circumference = 2 * Math.PI * 45;
    const strokeDashoffset = circumference - (score / 100) * circumference;

    const breakdownItems = [
        { label: "Recommendation", value: breakdown.recommendation, max: 40, icon: "🎯" },
        { label: "Sentiment", value: breakdown.sentiment, max: 30, icon: "💚" },
        { label: "Prominence", value: breakdown.prominence, max: 20, icon: "⭐" },
        { label: "Accuracy", value: breakdown.accuracy, max: 10, icon: "✓" },
    ];

    return (
        <div className="card p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                📊 rAsh Score
            </h3>

            {/* Circular Score */}
            <div className="flex justify-center mb-6">
                <div className="relative w-32 h-32">
                    <svg className="transform -rotate-90 w-32 h-32">
                        {/* Background circle */}
                        <circle
                            cx="64"
                            cy="64"
                            r="45"
                            stroke="currentColor"
                            strokeWidth="8"
                            fill="none"
                            className="text-gray-700"
                        />
                        {/* Progress circle */}
                        <circle
                            cx="64"
                            cy="64"
                            r="45"
                            stroke="url(#scoreGradient)"
                            strokeWidth="8"
                            fill="none"
                            strokeLinecap="round"
                            className="score-ring"
                            style={{
                                strokeDasharray: circumference,
                                strokeDashoffset: strokeDashoffset,
                            }}
                        />
                        <defs>
                            <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#667eea" />
                                <stop offset="100%" stopColor="#764ba2" />
                            </linearGradient>
                        </defs>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className={`text-3xl font-bold ${getScoreColor(score)}`}>{score}</span>
                        <span className="text-xs text-gray-500">/100</span>
                    </div>
                </div>
            </div>

            {/* Score Label */}
            <div className="text-center mb-4">
                <span className={`text-lg font-semibold ${getScoreColor(score)}`}>
                    {getScoreLabel(score)}
                </span>
            </div>

            {/* Breakdown */}
            <div className="space-y-3">
                {breakdownItems.map((item) => (
                    <div key={item.label} className="space-y-1">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-400">
                                {item.icon} {item.label}
                            </span>
                            <span className="text-gray-300">{item.value}/{item.max}</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                            <div
                                className="h-2 rounded-full bg-gradient-to-r from-primary-500 to-purple-500 transition-all duration-500"
                                style={{ width: `${(item.value / item.max) * 100}%` }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
