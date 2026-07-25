import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Advanced Analytics | Anomaly Detection & Forecasting | rAsh Score',
  description: 'AI-powered anomaly detection, trend forecasting, and brand volatility analysis across Indian industries. Statistical methods applied to AI visibility data.',
  keywords: [
    'anomaly detection',
    'trend forecasting',
    'brand volatility',
    'AI analytics',
    'z-score analysis',
    'linear regression',
    'India brands',
  ],
  openGraph: {
    title: 'Advanced Analytics | rAsh Score',
    description: 'Anomaly detection, trend forecasting, and brand volatility analysis across Indian industries.',
    url: 'https://rashscore.live/analytics',
  },
  alternates: {
    canonical: 'https://rashscore.live/analytics',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Dataset',
  name: 'India AI Brand Analytics — Advanced Statistical Analysis',
  description: 'Anomaly detection, trend forecasting, and volatility analysis of AI brand visibility across 19 Indian industries.',
  url: 'https://rashscore.live/analytics',
  creator: { '@type': 'Organization', name: 'rAsh Score' },
};

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {children}
    </>
  );
}
