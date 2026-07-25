"use client";

interface LoadingSkeletonProps {
    className?: string;
}

export function SkeletonLine({ className = "" }: LoadingSkeletonProps) {
    return (
        <div
            className={`bg-gray-700 rounded animate-pulse ${className}`}
            style={{ height: "1em" }}
        />
    );
}

export function SkeletonCard({ className = "" }: LoadingSkeletonProps) {
    return (
        <div className={`card p-6 space-y-4 ${className}`}>
            <SkeletonLine className="w-1/3" />
            <SkeletonLine className="w-full" />
            <SkeletonLine className="w-full" />
            <SkeletonLine className="w-2/3" />
        </div>
    );
}

export function SkeletonScore() {
    return (
        <div className="card p-6">
            <div className="flex justify-center mb-6">
                <div className="w-32 h-32 rounded-full bg-gray-700 animate-pulse" />
            </div>
            <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="space-y-1">
                        <div className="flex justify-between">
                            <SkeletonLine className="w-24" />
                            <SkeletonLine className="w-12" />
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2" />
                    </div>
                ))}
            </div>
        </div>
    );
}

export function SkeletonResults() {
    return (
        <div className="space-y-8 animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <SkeletonScore />
                <div className="lg:col-span-2">
                    <SkeletonCard />
                </div>
            </div>
            <SkeletonCard />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SkeletonCard />
                <SkeletonCard />
            </div>
        </div>
    );
}
