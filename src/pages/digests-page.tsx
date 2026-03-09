import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, Search, Sparkles } from 'lucide-react';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FlatPage } from '@/components/layout/flat';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  indexDigestCardImpression,
  indexDigestCardOpen,
  indexDigestCardViewTime,
  indexDigestChipSelection,
  indexDigestQuickExit,
  indexDigestScrollDepth,
  indexDigestSectionImpression,
  indexDigestSeeAllClick,
} from '@/features/digests/behavior-indexing';
import { useTopicPosts } from '@/features/discover/hooks';
import { EmptyState } from '@/features/posts/components/empty-state';
import { FeedRow } from '@/features/posts/components/FeedRow';
import { PostCard } from '@/features/posts/components/post-card';
import type { ReactionSummary } from '@/features/reactions/api';
import { useReactions } from '@/features/reactions/use-reactions';
import { fetchMyTopicIds, fetchTopics } from '@/features/topics/api';
import {
  consumeDigestsPostOpen,
  consumeDigestsReturnIntent,
  markDigestsReturnIntent,
  readDigestsState,
  saveDigestsState,
  trackDigestsPostOpen,
} from '@/lib/digests-state';
import { getPostPath } from '@/lib/post-links';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import type { Post, Topic } from '@/types/db';

const initialTopicCount = 4;
const sectionPostsLimit = 5;
const modalPostsLimit = 30;
const pillsBarHeight = 84;
const pillActiveClass = 'border-primary bg-primary/10 text-foreground';

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

function getCurrentScrollY() {
  const container = document.getElementById('app-scroll') as HTMLElement | null;
  return container?.scrollTop ?? window.scrollY;
}

function restoreScrollY(scrollY: number) {
  const safeScrollY = Number.isFinite(scrollY) ? Math.max(0, scrollY) : 0;
  const container = document.getElementById('app-scroll') as HTMLElement | null;

  if (container) {
    container.scrollTo({ top: safeScrollY, behavior: 'auto' });
    return;
  }

  window.scrollTo({ top: safeScrollY, behavior: 'auto' });
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
    <div className="border-y border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p>{message}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAction}
          className="border-destructive/30 bg-transparent text-destructive hover:bg-destructive/10"
        >
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}

