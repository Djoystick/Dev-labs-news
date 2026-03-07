import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { OnboardingGate } from '@/app/OnboardingGate';
import { AppShell } from '@/components/layout/app-shell';
import { usePostFeed } from '@/features/posts/hooks';
import { getTelegramEnvironment, resolveTelegramLaunchIntent } from '@/lib/telegram';
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
  const launchHandledRef = useRef(false);
  const launchProbeAttemptsRef = useRef(0);
  const [launchProbeTick, setLaunchProbeTick] = useState(0);
  const [launchNavigateTriggered, setLaunchNavigateTriggered] = useState(false);
  const launchIntent = resolveTelegramLaunchIntent();
  const isTelegramWebApp = getTelegramEnvironment() === 'telegram';

  useEffect(() => {
    if (launchHandledRef.current) {
      return;
    }

    const currentIntent = resolveTelegramLaunchIntent();
    const targetPath = currentIntent.targetPath;
    if (!targetPath) {
      const hasLaunchSources = Boolean(
        currentIntent.startParamFromInitData || currentIntent.startParamFromQuery || currentIntent.startParamFromUnsafe,
      );
      if (getTelegramEnvironment() !== 'telegram' || hasLaunchSources || launchProbeAttemptsRef.current >= 6) {
        launchHandledRef.current = true;
        return;
      }

      launchProbeAttemptsRef.current += 1;
      const timeoutId = window.setTimeout(() => {
        setLaunchProbeTick((value) => value + 1);
      }, 200);
      return () => {
        window.clearTimeout(timeoutId);
      };
    }

    launchHandledRef.current = true;

    if (location.pathname === targetPath) {
      return;
    }

    setLaunchNavigateTriggered(true);
    void navigate(targetPath, { replace: true });
  }, [launchProbeTick, location.pathname, navigate]);

  const content = <Outlet context={{ ...feed } satisfies AppLayoutContext} />;
  const debugPanel = isTelegramWebApp ? (
    <div className="pointer-events-none fixed right-2 top-2 z-50 max-w-[82vw] rounded-xl border border-border/70 bg-background/95 px-3 py-2 text-[11px] leading-tight shadow-lg">
      <p className="font-semibold text-foreground">Launch debug</p>
      <p className="text-muted-foreground">start_param: {launchIntent.startParamFromUnsafe ?? '—'}</p>
      <p className="text-muted-foreground">tgWebAppStartParam: {launchIntent.startParamFromQuery ?? '—'}</p>
      <p className="text-muted-foreground">resolvedLaunchTarget: {launchIntent.targetPath ?? '—'}</p>
      <p className="text-muted-foreground">currentPath: {location.pathname}</p>
      <p className="text-muted-foreground">launchNavigate: {launchNavigateTriggered ? 'yes' : 'no'}</p>
    </div>
  ) : null;

  if (isOnboardingRoute) {
    return (
      <>
        {debugPanel}
        {content}
      </>
    );
  }

  return (
    <>
      {debugPanel}
      <AppShell>{content}</AppShell>
    </>
  );
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
