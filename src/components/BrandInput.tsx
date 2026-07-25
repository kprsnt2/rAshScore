"use client";

import { useState } from "react";
import { BRAND_CATEGORIES } from "@/lib/validation";

interface BrandInputProps {
    onSubmit: (brand: string, category: string) => void;
    loading: boolean;
}

export default function BrandInput({ onSubmit, loading }: BrandInputProps) {
    const [brand, setBrand] = useState("");
    const [category, setCategory] = useState("general");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (brand.trim()) {
            onSubmit(brand.trim(), category);
        }
    };

    const popularBrands = [
        { name: "Apple", category: "mobile-phones" },
        { name: "Nike", category: "fashion" },
        { name: "Tesla", category: "automotive" },
        { name: "Samsung", category: "consumer-electronics" },
        { name: "Google", category: "technology" },
        { name: "Amazon", category: "ecommerce" },
    ];

    return (
        <div className="w-full animate-slide-up">
            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                {/* Brand Name Input */}
                <div className="relative">
                    <div className="flex flex-col gap-3 sm:relative sm:block">
                        <input
                            type="text"
                            value={brand}
                            onChange={(e) => setBrand(e.target.value)}
                            placeholder="Enter your brand name..."
                            className="w-full h-14 sm:h-16 px-4 sm:px-6 sm:pr-48 text-base sm:text-lg bg-[#0f1115] border border-white/[0.1] rounded-xl
                             focus:outline-none focus:border-indigo-400/70 focus:ring-4 focus:ring-indigo-500/10 text-white placeholder-slate-500 transition-all duration-200"
                            disabled={loading}
                        />
                        <button
                            type="submit"
                            disabled={loading || !brand.trim()}
                            className="w-full sm:w-auto sm:absolute sm:right-2 sm:top-1/2 sm:-translate-y-1/2 px-4 sm:px-7 py-3
                             bg-indigo-500 hover:bg-indigo-400 rounded-lg
                             font-semibold text-white transition-colors duration-200 active:bg-indigo-600
                             disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Analyzing...
                                </span>
                            ) : (
                                "Check Brand"
                            )}
                        </button>
                    </div>
                </div>

                {/* Category Selection */}
                <div className="flex flex-col items-stretch gap-2 bg-white/[0.025] border border-white/[0.08] rounded-xl px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
                        Industry:
                    </span>
                    <select
                        id="category"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        disabled={loading}
                        className="w-full min-w-0 bg-transparent text-sm focus:outline-none text-white font-medium cursor-pointer transition-colors hover:text-indigo-200 disabled:opacity-50 sm:w-auto"
                    >
                        {BRAND_CATEGORIES.map((cat) => (
                            <option key={cat.value} value={cat.value} className="bg-[#1c1f26] text-white">
                                {cat.label}
                            </option>
                        ))}
                    </select>
                </div>
            </form>

            {/* Popular brands suggestions */}
            <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider mr-1">Examples:</span>
                {popularBrands.map((b) => (
                    <button
                        key={b.name}
                        onClick={() => {
                            setBrand(b.name);
                            setCategory(b.category);
                            onSubmit(b.name, b.category);
                        }}
                        disabled={loading}
                        className="min-h-8 px-3.5 py-1.5 text-xs bg-white/[0.025] hover:bg-white/[0.05] border border-white/[0.08] hover:border-white/[0.14] text-slate-400 hover:text-white rounded-full transition-colors duration-200 disabled:opacity-50"
                    >
                        {b.name}
                    </button>
                ))}
            </div>
        </div>
    );
}

