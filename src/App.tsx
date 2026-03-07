import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { OnboardingGate } from '@/app/OnboardingGate';
import { AppShell } from '@/components/layout/app-shell';
import { usePostFeed } from '@/features/posts/hooks';
import {
  clearStoredTelegramLaunchTarget,
  getStoredTelegramLaunchTarget,
  getTelegramEarlyLaunchDebug,
  getTelegramEnvironment,
} from '@/lib/telegram';
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
  const [appliedLaunchTarget, setAppliedLaunchTarget] = useState<string | null>(null);
  const [storedLaunchTarget, setStoredLaunchTarget] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [earlyDebug] = useState(() => getTelegramEarlyLaunchDebug());
  const isTelegramWebApp = getTelegramEnvironment() === 'telegram';

  useEffect(() => {
    if (launchHandledRef.current) {
      return;
    }

    const targetPath = getStoredTelegramLaunchTarget();
    setStoredLaunchTarget(targetPath);

    if (!targetPath) {
      launchHandledRef.current = true;
      return;
    }

    launchHandledRef.current = true;
    setAppliedLaunchTarget(targetPath);

    if (location.pathname === targetPath) {
      clearStoredTelegramLaunchTarget();
      return;
    }

    void navigate(targetPath, { replace: true });
  }, [location.pathname, navigate]);

  useEffect(() => {
    if (!appliedLaunchTarget) {
      return;
    }

    if (location.pathname !== appliedLaunchTarget) {
      return;
    }

    clearStoredTelegramLaunchTarget();
  }, [appliedLaunchTarget, location.pathname]);

  const content = <Outlet context={{ ...feed } satisfies AppLayoutContext} />;
  const windowHref = typeof window !== 'undefined' ? window.location.href : '';
  const windowSearch = typeof window !== 'undefined' ? window.location.search : '';
  const windowHash = typeof window !== 'undefined' ? window.location.hash : '';
  const documentReferrer = typeof document !== 'undefined' ? document.referrer : '';
  const debugSnapshot = {
    appliedLaunchTarget,
    currentPath: location.pathname,
    documentReferrer,
    earlyCapturedLaunchTarget: earlyDebug?.earlyCapturedLaunchTarget ?? null,
    rawHash: earlyDebug?.rawHash ?? '',
    rawSearch: earlyDebug?.rawSearch ?? '',
    storedLaunchTarget,
    windowHash,
    windowHref,
    windowSearch,
  };
  const copyDebug = () => {
    if (!navigator?.clipboard?.writeText) {
      setCopyStatus('error');
      return;
    }

    void navigator.clipboard
      .writeText(JSON.stringify(debugSnapshot, null, 2))
      .then(() => setCopyStatus('copied'))
      .catch(() => setCopyStatus('error'));
  };
  const debugPanel = isTelegramWebApp ? (
    <div className="fixed right-2 top-2 z-50 max-w-[82vw] rounded-xl border border-border/70 bg-background/95 px-3 py-2 text-[11px] leading-tight shadow-lg">
      <p className="font-semibold text-foreground">Launch debug</p>
      <p className="text-muted-foreground">window.location.href: {windowHref || '-'}</p>
      <p className="text-muted-foreground">window.location.search: {windowSearch || '-'}</p>
      <p className="text-muted-foreground">window.location.hash: {windowHash || '-'}</p>
      <p className="text-muted-foreground">document.referrer: {documentReferrer || '-'}</p>
      <p className="text-muted-foreground">rawSearch: {earlyDebug?.rawSearch || '-'}</p>
      <p className="text-muted-foreground">rawHash: {earlyDebug?.rawHash || '-'}</p>
      <p className="text-muted-foreground">earlyCapturedLaunchTarget: {earlyDebug?.earlyCapturedLaunchTarget ?? '-'}</p>
      <p className="text-muted-foreground">storedLaunchTarget: {storedLaunchTarget ?? '-'}</p>
      <p className="text-muted-foreground">appliedLaunchTarget: {appliedLaunchTarget ?? '-'}</p>
      <p className="text-muted-foreground">currentPath: {location.pathname}</p>
      <button
        type="button"
        className="mt-2 rounded-md border border-border/70 px-2 py-1 text-[11px] font-medium text-foreground hover:bg-secondary/60"
        onClick={copyDebug}
      >
        Копировать debug
      </button>
      <p className="mt-1 text-[10px] text-muted-foreground">
        copyStatus: {copyStatus === 'idle' ? '-' : copyStatus}
      </p>
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
