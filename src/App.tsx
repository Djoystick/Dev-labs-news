import { Outlet } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { usePostFeed } from '@/features/posts/hooks';
import type { Post, Topic } from '@/types/db';

export type AppLayoutContext = {
  activeTopic: string;
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  isRefreshing: boolean;
  isTopicsLoading: boolean;
  loadMore: () => void;
  postsError: string | null;
  posts: Post[];
  query: string;
  resultsCount: number;
  selectedTopic: Topic & { count: number };
  setActiveTopic: (slug: string) => void;
  setQuery: (value: string) => void;
  topicsError: string | null;
  topics: Array<Topic & { count: number }>;
  retryPosts: () => void;
  retryTopics: () => void;
};

export function App() {
  const feed = usePostFeed();

  return (
    <AppShell
      activeTopic={feed.activeTopic}
      isTopicsLoading={feed.isTopicsLoading}
      onSearchChange={feed.setQuery}
      onTopicChange={feed.setActiveTopic}
      query={feed.query}
      topicsError={feed.topicsError}
      topics={feed.topics}
      retryTopics={feed.retryTopics}
    >
      <Outlet context={{ ...feed } satisfies AppLayoutContext} />
    </AppShell>
  );
}
