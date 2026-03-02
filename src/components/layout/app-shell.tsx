import { useState, type ReactNode } from 'react';
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
  resultsCount: number;
  selectedTopic: Topic & { count: number };
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
  resultsCount,
  selectedTopic,
  topicsError,
  topics,
  retryTopics,
}: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <Header
        onMenuClick={() => setDrawerOpen(true)}
        onSearchChange={onSearchChange}
        resultsCount={resultsCount}
        searchValue={query}
        selectedTopicName={selectedTopic.name}
      />
      <TopicDrawer
        activeTopic={activeTopic}
        isLoading={isTopicsLoading}
        onOpenChange={setDrawerOpen}
        onRetry={retryTopics}
        onSelect={onTopicChange}
        open={drawerOpen}
        topics={topics}
        topicsError={topicsError}
      />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
