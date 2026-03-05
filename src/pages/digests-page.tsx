import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, Search, Sparkles } from 'lucide-react';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Container } from '@/components/layout/container';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useTopicPosts } from '@/features/discover/hooks';
import { EmptyState } from '@/features/posts/components/empty-state';
import { FeedSkeleton } from '@/features/posts/components/feed-skeleton';
import { PostCard } from '@/features/posts/components/post-card';
import { useReactions } from '@/features/reactions/use-reactions';
import type { ReactionSummary } from '@/features/reactions/api';
import { fetchMyTopicIds, fetchTopics } from '@/features/topics/api';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import type { Post, Topic } from '@/types/db';

const initialTopicCount = 4;
const sectionPostsLimit = 5;
const modalPostsLimit = 30;
const pillsBarHeight = 84;
const pillActiveClass = 'border-transparent bg-primary text-primary-foreground shadow-lg shadow-primary/20';

type TopicPostsMap = Record<string, Post[]>;

function isAbortLikeError(error: unknown) {
  if (!error) {
    return false;
  }

  if (error instanceof DOMException) {
    return error.name === 'AbortError';
  }

  if (error instanceof Error) {
    return error.name === 'AbortError' || error.message.includes('AbortError');
  }

  return String(error).includes('AbortError');
}

