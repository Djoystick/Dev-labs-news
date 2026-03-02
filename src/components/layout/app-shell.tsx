import { useState, type ReactNode } from 'react';
import { BottomBar } from '@/components/layout/bottom-bar';
import { Footer } from '@/components/layout/footer';
import { Header } from '@/components/layout/header';
import { TopicDrawer } from '@/components/layout/topic-drawer';
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

export function AppShell({
  activeTopic,
  children,
  isTopicsLoading,
  onSearchChange,
  onTopicChange,
  query,
  topicsError,
  topics,
  retryTopics,
}: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <Header onMenuClick={() => setDrawerOpen(true)} />
      <TopicDrawer
        activeTopic={activeTopic}
        isLoading={isTopicsLoading}
        onOpenChange={setDrawerOpen}
        onSearchChange={onSearchChange}
        onRetry={retryTopics}
        onSelect={onTopicChange}
        open={drawerOpen}
        query={query}
        topics={topics}
        topicsError={topicsError}
      />
      <main className="app-header-offset app-bottom-nav-offset">{children}</main>
      <Footer />
      <BottomBar />
    </div>
  );
}
