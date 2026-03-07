import { useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { OnboardingGate } from '@/app/OnboardingGate';
import { AppShell } from '@/components/layout/app-shell';
import { usePostFeed } from '@/features/posts/hooks';
import { getPathFromTelegramStartParam, getTelegramStartParam } from '@/lib/telegram';
import type { Post, PostSort, Topic } from '@/types/db';

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
  setSort: (value: PostSort) => void;
  sort: PostSort;
  topicsError: string | null;
  topics: Array<Topic & { count: number }>;
  retryPosts: () => void;
  retryTopics: () => void;
};

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const feed = usePostFeed();
  const isOnboardingRoute = location.pathname.startsWith('/onboarding');
  const startParamHandledRef = useRef(false);

  useEffect(() => {
    if (startParamHandledRef.current) {
      return;
    }

    startParamHandledRef.current = true;

    const targetPath = getPathFromTelegramStartParam(getTelegramStartParam());
    if (!targetPath) {
      return;
    }

    if (location.pathname === targetPath) {
      return;
    }

    void navigate(targetPath, { replace: true });
  }, [location.pathname, navigate]);

  const content = <Outlet context={{ ...feed } satisfies AppLayoutContext} />;

  if (isOnboardingRoute) {
    return content;
  }

  return <AppShell>{content}</AppShell>;
}

function DevMojibakeGuard() {
  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const globalWindow = window as unknown as Record<string, boolean>;
    const marker = '__devLabsMojibakeWarned';
    if (globalWindow[marker]) {
      return;
    }

    const mojibakePattern = /[РС][Ѐ-џ]{1,2}[РС]|вЂў/;
    const sample = document.body?.innerText ?? '';
    if (mojibakePattern.test(sample)) {
      console.warn('[dev] Potential Cyrillic mojibake detected in UI labels.');
      globalWindow[marker] = true;
    }
  }, []);

  return null;
}

export function App() {
  return (
    <OnboardingGate>
      <DevMojibakeGuard />
      <AppContent />
    </OnboardingGate>
  );
}