function InlineError({
  actionLabel = 'Повторить',
  message,
  onAction,
}: {
  actionLabel?: string;
  message: string;
  onAction: () => void;
}) {
  return (
    <div className="rounded-[1.5rem] border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p>{message}</p>
        <Button type="button" variant="outline" size="sm" onClick={onAction} className="border-destructive/30 bg-transparent text-destructive hover:bg-destructive/10">
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}

function SectionSkeleton() {
  return (
    <div className="space-y-4">
      <div className="overflow-hidden p-4">
        <Skeleton className="aspect-[16/9] w-full rounded-[1.25rem]" />
        <div className="mt-4 space-y-3">
          <Skeleton className="h-4 w-20 rounded-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-5 w-5/6" />
          <Skeleton className="h-5 w-2/3" />
        </div>
      </div>
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="min-w-[240px] overflow-hidden p-4 sm:min-w-[300px]">
            <Skeleton className="aspect-[16/9] w-full rounded-[1.25rem]" />
            <div className="mt-4 space-y-3">
              <Skeleton className="h-4 w-16 rounded-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopicSeeAllModal({
  onOpenChange,
  open,
  topic,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  topic: Topic | null;
}) {
  const { data, error, isLoading, retry } = useTopicPosts(topic?.id ?? '', modalPostsLimit, open && Boolean(topic?.id));
  const postIds = useMemo(() => data.map((post) => post.id), [data]);
  const { summariesById, toggle, isPending } = useReactions(postIds);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] max-w-5xl overflow-hidden p-0">
        <div className="flex max-h-[calc(100svh-2rem)] flex-col overflow-hidden">
          <div className="border-b border-border/70 px-6 py-5">
            <DialogHeader className="pr-10">
              <DialogTitle>{topic?.name ?? 'Тема'}</DialogTitle>
              <DialogDescription>Последние материалы по этой теме.</DialogDescription>
            </DialogHeader>
          </div>
          <div className="overflow-y-auto px-6 py-5">
            {error ? <InlineError message={error} onAction={retry} /> : null}
            {isLoading ? (
              <FeedSkeleton />
            ) : data.length === 0 ? (
              <EmptyState title="Пока материалов нет" description="Сейчас в этой теме нет публикаций." actionLabel="Повторить" onReset={retry} />
            ) : (
              <div className="grid gap-5">
                {data.map((post, index) => (
                  <PostCard
                    key={`${post.id}-modal`}
                    post={post}
                    index={index}
                    reactionSummary={summariesById.get(post.id)}
                    reactionsDisabled={isPending(post.id)}
                    onToggleReaction={toggle}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AllTopicsSheet({
  activeTopicId,
  onOpenChange,
  onRetry,
  open,
  topics,
}: {
  activeTopicId: string | null;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
  open: boolean;
  topics: Topic[];
}) {
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(activeTopicId);

  useEffect(() => {
    if (!open) {
      return;
    }

    setSelectedTopicId(activeTopicId ?? topics[0]?.id ?? null);
  }, [activeTopicId, open, topics]);

  const { data, error, isLoading, retry } = useTopicPosts(selectedTopicId ?? '', modalPostsLimit, open && Boolean(selectedTopicId));
  const postIds = useMemo(() => data.map((post) => post.id), [data]);
  const { summariesById, toggle, isPending } = useReactions(postIds);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="inset-x-0 bottom-0 top-auto z-[100] w-full max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-b-none rounded-t-[2rem] border-x-0 border-b-0 border-t border-border/70 p-0">
        <div className="max-h-[85svh] overflow-hidden">
          <div className="safe-pb max-h-[85svh] overflow-y-auto px-5 pb-6 pt-5 sm:px-6">
            <DialogHeader className="pr-10 text-left">
              <DialogTitle className="text-2xl">Все темы</DialogTitle>
              <DialogDescription>Просматривайте материалы по темам, не покидая раздел.</DialogDescription>
            </DialogHeader>

            {topics.length === 0 ? (
              <div className="mt-6 rounded-[1.5rem] border border-dashed border-border/70 bg-card/60 px-4 py-8 text-center">
                <p className="text-sm text-muted-foreground">Тем пока нет</p>
                <Button type="button" variant="secondary" className="mt-4" onClick={onRetry}>
                  Повторить
                </Button>
              </div>
            ) : (
              <>
                <div className="no-scrollbar mt-6 overflow-x-auto pb-2">
                  <div className="flex min-w-max gap-3">
                    {topics.map((topic) => (
                      <button
                        key={topic.id}
                        type="button"
                        onClick={() => setSelectedTopicId(topic.id)}
                        className={cn(
                          'inline-flex min-h-12 items-center justify-between rounded-full border px-4 py-3 text-left text-sm font-semibold transition',
                          selectedTopicId === topic.id ? pillActiveClass : 'border-border/70 bg-card/70 text-foreground hover:bg-secondary/80',
                        )}
                      >
                        <span className="truncate">{topic.name}</span>
                        <span className={cn('text-xs', selectedTopicId === topic.id ? 'opacity-100' : 'opacity-0')}>{'\u2713'}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-6">
                  {error ? <InlineError message={error} onAction={retry} /> : null}
                  {isLoading ? (
                    <FeedSkeleton />
                  ) : data.length === 0 ? (
                    <EmptyState title="Пока материалов нет" description="Сейчас в этой теме нет публикаций." actionLabel="Повторить" onReset={retry} />
                  ) : (
                    <div className="grid gap-5">
                      {data.map((post, index) => (
                        <PostCard
                          key={`${post.id}-sheet`}
                          post={post}
                          index={index}
                          reactionSummary={summariesById.get(post.id)}
                          reactionsDisabled={isPending(post.id)}
                          onToggleReaction={toggle}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TopicSection({
  enabled,
  reactionSummariesById,
  isReactionPending,
  onData,
  onOpenTopic,
  onRegister,
  onToggleReaction,
  topic,
}: {
  enabled: boolean;
  reactionSummariesById: Map<string, ReactionSummary>;
  isReactionPending: (postId: string) => boolean;
  onData: (topicId: string, posts: Post[]) => void;
  onOpenTopic: (topic: Topic) => void;
  onRegister: (topicId: string, element: HTMLElement | null) => void;
  onToggleReaction: (postId: string, value: -1 | 1) => void;
  topic: Topic;
}) {
  const { data, error, isLoading, retry } = useTopicPosts(topic.id, sectionPostsLimit, enabled);

  useEffect(() => {
    if (data.length > 0) {
      onData(topic.id, data);
    }
  }, [data, onData, topic.id]);

  const featuredPost = data[0] ?? null;
  const railPosts = data.slice(1);

  return (
    <section
      ref={(node) => onRegister(topic.id, node)}
      data-topic-id={topic.id}
      className="scroll-mt-24 space-y-4 border-b border-border/60 p-5 sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Тема</p>
          <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">{topic.name}</h2>
        </div>
        <Button type="button" variant="ghost" className="shrink-0 px-0 text-primary hover:bg-transparent" onClick={() => onOpenTopic(topic)}>
          Все
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {error ? <InlineError message={error} onAction={retry} /> : null}

      {isLoading && data.length === 0 ? (
        <SectionSkeleton />
      ) : data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Пока материалов нет.</p>
      ) : (
        <div className="space-y-5">
          {featuredPost ? (
            <PostCard
              post={featuredPost}
              index={0}
              reactionSummary={reactionSummariesById.get(featuredPost.id)}
              reactionsDisabled={isReactionPending(featuredPost.id)}
              onToggleReaction={onToggleReaction}
            />
          ) : null}
          <div className="no-scrollbar overflow-x-auto pb-2">
            <div className="flex snap-x gap-4">
              {railPosts.map((post, index) => (
                <div key={post.id} className="min-w-[260px] snap-start sm:min-w-[300px]">
                  <PostCard
                    post={post}
                    index={index + 1}
                    reactionSummary={reactionSummariesById.get(post.id)}
                    reactionsDisabled={isReactionPending(post.id)}
                    onToggleReaction={onToggleReaction}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export function DigestsPage() {
  const { user } = useAuth();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicIdsByUser, setTopicIdsByUser] = useState<string[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(true);
  const [topicsError, setTopicsError] = useState<string | null>(null);
  const [topicsRetryToken, setTopicsRetryToken] = useState(0);
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [visibleTopicIds, setVisibleTopicIds] = useState<Record<string, true>>({});
  const [loadedPostsByTopic, setLoadedPostsByTopic] = useState<TopicPostsMap>({});
  const [searchQuery, setSearchQuery] = useState('');
  const deferredQuery = useDeferredValue(searchQuery.trim().toLowerCase());
  const [seeAllTopic, setSeeAllTopic] = useState<Topic | null>(null);
  const [allTopicsOpen, setAllTopicsOpen] = useState(false);
  const sectionRefs = useRef(new Map<string, HTMLElement>());
  const suppressUntilRef = useRef(0);
  const scheduleRafRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTopicsLoading(true);
    setTopicsError(null);

    void fetchTopics(undefined, { force: topicsRetryToken > 0 })
      .then((nextTopics) => {
        if (cancelled) {
          return;
        }

        setTopics(nextTopics);
      })
      .catch((error) => {
        if (cancelled || isAbortLikeError(error)) {
          return;
        }

        setTopics([]);
        setTopicsError('Failed to load topics.');
      })
      .finally(() => {
        if (!cancelled) {
          setTopicsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [topicsRetryToken]);

  useEffect(() => {
    if (!user?.id) {
      setTopicIdsByUser([]);
      return;
    }

    const controller = new AbortController();

    void fetchMyTopicIds(user.id, controller.signal)
      .then((preferredTopicIds) => {
        if (!controller.signal.aborted) {
          setTopicIdsByUser(preferredTopicIds);
        }
      })
      .catch((error) => {
        if (controller.signal.aborted || isAbortLikeError(error)) {
          return;
        }

        setTopicIdsByUser([]);
      });

    return () => {
      controller.abort();
    };
  }, [user?.id]);

  const topicsOrdered = useMemo(() => {
    const preferredSet = new Set(topicIdsByUser);
    const preferredTopics = topics.filter((topic) => preferredSet.has(topic.id));
    const otherTopics = topics.filter((topic) => !preferredSet.has(topic.id));
    return [...preferredTopics, ...otherTopics];
  }, [topicIdsByUser, topics]);

  useEffect(() => {
    if (topicsOrdered.length === 0) {
      setActiveTopicId(null);
      return;
    }

    if (!activeTopicId || !topicsOrdered.some((topic) => topic.id === activeTopicId)) {
      setActiveTopicId(topicsOrdered[0].id);
    }
  }, [activeTopicId, topicsOrdered]);

  useEffect(() => {
    if (topicsOrdered.length === 0) {
      return;
    }

    setVisibleTopicIds((current) => {
      const next = { ...current };

      topicsOrdered.slice(0, initialTopicCount).forEach((topic) => {
        next[topic.id] = true;
      });

      return next;
    });
  }, [topicsOrdered]);

  useEffect(() => {
    if (topicsOrdered.length === 0) {
      return;
    }

    const elements = topicsOrdered
      .map((topic) => sectionRefs.current.get(topic.id))
      .filter((element): element is HTMLElement => Boolean(element));

    if (elements.length === 0) {
      return;
    }

    const preloadObserver = new IntersectionObserver(
      (entries) => {
        setVisibleTopicIds((current) => {
          let changed = false;
          const next = { ...current };

          entries.forEach((entry) => {
            if (!entry.isIntersecting) {
              return;
            }

            const topicId = entry.target.getAttribute('data-topic-id');

            if (topicId && !next[topicId]) {
              next[topicId] = true;
              changed = true;
            }
          });

          return changed ? next : current;
        });
      },
      {
        rootMargin: '240px 0px',
        threshold: 0.01,
      },
    );

    elements.forEach((element) => {
      preloadObserver.observe(element);
    });

    return () => {
      preloadObserver.disconnect();
    };
  }, [topicsOrdered]);

  const computeActive = useCallback(() => {
    if (Date.now() < suppressUntilRef.current) {
      return;
    }

    const anchorY = pillsBarHeight + 12;
    let bestAboveDiff = Number.NEGATIVE_INFINITY;
    let bestAboveTopicId: string | null = null;
    let bestBelowDiff = Number.POSITIVE_INFINITY;
    let bestBelowTopicId: string | null = null;

    sectionRefs.current.forEach((element, topicId) => {
      if (!element || !element.dataset.topicId) {
        return;
      }

      const diff = element.getBoundingClientRect().top - anchorY;

      if (diff <= 0) {
        if (diff > bestAboveDiff) {
          bestAboveDiff = diff;
          bestAboveTopicId = topicId;
        }
        return;
      }

      if (diff < bestBelowDiff) {
        bestBelowDiff = diff;
        bestBelowTopicId = topicId;
      }
    });

    const candidateTopicId = bestAboveTopicId ?? bestBelowTopicId;

    if (!candidateTopicId) {
      return;
    }

    setActiveTopicId((current) => (current === candidateTopicId ? current : candidateTopicId));
  }, []);

  const scheduleCompute = useCallback(() => {
    if (scheduleRafRef.current !== null) {
      return;
    }

    scheduleRafRef.current = requestAnimationFrame(() => {
      scheduleRafRef.current = null;
      computeActive();
    });
  }, [computeActive]);

  useEffect(() => {
    if (topicsOrdered.length === 0) {
      return;
    }

    const scrollEl = document.getElementById('app-scroll');
    const target = scrollEl ?? window;
    const onScroll = () => scheduleCompute();
    const onResize = () => scheduleCompute();

    scheduleCompute();
    if (target instanceof Window) {
      window.addEventListener('scroll', onScroll, { passive: true });
    } else {
      target.addEventListener('scroll', onScroll, { passive: true });
    }
    window.addEventListener('resize', onResize);

    return () => {
      if (scheduleRafRef.current !== null) {
        cancelAnimationFrame(scheduleRafRef.current);
        scheduleRafRef.current = null;
      }

      if (target instanceof Window) {
        window.removeEventListener('scroll', onScroll);
      } else {
        target.removeEventListener('scroll', onScroll);
      }
      window.removeEventListener('resize', onResize);
    };
  }, [scheduleCompute, computeActive, topicsOrdered.length]);

  const handleRegisterSection = useCallback(
    (topicId: string, element: HTMLElement | null) => {
      const currentElement = sectionRefs.current.get(topicId) ?? null;

      if (!element) {
        if (currentElement) {
          sectionRefs.current.delete(topicId);
        }
        return;
      }

      if (currentElement !== element) {
        sectionRefs.current.set(topicId, element);
        scheduleCompute();
      }
    },
    [scheduleCompute],
  );

  const scrollToTopic = (topicId: string) => {
    setVisibleTopicIds((current) => ({ ...current, [topicId]: true }));
    suppressUntilRef.current = Date.now() + 600;
    setActiveTopicId(topicId);
    sectionRefs.current.get(topicId)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  const handleSectionData = (topicId: string, posts: Post[]) => {
    setLoadedPostsByTopic((current) => {
      const previousPosts = current[topicId];

      if (previousPosts === posts) {
        return current;
      }

      return {
        ...current,
        [topicId]: posts,
      };
    });
  };

  const searchResults = useMemo(() => {
    if (!deferredQuery) {
      return [];
    }

    const deduped = new Map<string, Post>();

    Object.values(loadedPostsByTopic)
      .flat()
      .forEach((post) => {
        if (!deduped.has(post.id)) {
          deduped.set(post.id, post);
        }
      });

    return [...deduped.values()].filter((post) => post.title.toLowerCase().includes(deferredQuery));
  }, [deferredQuery, loadedPostsByTopic]);
  const digestPostIds = useMemo(
    () =>
      [...new Set(Object.values(loadedPostsByTopic).flat().map((post) => post.id))],
    [loadedPostsByTopic],
  );
  const { summariesById, toggle, isPending } = useReactions(digestPostIds);

  return (
    <>
      <Container className="safe-pb py-6 sm:py-8">
        <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="space-y-6">
          <div className="border-b border-border/60 pb-5 sm:pb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Обзор</p>
                <h1 className="mt-1 text-3xl font-extrabold sm:text-4xl">Обзор</h1>
              </div>
            </div>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="h-12 rounded-[1.25rem] border-border/70 bg-background/80 pl-11"
              placeholder="Поиск по материалам"
            />
          </div>

          {topicsError ? <InlineError message={topicsError} onAction={() => setTopicsRetryToken((current) => current + 1)} actionLabel="Повторить" /> : null}
        </motion.section>
      </Container>

      <div className="fixed inset-x-0 top-0 z-[60] border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <Container className="py-3">
          <div className="flex items-center gap-3">
            <div className="no-scrollbar flex-1 overflow-x-auto">
              <div className="flex min-w-max gap-3">
                {topicsLoading
                  ? Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-11 w-28 rounded-full" />)
                  : topicsOrdered.map((topic) => (
                      <button
                        key={topic.id}
                        type="button"
                        onClick={() => scrollToTopic(topic.id)}
                        className={cn(
                          'rounded-full border px-4 py-2.5 text-sm font-semibold transition',
                          activeTopicId === topic.id ? pillActiveClass : 'border-border/70 bg-card/70 text-muted-foreground hover:bg-secondary/80 hover:text-foreground',
                        )}
                      >
                        {topic.name}
                      </button>
                    ))}
              </div>
            </div>

            <Button type="button" variant="outline" className="shrink-0 rounded-full" onClick={() => setAllTopicsOpen(true)}>
              Все темы
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </Container>
      </div>

      <div style={{ paddingTop: pillsBarHeight }}>
        <Container className="safe-pb py-4 sm:py-6">
          {topicsLoading ? (
            <div className="space-y-6">
              <SectionSkeleton />
              <SectionSkeleton />
            </div>
          ) : deferredQuery ? (
            <AnimatePresence mode="wait">
              <motion.div key="search-results" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-2xl font-extrabold">Результаты поиска</h2>
                  <span className="text-sm text-muted-foreground">Совпадений: {searchResults.length}</span>
                </div>
                {searchResults.length === 0 ? (
                  <EmptyState
                    title="Ничего не найдено"
                    description="Поиск работает только по материалам из уже загруженных секций на этом экране. Прокрутите ещё несколько разделов или измените запрос."
                    actionLabel="Очистить поиск"
                    onReset={() => setSearchQuery('')}
                  />
                ) : (
                  <div className="grid gap-5">
                    {searchResults.map((post, index) => (
                      <PostCard
                        key={`${post.id}-search`}
                        post={post}
                        index={index}
                        reactionSummary={summariesById.get(post.id)}
                        reactionsDisabled={isPending(post.id)}
                        onToggleReaction={toggle}
                      />
                    ))}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          ) : !topicsError && topics.length === 0 ? (
            <EmptyState
              title="Тем пока нет"
              description="Темы появятся здесь, как только редакционная подборка будет заполнена."
              actionLabel="Повторить"
              onReset={() => setTopicsRetryToken((current) => current + 1)}
            />
          ) : (
            <div className="space-y-6">
              {topicsOrdered.map((topic) => (
                <TopicSection
                  key={topic.id}
                  topic={topic}
                  enabled={Boolean(visibleTopicIds[topic.id])}
                  reactionSummariesById={summariesById}
                  isReactionPending={isPending}
                  onData={handleSectionData}
                  onOpenTopic={setSeeAllTopic}
                  onRegister={handleRegisterSection}
                  onToggleReaction={toggle}
                />
              ))}
            </div>
          )}
        </Container>
      </div>

      <TopicSeeAllModal topic={seeAllTopic} open={seeAllTopic !== null} onOpenChange={(open) => !open && setSeeAllTopic(null)} />
      <AllTopicsSheet
        topics={topicsOrdered}
        activeTopicId={activeTopicId}
        open={allTopicsOpen}
        onOpenChange={setAllTopicsOpen}
        onRetry={() => setTopicsRetryToken((current) => current + 1)}
      />
    </>
  );
}
