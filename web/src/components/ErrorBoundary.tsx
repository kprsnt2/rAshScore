"use client";

import React, { Component, ReactNode } from "react";

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        // Log error for monitoring
        console.error("ErrorBoundary caught an error:", error, errorInfo);

        // TODO: Send to error tracking service (Sentry, etc.)
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-[400px] flex items-center justify-center">
                    <div className="card p-8 text-center max-w-md">
                        <div className="text-4xl mb-4">😵</div>
                        <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
                        <p className="text-gray-400 mb-4">
                            We encountered an unexpected error. Please try again.
                        </p>
                        {this.state.error && (
                            <p className="text-sm text-red-400 bg-red-500/10 p-2 rounded mb-4 font-mono">
                                {this.state.error.message}
                            </p>
                        )}
                        <button
                            onClick={this.handleRetry}
                            className="px-6 py-2 bg-gradient-to-r from-primary-500 to-purple-600 rounded-lg font-semibold text-white hover:shadow-lg hover:shadow-primary-500/25 transition-all"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

// Hook for functional components to manually trigger error boundary
export function useErrorHandler() {
    const [, setError] = React.useState<Error | null>(null);

    return React.useCallback((error: Error) => {
        setError(() => {
            throw error;
        });
    }, []);
}
