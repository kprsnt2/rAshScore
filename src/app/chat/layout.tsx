import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ask the Data | rAsh Score',
  description: 'Chat directly with our AI database.',
};

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
