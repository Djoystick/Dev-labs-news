import { useState, type ReactNode } from 'react';
import { Footer } from '@/components/layout/footer';
import { Header } from '@/components/layout/header';
import { TopicDrawer } from '@/components/layout/topic-drawer';
import type { Topic } from '@/types/topic';

type AppShellProps = {
  activeTopic: string;
  children: ReactNode;
  onSearchChange: (value: string) => void;
  onTopicChange: (slug: string) => void;
  query: string;
  topics: Topic[];
};

export function AppShell({ activeTopic, children, onSearchChange, onTopicChange, query, topics }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <Header onMenuClick={() => setDrawerOpen(true)} onSearchChange={onSearchChange} searchValue={query} />
      <TopicDrawer activeTopic={activeTopic} onOpenChange={setDrawerOpen} onSelect={onTopicChange} open={drawerOpen} topics={topics} />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
