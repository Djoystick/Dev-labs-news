import type { ReactNode } from 'react';
import { BottomBar } from '@/components/layout/bottom-bar';
import { Footer } from '@/components/layout/footer';
import { Header } from '@/components/layout/header';
import type { Topic } from '@/types/db';

type AppShellProps = {
  activeTopic: string;
  children: ReactNode;
  isTopicsLoading: boolean;
  onSearchChange: (value: string) => void;
  onTopicChange: (slug: string) => void;
  query: string;
  topicsError: string | null;
  topics: Array<Topic & { count: number }>;
  retryTopics: () => void;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <Header />
      <main className="app-header-offset app-bottom-nav-offset">{children}</main>
      <Footer />
      <BottomBar />
    </div>
  );
}
