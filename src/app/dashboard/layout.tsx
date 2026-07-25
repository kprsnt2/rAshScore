import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'India rAsh Index | AI Visibility Scores & Ranks | rAsh Score',
  description: 'View the AI visibility rankings and rAsh Scores for top Indian brands across 19 industries. Analyze how models like NVIDIA Nemotron and Groq recommend brands.',
  keywords: [
    'rAsh scores',
    'AI visibility index',
    'market leaders',
    'industry brand ranks',
    'top companies India',
    'AI perception',
    'AI recommendations',
  ],
  openGraph: {
    title: 'India rAsh Index | AI Visibility Scores & Ranks',
    description: 'View the AI visibility rankings and rAsh Scores for top Indian brands across 19 industries.',
    url: 'https://rashscore.live/dashboard',
  },
  alternates: {
    canonical: 'https://rashscore.live/dashboard',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Dataset',
  name: 'India AI Visibility Index',
  description: 'A comprehensive dataset ranking Indian brands across 19 industries based on their visibility and sentiment in top AI models.',
  url: 'https://rashscore.live/dashboard',
  keywords: ['rAsh scores', 'AI visibility index', 'market leaders', 'industry brand ranks'],
  creator: {
    '@type': 'Organization',
    name: 'rAsh Score',
  },
  license: 'https://creativecommons.org/licenses/by/4.0/',
};

export default function CorporateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
