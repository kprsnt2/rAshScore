import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Battle Arena | rAsh Score',
  description: 'Compare two brands head-to-head in an AI visibility debate.',
};

export default function ArenaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
