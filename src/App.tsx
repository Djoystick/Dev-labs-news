import { Outlet } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { topicSeeds } from '@/features/topics/data';
import { useState } from 'react';

export type AppLayoutContext = {
  activeTopic: string;
  query: string;
  setActiveTopic: (slug: string) => void;
  setQuery: (value: string) => void;
};

export function App() {
  const [query, setQuery] = useState('');
  const [activeTopic, setActiveTopic] = useState('all');

  return (
    <AppShell
      activeTopic={activeTopic}
      onSearchChange={setQuery}
      onTopicChange={setActiveTopic}
      query={query}
      topics={topicSeeds}
    >
      <Outlet context={{ activeTopic, query, setActiveTopic, setQuery } satisfies AppLayoutContext} />
    </AppShell>
  );
}
