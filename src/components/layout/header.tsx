import { useEffect, useMemo, useState } from 'react';
import { PencilLine, SlidersHorizontal } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import logoUrl from '@/assets/brand/logo.svg';
import { AuthDialog } from '@/components/auth/auth-dialog';
import { Container } from '@/components/layout/container';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { AppLink } from '@/components/ui/app-link';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { fetchTopics } from '@/features/topics/api';
import { TopicsFilter } from '@/features/topics/components/topics-filter';
import { isTopicKey, type TopicKey } from '@/features/topics/model';
import { FALLBACK_SECTION_TOPICS, filterToSections } from '@/features/topics/sections';
import { useAuth } from '@/providers/auth-provider';
import { useReadingPreferences } from '@/providers/preferences-provider';

type FilterTopicOption = {
  key: TopicKey;
  label: string;
};

function mapTopicsToFilterOptions(topics: Array<{ slug: string; name: string }>): FilterTopicOption[] {
  return topics.flatMap((topic) => (isTopicKey(topic.slug) ? [{ key: topic.slug, label: topic.name }] : []));
}

export function Header() {
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [topicsDialogOpen, setTopicsDialogOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthed, loading, profile } = useAuth();
  const { enabledTopicCount, resetTopicFilters, setTopicEnabled, topicFilters } = useReadingPreferences();
  const isFeedRoute = location.pathname === '/';
  const canWritePosts = profile?.role === 'admin' || profile?.role === 'editor';
  const fallbackTopicOptions = useMemo(() => mapTopicsToFilterOptions(FALLBACK_SECTION_TOPICS), []);
  const [sectionTopicOptions, setSectionTopicOptions] = useState<FilterTopicOption[]>(fallbackTopicOptions);
  const totalTopics = sectionTopicOptions.length > 0 ? sectionTopicOptions.length : fallbackTopicOptions.length;
  const hasFilteredTopics = enabledTopicCount !== totalTopics;
  const tapSafeRightPadding = useMemo(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const hasTelegramWebApp = Boolean((window as Window & { Telegram?: { WebApp?: unknown } }).Telegram?.WebApp);
    return hasTelegramWebApp ? 'calc(72px + var(--tma-safe-right, 0px))' : undefined;
  }, []);

  useEffect(() => {
    if (!isFeedRoute) {
      setTopicsDialogOpen(false);
    }
  }, [isFeedRoute]);

  useEffect(() => {
    if (!isFeedRoute) {
      return;
    }

    let cancelled = false;

    void fetchTopics()
      .then((loadedTopics) => {
        if (cancelled) {
          return;
        }

        const sectionTopics = filterToSections(loadedTopics);
        const mappedOptions = mapTopicsToFilterOptions(sectionTopics);
        setSectionTopicOptions(mappedOptions.length > 0 ? mappedOptions : fallbackTopicOptions);
      })
      .catch(() => {
        if (!cancelled) {
          setSectionTopicOptions(fallbackTopicOptions);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fallbackTopicOptions, isFeedRoute]);

  return (
    <header className="fixed inset-x-0 top-[var(--tma-content-safe-top)] z-[60] border-b border-border/70 bg-background/95 shadow-[0_20px_45px_-35px_rgba(15,23,42,0.55)] backdrop-blur-xl pt-[env(safe-area-inset-top,0px)]">
      <Container className="py-2 sm:py-1.5">
        <div className="flex h-9 items-center gap-3 sm:h-12">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <AppLink to="/" aria-label="Home" className="flex h-full items-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <img src={logoUrl} alt="Dev-labs News" className="block h-[calc(100%-8px)] w-auto max-h-full shrink-0" loading="eager" decoding="async" />
            </AppLink>
          </div>
          <div className="flex shrink-0 items-center gap-2" style={tapSafeRightPadding ? { paddingRight: tapSafeRightPadding } : undefined}>
            {isFeedRoute ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Открыть фильтр разделов"
                className="relative h-9 w-9 border-border/70 bg-background/80 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.65)]"
                onClick={() => setTopicsDialogOpen(true)}
              >
                <SlidersHorizontal className="h-4 w-4" />
                {hasFilteredTopics ? (
                  <>
                    <span className="absolute -right-1 -top-1 hidden min-w-8 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold leading-none text-primary-foreground shadow sm:inline-flex">
                      {enabledTopicCount}/{totalTopics}
                    </span>
                    <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-primary shadow sm:hidden" />
                  </>
                ) : null}
              </Button>
            ) : null}
            {isFeedRoute && canWritePosts ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 shrink-0 rounded-full border-border/70 bg-background/80 px-3 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.65)]"
                onClick={() => navigate('/admin/new')}
              >
                <PencilLine className="h-4 w-4" />
                <span className="hidden sm:inline">Написать</span>
              </Button>
            ) : null}
            <ThemeToggle className="h-9 w-9 border-border/70 bg-background/80 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.65)]" />
            {loading ? (
              <div className="h-9 w-9 rounded-full bg-secondary sm:w-20" aria-hidden />
            ) : isAuthed ? null : (
              <Button onClick={() => setAuthDialogOpen(true)} size="sm" variant="secondary" className="h-9 shrink-0 rounded-full px-3">
                <span className="hidden sm:inline">Войти</span>
                <span className="sm:hidden">Вход</span>
              </Button>
            )}
          </div>
        </div>
        <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
        {isFeedRoute ? (
          <Dialog open={topicsDialogOpen} onOpenChange={setTopicsDialogOpen}>
            <DialogContent className="max-h-[calc(100svh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-xl">
              <div className="border-b border-border/70 px-5 py-4 sm:px-6">
                <DialogHeader className="pr-10">
                  <DialogTitle className="text-xl sm:text-2xl">Разделы</DialogTitle>
                  <DialogDescription>Настройте, какие разделы показывать в ленте.</DialogDescription>
                </DialogHeader>
              </div>
              <div className="overflow-y-auto p-3 sm:p-4">
                <TopicsFilter
                  enabledCount={enabledTopicCount}
                  onReset={resetTopicFilters}
                  onToggle={setTopicEnabled}
                  selectedTopics={topicFilters}
                  topics={sectionTopicOptions}
                  totalCount={totalTopics}
                  variant="compact"
                />
              </div>
            </DialogContent>
          </Dialog>
        ) : null}
      </Container>
    </header>
  );
}