function SectionSkeleton() {
  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-background/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-7 w-44" />
        </div>
        <Skeleton className="h-8 w-24 rounded-full" />
      </div>
      <Skeleton className="h-48 w-full rounded-xl" />
      <div className="divide-y divide-border/60 rounded-xl border border-border/60">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="p-3">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-4/5" />
              </div>
              <Skeleton className="h-16 w-16 shrink-0 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopicSeeAllModal({
  onOpenChange,
  onOpenPost,
  open,
  topic,
}: {
  onOpenChange: (open: boolean) => void;
  onOpenPost: (post: Post, topicId: string | null) => void;
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
          <div className="border-b border-border/60 px-6 py-5">
            <DialogHeader className="pr-10">
              <DialogTitle>{topic?.name ?? 'Тема'}</DialogTitle>
              <DialogDescription>Все материалы этой секции.</DialogDescription>
            </DialogHeader>
          </div>
          <div className="overflow-y-auto px-6 py-5">
            {error ? <InlineError message={error} onAction={retry} /> : null}
            {isLoading ? (
              <div className="space-y-4">
                <SectionSkeleton />
                <SectionSkeleton />
              </div>
            ) : data.length === 0 ? (
              <EmptyState
                title="Пока материалов нет"
                description="Сейчас в этой теме нет публикаций."
                actionLabel="Повторить"
                onReset={retry}
              />
            ) : (
              <div className="divide-y divide-border/60">
                {data.map((post, index) => (
                  <PostCard
                    key={`${post.id}-modal`}
                    post={post}
                    index={index}
                    reactionSummary={summariesById.get(post.id)}
                    reactionsDisabled={isPending(post.id)}
                    onToggleReaction={toggle}
                    onOpenPost={(openedPost) => onOpenPost(openedPost, topic?.id ?? openedPost.topic?.id ?? openedPost.topic_id ?? null)}
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
  onOpenPost,
  onRetry,
  open,
  topics,
}: {
  activeTopicId: string | null;
  onOpenChange: (open: boolean) => void;
  onOpenPost: (post: Post, topicId: string | null) => void;
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
              <div className="mt-6 border-y border-dashed border-border/70 px-4 py-8 text-center">
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
                          'inline-flex min-h-12 items-center justify-between border px-4 py-3 text-left text-sm font-semibold transition',
                          selectedTopicId === topic.id ? pillActiveClass : 'border-border/70 text-foreground hover:bg-secondary/30',
                        )}
                      >
                        <span className="truncate">{topic.name}</span>
                        <span className={cn('text-xs', selectedTopicId === topic.id ? 'opacity-100' : 'opacity-0')}>{'✓'}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-6">
                  {error ? <InlineError message={error} onAction={retry} /> : null}
                  {isLoading ? (
                    <div className="space-y-4">
                      <SectionSkeleton />
                      <SectionSkeleton />
                    </div>
                  ) : data.length === 0 ? (
                    <EmptyState
                      title="Пока материалов нет"
                      description="Сейчас в этой теме нет публикаций."
                      actionLabel="Повторить"
                      onReset={retry}
                    />
                  ) : (
                    <div className="divide-y divide-border/60">
                      {data.map((post, index) => (
                        <PostCard
                          key={`${post.id}-sheet`}
                          post={post}
                          index={index}
                          reactionSummary={summariesById.get(post.id)}
                          reactionsDisabled={isPending(post.id)}
                          onToggleReaction={toggle}
                          onOpenPost={(openedPost) => onOpenPost(openedPost, selectedTopicId ?? openedPost.topic?.id ?? openedPost.topic_id ?? null)}
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
  isReactionPending,
  onData,
  onOpenPost,
  onOpenTopic,
  onRegister,
  onSectionImpression,
  onToggleReaction,
  reactionSummariesById,
  topic,
}: {
  enabled: boolean;
  isReactionPending: (postId: string) => boolean;
  onData: (topicId: string, posts: Post[]) => void;
  onOpenPost: (post: Post, topicId: string | null) => void;
  onOpenTopic: (topic: Topic) => void;
  onRegister: (topicId: string, element: HTMLElement | null) => void;
  onSectionImpression: (topicId: string, posts: Post[]) => void;
  onToggleReaction: (postId: string, value: -1 | 1) => void;
  reactionSummariesById: Map<string, ReactionSummary>;
  topic: Topic;
}) {
  const { data, error, isLoading, retry } = useTopicPosts(topic.id, sectionPostsLimit, enabled);
  const heroPost = data[0] ?? null;
  const secondaryPosts = data.slice(1);

  useEffect(() => {
    if (data.length > 0) {
      onData(topic.id, data);
    }
  }, [data, onData, topic.id]);

  useEffect(() => {
    if (!enabled || data.length === 0) {
      return;
    }

    onSectionImpression(topic.id, data);
  }, [data, enabled, onSectionImpression, topic.id]);

  return (
    <section
      ref={(node) => onRegister(topic.id, node)}
      data-topic-id={topic.id}
      className="scroll-mt-24 space-y-3 rounded-2xl border border-border/60 bg-background/60 p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Секция</p>
          <h2 className="mt-1 text-2xl font-extrabold sm:text-3xl">{topic.name}</h2>
        </div>
        <Button type="button" variant="ghost" className="shrink-0 px-0 text-primary hover:bg-transparent" onClick={() => onOpenTopic(topic)}>
          Смотреть всё
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {error ? <InlineError message={error} onAction={retry} /> : null}

      {isLoading && data.length === 0 ? (
        <SectionSkeleton />
      ) : data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Пока материалов нет.</p>
      ) : (
        <div className="space-y-3">
          {heroPost ? (
            <div className="rounded-xl border border-border/60 bg-background/40 px-3 py-1">
              <PostCard
                post={heroPost}
                index={0}
                reactionSummary={reactionSummariesById.get(heroPost.id)}
                reactionsDisabled={isReactionPending(heroPost.id)}
                onToggleReaction={onToggleReaction}
                onOpenPost={(openedPost) => onOpenPost(openedPost, topic.id)}
              />
            </div>
          ) : null}

          {secondaryPosts.length > 0 ? (
            <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-background/40 px-1">
              {secondaryPosts.map((post) => (
                <FeedRow
                  key={`${post.id}-secondary`}
                  post={post}
                  onOpen={(openedPost) => onOpenPost(openedPost, topic.id)}
                  reactionSummary={reactionSummariesById.get(post.id)}
                  reactionsDisabled={isReactionPending(post.id)}
                  onToggleReaction={onToggleReaction}
                />
              ))}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

export function DigestsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const restoredStateRef = useRef(readDigestsState());
  const hasReturnIntentRef = useRef(consumeDigestsReturnIntent());
  const scrollRestoredRef = useRef(false);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicIdsByUser, setTopicIdsByUser] = useState<string[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(true);
  const [topicsError, setTopicsError] = useState<string | null>(null);
  const [topicsRetryToken, setTopicsRetryToken] = useState(0);
  const [activeTopicId, setActiveTopicId] = useState<string | null>(restoredStateRef.current?.activeTopicId ?? null);
  const [visibleTopicIds, setVisibleTopicIds] = useState<Record<string, true>>(() => {
    const restoredIds = restoredStateRef.current?.visibleTopicIds ?? [];
    return restoredIds.reduce<Record<string, true>>((accumulator, topicId) => {
      accumulator[topicId] = true;
      return accumulator;
    }, {});
  });
  const [loadedPostsByTopic, setLoadedPostsByTopic] = useState<TopicPostsMap>({});
  const [searchQuery, setSearchQuery] = useState(restoredStateRef.current?.searchQuery ?? '');
  const deferredQuery = useDeferredValue(searchQuery.trim().toLowerCase());
  const [seeAllTopic, setSeeAllTopic] = useState<Topic | null>(null);
  const [allTopicsOpen, setAllTopicsOpen] = useState(false);
  const sectionRefs = useRef(new Map<string, HTMLElement>());
  const suppressUntilRef = useRef(0);
  const scheduleRafRef = useRef<number | null>(null);
  const selectedChipTopicsRef = useRef(new Set<string>());
  const topicEngagementRef = useRef(new Map<string, number>());
  const activeTopicStartedAtRef = useRef(Date.now());
  const lastActiveTopicRef = useRef<string | null>(null);

  const persistDigestsState = useCallback(
    (scrollY?: number) => {
      saveDigestsState({
        activeTopicId,
        searchQuery,
        scrollY: Number.isFinite(scrollY) ? Number(scrollY) : getCurrentScrollY(),
        visibleTopicIds: Object.keys(visibleTopicIds),
      });
    },
    [activeTopicId, searchQuery, visibleTopicIds],
  );

  const markTopicEngagement = useCallback((topicId: string | null) => {
    if (!topicId) {
      return;
    }

    const normalizedTopicId = topicId.trim();
    if (!normalizedTopicId) {
      return;
    }

    topicEngagementRef.current.set(normalizedTopicId, (topicEngagementRef.current.get(normalizedTopicId) ?? 0) + 1);
  }, []);

  const handleOpenPost = useCallback(
    (post: Post, topicId: string | null) => {
      const resolvedTopicId = topicId?.trim() || post.topic?.id || post.topic_id || null;
      const scrollY = getCurrentScrollY();
      persistDigestsState(scrollY);
      markDigestsReturnIntent();
      trackDigestsPostOpen({
        openedAt: Date.now(),
        postId: post.id,
        topicId: resolvedTopicId,
      });

      if (resolvedTopicId) {
        indexDigestCardOpen(post.id, resolvedTopicId);
        markTopicEngagement(resolvedTopicId);
      }
    },
    [markTopicEngagement, persistDigestsState],
  );

  const openPost = useCallback(
    (post: Post, topicId: string | null) => {
      handleOpenPost(post, topicId);
      void navigate(getPostPath(post.id), {
        state: {
          from: `${location.pathname}${location.search}`,
        },
      });
    },
    [handleOpenPost, location.pathname, location.search, navigate],
  );

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
        setTopicsError('Не удалось загрузить темы.');
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

  useEffect(() => {
    const openTrace = consumeDigestsPostOpen();
    if (!openTrace?.topicId) {
      return;
    }

    const durationMs = Date.now() - openTrace.openedAt;
    indexDigestCardViewTime(openTrace.postId, openTrace.topicId, durationMs);
  }, []);

  useEffect(() => {
    persistDigestsState(getCurrentScrollY());
  }, [activeTopicId, persistDigestsState, searchQuery, visibleTopicIds]);

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
  }, [scheduleCompute, topicsOrdered.length]);

  useEffect(() => {
    if (!activeTopicId) {
      return;
    }

    const scrollEl = document.getElementById('app-scroll');
    const target = scrollEl ?? window;

    const trackDepth = () => {
      const container = document.getElementById('app-scroll') as HTMLElement | null;
      const scrollTop = container?.scrollTop ?? window.scrollY;
      const viewportHeight = container?.clientHeight ?? window.innerHeight;
      const scrollHeight = container?.scrollHeight ?? document.documentElement.scrollHeight;
      const maxScrollable = Math.max(1, scrollHeight - viewportHeight);
      const depthPercent = Math.min(100, (scrollTop / maxScrollable) * 100);
      indexDigestScrollDepth(activeTopicId, depthPercent);
    };

    trackDepth();

    if (target instanceof Window) {
      window.addEventListener('scroll', trackDepth, { passive: true });
    } else {
      target.addEventListener('scroll', trackDepth, { passive: true });
    }
    window.addEventListener('resize', trackDepth);

    return () => {
      if (target instanceof Window) {
        window.removeEventListener('scroll', trackDepth);
      } else {
        target.removeEventListener('scroll', trackDepth);
      }
      window.removeEventListener('resize', trackDepth);
    };
  }, [activeTopicId]);

  useEffect(() => {
    const previousTopicId = lastActiveTopicRef.current;
    const now = Date.now();

    if (previousTopicId && previousTopicId !== activeTopicId) {
      const durationMs = now - activeTopicStartedAtRef.current;
      const interactionsCount = topicEngagementRef.current.get(previousTopicId) ?? 0;
      if (interactionsCount === 0) {
        indexDigestQuickExit(previousTopicId, durationMs);
      }
    }

    if (activeTopicId && previousTopicId !== activeTopicId) {
      lastActiveTopicRef.current = activeTopicId;
      activeTopicStartedAtRef.current = now;
    }
  }, [activeTopicId]);

  useEffect(() => {
    return () => {
      const topicId = lastActiveTopicRef.current;
      if (!topicId) {
        return;
      }

      const durationMs = Date.now() - activeTopicStartedAtRef.current;
      const interactionsCount = topicEngagementRef.current.get(topicId) ?? 0;
      if (interactionsCount === 0) {
        indexDigestQuickExit(topicId, durationMs);
      }
    };
  }, []);

  useEffect(() => {
    if (!hasReturnIntentRef.current || scrollRestoredRef.current || topicsLoading) {
      return;
    }

    const targetScrollY = restoredStateRef.current?.scrollY ?? 0;
    const frame = requestAnimationFrame(() => {
      restoreScrollY(targetScrollY);
      scrollRestoredRef.current = true;
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [topicsLoading, topicsOrdered.length]);

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

  const scrollToTopic = useCallback(
    (topicId: string) => {
      const wasSelectedBefore = selectedChipTopicsRef.current.has(topicId);
      selectedChipTopicsRef.current.add(topicId);
      indexDigestChipSelection(topicId, wasSelectedBefore);

      setVisibleTopicIds((current) => ({ ...current, [topicId]: true }));
      suppressUntilRef.current = Date.now() + 600;
      setActiveTopicId(topicId);
      markTopicEngagement(topicId);

      sectionRefs.current.get(topicId)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    },
    [markTopicEngagement],
  );

  const handleSectionData = useCallback((topicId: string, posts: Post[]) => {
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
  }, []);

  const handleSectionImpression = useCallback((topicId: string, posts: Post[]) => {
    indexDigestSectionImpression(topicId);
    posts.forEach((post) => {
      indexDigestCardImpression(post.id, topicId);
    });
  }, []);

  const handleOpenTopic = useCallback(
    (topic: Topic) => {
      indexDigestSeeAllClick(topic.id);
      markTopicEngagement(topic.id);
      setSeeAllTopic(topic);
    },
    [markTopicEngagement],
  );

  const searchResults = useMemo(() => {
    if (!deferredQuery) {
      return [];
    }

    const dedupedPosts = new Map<string, Post>();
    Object.values(loadedPostsByTopic)
      .flat()
      .forEach((post) => {
        if (!dedupedPosts.has(post.id)) {
          dedupedPosts.set(post.id, post);
        }
      });

    return [...dedupedPosts.values()].filter((post) => {
      const title = post.title.toLowerCase();
      const excerpt = post.excerpt?.toLowerCase() ?? '';
      return title.includes(deferredQuery) || excerpt.includes(deferredQuery);
    });
  }, [deferredQuery, loadedPostsByTopic]);

  const digestPostIds = useMemo(() => [...new Set(Object.values(loadedPostsByTopic).flat().map((post) => post.id))], [loadedPostsByTopic]);
  const { summariesById, toggle, isPending } = useReactions(digestPostIds);

  return (
    <>
      <FlatPage className="safe-pb py-6 sm:py-8">
        <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="space-y-6">
          <div className="border-b border-border/60 pb-5 sm:pb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Сводки</p>
                <h1 className="mt-1 text-3xl font-extrabold sm:text-4xl">Сводки</h1>
              </div>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">Выбирайте тему, открывайте материалы и продолжайте просмотр с того же места.</p>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="h-12 rounded-[1.25rem] border-border/70 bg-background/80 pl-11 pr-24"
              placeholder="Поиск по материалам"
            />
            {searchQuery.trim() ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 h-8 -translate-y-1/2 px-2 text-xs text-muted-foreground"
                onClick={() => setSearchQuery('')}
              >
                Очистить
              </Button>
            ) : null}
          </div>

          {topicsError ? <InlineError message={topicsError} onAction={() => setTopicsRetryToken((current) => current + 1)} /> : null}
        </motion.section>
      </FlatPage>

      <div className="fixed inset-x-0 top-[var(--tma-content-safe-top)] z-[60] border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="w-full px-4 py-3 sm:px-6">
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
                          activeTopicId === topic.id ? pillActiveClass : 'border-border/70 text-muted-foreground hover:bg-secondary/30 hover:text-foreground',
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
        </div>
      </div>

      <div style={{ paddingTop: pillsBarHeight }}>
        <FlatPage className="safe-pb py-4 sm:py-6">
          {topicsLoading ? (
            <div className="space-y-6">
              <SectionSkeleton />
              <SectionSkeleton />
            </div>
          ) : deferredQuery ? (
            <AnimatePresence mode="wait">
              <motion.div
                key="search-results"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-2xl font-extrabold">Результаты поиска</h2>
                  <span className="text-sm text-muted-foreground">Совпадений: {searchResults.length}</span>
                </div>
                {searchResults.length === 0 ? (
                  <EmptyState
                    title="Ничего не найдено"
                    description="Прокрутите больше секций или измените запрос."
                    actionLabel="Очистить поиск"
                    onReset={() => setSearchQuery('')}
                  />
                ) : (
                  <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-background/40 px-1">
                    {searchResults.map((post) => (
                      <FeedRow
                        key={`${post.id}-search`}
                        post={post}
                        onOpen={(openedPost) => openPost(openedPost, openedPost.topic?.id ?? openedPost.topic_id ?? null)}
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
            <div className="space-y-4">
              {topicsOrdered.map((topic) => (
                <TopicSection
                  key={topic.id}
                  topic={topic}
                  enabled={Boolean(visibleTopicIds[topic.id])}
                  isReactionPending={isPending}
                  onData={handleSectionData}
                  onOpenPost={(post, topicId) => openPost(post, topicId)}
                  onOpenTopic={handleOpenTopic}
                  onRegister={handleRegisterSection}
                  onSectionImpression={handleSectionImpression}
                  onToggleReaction={toggle}
                  reactionSummariesById={summariesById}
                />
              ))}
            </div>
          )}
        </FlatPage>
      </div>

      <TopicSeeAllModal
        topic={seeAllTopic}
        open={seeAllTopic !== null}
        onOpenPost={handleOpenPost}
        onOpenChange={(open) => !open && setSeeAllTopic(null)}
      />
      <AllTopicsSheet
        topics={topicsOrdered}
        activeTopicId={activeTopicId}
        open={allTopicsOpen}
        onOpenPost={handleOpenPost}
        onOpenChange={setAllTopicsOpen}
        onRetry={() => setTopicsRetryToken((current) => current + 1)}
      />
    </>
  );
}
