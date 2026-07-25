import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import NavHeader from "@/components/NavHeader";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    themeColor: "#667eea",
};

export const metadata: Metadata = {
    metadataBase: new URL("https://rashscore.live"),
    title: {
        default: "rAsh Score - Check Your Brand's AI Visibility",
        template: "%s | rAsh Score",
    },
    description:
        "Discover how AI models like NVIDIA Nemotron and Groq perceive your brand. Get your rAsh Score and optimize for AI-powered recommendations.",
    keywords: [
        "AI brand visibility",
        "LLMO score",
        "LLM optimization",
        "AI recommendations",
        "brand monitoring",
        "rAsh score",
        "AI SEO",
        "brand analysis",
        "AI perception",
        "LLM marketing",
    ],
    authors: [{ name: "Prashanth Kumar Kadasi", url: "https://kprsnt.in" }],
    creator: "Prashanth Kumar Kadasi",
    publisher: "rAsh Score",
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            "max-video-preview": -1,
            "max-image-preview": "large",
            "max-snippet": -1,
        },
    },
    openGraph: {
        type: "website",
        locale: "en_US",
        url: "https://rashscore.live",
        siteName: "rAsh Score",
        title: "rAsh Score - Check Your Brand's AI Visibility",
        description:
            "See what AI models say about your brand. Get your unified rAsh Score and optimize for AI recommendations.",
        images: [
            {
                url: "/og-image.png",
                width: 1200,
                height: 630,
                alt: "rAsh Score - AI Visibility Checker",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "rAsh Score - Check Your Brand's AI Visibility",
        description:
            "Discover how AI models perceive your brand. Get your rAsh Score and optimize for AI recommendations.",
        images: ["/og-image.png"],
        creator: "@kprsnt2",
    },
    alternates: {
        canonical: "https://rashscore.live",
    },
    category: "Technology",
};

// JSON-LD structured data
const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "rAsh Score",
    description:
        "Check your brand's visibility in AI models like NVIDIA Nemotron and Groq. Get your rAsh Score.",
    url: "https://rashscore.live",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Any",
    offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
    },
    author: {
        "@type": "Person",
        name: "Prashanth Kumar Kadasi",
        url: "https://kprsnt.in",
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <head>
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
                />
            </head>
            <body className={inter.className}>
                <ErrorBoundary>
                    <ToastProvider>
                        <div className="min-h-screen flex flex-col">
                            {/* Skip to main content link for accessibility */}
                            <a
                                href="#main-content"
                                className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-primary-500 text-white px-4 py-2 rounded-lg z-50"
                            >
                                Skip to main content
                            </a>

                            <NavHeader />

                            {/* Main Content */}
                            <main id="main-content" className="flex-grow" role="main">
                                {children}
                            </main>

                            {/* Footer */}
                            <footer className="border-t py-10 text-center text-sm" style={{ borderColor: 'var(--rs-border)', color: 'var(--rs-text-muted)' }}>
                                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                                    <div className="flex flex-col sm:flex-row justify-center items-center gap-2 sm:gap-6" style={{ color: 'var(--rs-text-secondary)' }}>
                                        <a href="mailto:hey@rashscore.live" className="text-primary-400 hover:text-primary-300 hover:underline underline-offset-2 transition-colors">
                                            Contact: hey@rashscore.live
                                        </a>
                                        <span className="hidden sm:inline" style={{ color: 'var(--rs-border)' }}>&bull;</span>
                                        <a
                                            href="https://kprsnt.in/blog/manipulating-llm-recommendations-brand-influence"
                                            className="text-primary-400 hover:text-primary-300 hover:underline underline-offset-2 transition-colors"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            How rAsh Score is calculated?
                                        </a>
                                    </div>
                                    <p className="mt-5 text-xs" style={{ color: 'var(--rs-text-faint)' }}>
                                        © {new Date().getFullYear()} rAsh Score. All rights reserved.
                                    </p>
                                </div>
                            </footer>
                        </div>
                    </ToastProvider>
                </ErrorBoundary>
            </body>
        </html>
    );
}
