import { motion } from 'framer-motion';
import { RefreshCw, Search, Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import type { AppLayoutContext } from '@/App';
import { FlatPage, FlatSection } from '@/components/layout/flat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StateCard } from '@/components/ui/state-card';
import { EmptyState } from '@/features/posts/components/empty-state';
import { FeedRow } from '@/features/posts/components/FeedRow';
import { isPostRead, useFilteredFeedPosts, useReadingProgress } from '@/features/reading/reading-progress';
import { useRecommendationsPreferences } from '@/features/recommendations/preferences';
import { forYouSearchStorageKey, usePersistentSearchQuery, usePostSearch } from '@/features/search/post-search';
import { useReactions } from '@/features/reactions/use-reactions';
import { useRecommendedPosts } from '@/features/recommendations/hooks';
import { fetchMyTopicIds } from '@/features/topics/api';
import { useAuth } from '@/providers/auth-provider';
import type { Post, Topic } from '@/types/db';

const defaultLimit = 20;
const autoReadBoostThreshold = 2;

function InlineError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="border-y border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p>{message}</p>
        <Button variant="outline" size="sm" onClick={onRetry} className="border-destructive/35 bg-transparent text-destructive hover:bg-destructive/10">
          <RefreshCw className="h-4 w-4" />
          Повторить
        </Button>
      </div>
    </div>
  );
}

function FeedRowsSkeleton() {
  return (
    <div className="divide-y divide-border/60">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="py-4">
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3 w-28 animate-pulse rounded bg-secondary" />
              <div className="h-6 w-full animate-pulse rounded bg-secondary" />
              <div className="h-6 w-4/5 animate-pulse rounded bg-secondary" />
              <div className="h-3 w-32 animate-pulse rounded bg-secondary" />
            </div>
            <div className="h-20 w-20 shrink-0 animate-pulse rounded-xl bg-secondary sm:h-24 sm:w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

function attachTopics(posts: Post[], topics: Array<Topic & { count: number }>) {
  const topicMap = new Map(
    topics
      .filter((topic) => topic.id !== 'all')
      .map((topic) => [
        topic.id,
        {
          created_at: topic.created_at,
          id: topic.id,
          name: topic.name,
          slug: topic.slug,
        } satisfies Topic,
      ]),
  );

  return posts.map((post) => ({
    ...post,
    topic: post.topic ?? topicMap.get(post.topic_id) ?? null,
  }));
}

function getTopicKey(post: Post) {
  return post.topic?.id ?? post.topic_id ?? null;
}

export function ForYouPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { topics, posts: knownPosts } = useOutletContext<AppLayoutContext>();
  const { readPostIds, setHiddenReadEnabled } = useReadingProgress();
  const { clearTopicPreference, dislikeTopic, dislikedTopics, getTopicPreference, likeTopic, likedTopics, readTopics } = useRecommendationsPreferences();
  const [searchQuery, setSearchQuery] = usePersistentSearchQuery(forYouSearchStorageKey);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [preferredTopicIds, setPreferredTopicIds] = useState<string[] | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const { data, error, isLoading, retry } = useRecommendedPosts(defaultLimit);
  const recommendedPosts = useMemo(() => attachTopics(data, topics), [data, topics]);
  const preferredTopicIdSet = useMemo(() => new Set(preferredTopicIds ?? []), [preferredTopicIds]);

  useEffect(() => {
    if (!user?.id) {
      setPreferredTopicIds(null);
      return;
    }

    const controller = new AbortController();
    setPreferredTopicIds(null);

    void fetchMyTopicIds(user.id, controller.signal)
      .then((topicIds) => {
        if (controller.signal.aborted) {
          return;
        }

        setPreferredTopicIds(topicIds);
      })
      .catch(() => {
        if (controller.signal.aborted) {
          return;
        }

        setPreferredTopicIds(null);
      });

    return () => {
      controller.abort();
    };
  }, [user?.id]);

  const profileScopedPosts = useMemo(() => {
    if (!user?.id || preferredTopicIds === null) {
      return recommendedPosts;
    }

    if (preferredTopicIdSet.size === 0) {
      return [];
    }

    return recommendedPosts.filter((post) => preferredTopicIdSet.has(post.topic_id));
  }, [preferredTopicIdSet, preferredTopicIds, recommendedPosts, user?.id]);

  const likedTopicsSet = useMemo(() => new Set(likedTopics), [likedTopics]);
  const dislikedTopicsSet = useMemo(() => new Set(dislikedTopics), [dislikedTopics]);
  const topicAffinityCounts = useMemo(() => {
    const mergedCounts = new Map<string, number>();

    for (const [topicKey, count] of Object.entries(readTopics)) {
      const normalizedTopicKey = topicKey.trim();
      if (!normalizedTopicKey || !Number.isFinite(count) || count <= 0) {
        continue;
      }

      mergedCounts.set(normalizedTopicKey, Math.max(0, Math.floor(count)));
    }

    const inferredCounts = new Map<string, number>();
    const readIds = new Set(readPostIds);

    for (const post of [...recommendedPosts, ...knownPosts]) {
      if (!readIds.has(post.id)) {
        continue;
      }

      const topicKey = getTopicKey(post);
      if (!topicKey) {
        continue;
      }

      inferredCounts.set(topicKey, (inferredCounts.get(topicKey) ?? 0) + 1);
    }

    for (const [topicKey, count] of inferredCounts) {
      const currentCount = mergedCounts.get(topicKey) ?? 0;
      mergedCounts.set(topicKey, Math.max(currentCount, count));
    }

    return mergedCounts;
  }, [knownPosts, readPostIds, readTopics, recommendedPosts]);
  const postsAfterDislikedFilter = useMemo(() => {
    if (dislikedTopicsSet.size === 0) {
      return profileScopedPosts;
    }

    return profileScopedPosts.filter((post) => {
      const topicKey = getTopicKey(post);
      return !topicKey || !dislikedTopicsSet.has(topicKey);
    });
  }, [dislikedTopicsSet, profileScopedPosts]);
  const { filteredPosts: postsAfterReadFilter, hiddenReadEnabled } = useFilteredFeedPosts(postsAfterDislikedFilter);
  const posts = useMemo(() => {
    if (likedTopicsSet.size === 0 && topicAffinityCounts.size === 0) {
      return postsAfterReadFilter;
    }

    const manualPreferredPosts: Post[] = [];
    const autoReadPreferredPosts: Post[] = [];
    const regularPosts: Post[] = [];

    for (const post of postsAfterReadFilter) {
      const topicKey = getTopicKey(post);
      if (topicKey && likedTopicsSet.has(topicKey)) {
        manualPreferredPosts.push(post);
      } else if (topicKey && (topicAffinityCounts.get(topicKey) ?? 0) >= autoReadBoostThreshold) {
        autoReadPreferredPosts.push(post);
      } else {
        regularPosts.push(post);
      }
    }

    return [...manualPreferredPosts, ...autoReadPreferredPosts, ...regularPosts];
  }, [likedTopicsSet, postsAfterReadFilter, topicAffinityCounts]);
  const { filteredPosts: searchedPosts, hasQuery } = usePostSearch(posts, searchQuery);
  const postIds = useMemo(() => searchedPosts.map((post) => post.id), [searchedPosts]);
  const { summariesById, toggle, isPending } = useReactions(postIds);
  const isProfileSectionsEmpty = Boolean(user?.id && preferredTopicIds !== null && preferredTopicIds.length === 0);
  const isPreferenceFilteredEmpty = profileScopedPosts.length > 0 && postsAfterDislikedFilter.length === 0;
  const isReadHiddenEmpty = hiddenReadEnabled && postsAfterDislikedFilter.length > 0 && postsAfterReadFilter.length === 0;
  const isSearchEmpty = hasQuery && posts.length > 0 && searchedPosts.length === 0;

  const recommendationReasons = useMemo(() => {
    const reasons = new Map<string, string>();

    for (const post of profileScopedPosts) {
      const topicKey = getTopicKey(post);

      if (!topicKey) {
        reasons.set(post.id, 'Подобрано для вашей ленты');
        continue;
      }

      if (likedTopicsSet.has(topicKey)) {
        reasons.set(post.id, 'Вы выбрали: больше таких тем');
        continue;
      }

      const affinityCount = topicAffinityCounts.get(topicKey) ?? 0;
      if (affinityCount >= autoReadBoostThreshold) {
        reasons.set(post.id, 'Вы часто читаете материалы по этой теме');
        continue;
      }

      if (affinityCount > 0) {
        reasons.set(post.id, 'Похоже на темы, которые вы уже читали');
        continue;
      }

      reasons.set(post.id, 'Подобрано для вашей ленты');
    }

    return reasons;
  }, [likedTopicsSet, profileScopedPosts, topicAffinityCounts]);

  return (
    <FlatPage className="safe-pb py-6 sm:py-8">
      <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="space-y-6">
        <FlatSection className="pt-0 sm:pt-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Для тебя</p>
                <h1 className="mt-1 text-3xl font-extrabold leading-tight sm:text-4xl">Умная лента</h1>
              </div>
            </div>
            <div className="relative shrink-0">
              <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-full border border-border/70 text-sm" onClick={() => setIsInfoOpen((value) => !value)}>
                <span aria-hidden="true">🛈</span>
                <span className="sr-only">Как работает подборка</span>
              </Button>
              {isInfoOpen ? (
                <div className="absolute right-0 top-11 z-20 w-64 rounded-xl border border-border/70 bg-background/95 p-3 text-xs leading-5 text-muted-foreground shadow-xl">
                  Подборка настраивается в Профиле через кнопку «Разделы».
                </div>
              ) : null}
            </div>
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">Материалы подбираются по разделам из профиля и вашей активности.</p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => navigate('/topic-preferences')}>
            Разделы в профиле
          </Button>
          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="h-12 rounded-[1.25rem] border-border/70 bg-background/85 pl-11 pr-24"
              placeholder="Поиск по новостям"
            />
            {searchQuery.trim() ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 h-8 -translate-y-1/2 px-2 text-xs text-muted-foreground"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setSearchQuery('');
                  searchInputRef.current?.focus({ preventScroll: true });
                }}
              >
                Очистить
              </Button>
            ) : null}
          </div>
        </FlatSection>

        {error ? <InlineError message={error} onRetry={retry} /> : null}

        {isLoading ? (
          <FeedRowsSkeleton />
        ) : isProfileSectionsEmpty ? (
          <StateCard
            title="Выберите разделы в профиле"
            description="Умная лента и digest-подборки используют разделы из Профиля."
            actionLabel="Открыть разделы"
            onAction={() => navigate('/topic-preferences')}
          />
        ) : profileScopedPosts.length === 0 ? (
          <EmptyState
            title="Пока нет рекомендаций"
            description="Выберите разделы или сохраните статьи, чтобы мы лучше настроили эту ленту под ваши интересы."
            actionLabel="Повторить"
            onReset={retry}
          />
        ) : isPreferenceFilteredEmpty ? (
          <StateCard title="Лента скрыта вашими предпочтениями" description="Измените выбор «Меньше такого», чтобы снова увидеть больше рекомендаций." />
        ) : isReadHiddenEmpty ? (
          <StateCard
            title="Вы уже прочитали всё из этой ленты"
            description="Попробуйте отключить скрытие прочитанного в профиле."
            actionLabel="Показать прочитанные"
            onAction={() => setHiddenReadEnabled(false)}
          />
        ) : isSearchEmpty ? (
          <StateCard title="Ничего не найдено" description="Попробуйте изменить запрос." />
        ) : (
          <div className="divide-y divide-border/60">
            {searchedPosts.map((post) => {
              const read = isPostRead(post.id);
              const topicKey = getTopicKey(post);
              const topicPreference = topicKey ? getTopicPreference(topicKey) : null;

              return (
                <div key={post.id} className={`relative transition-opacity ${read ? 'opacity-70 hover:opacity-90' : ''}`}>
                  {read ? (
                    <span className="pointer-events-none absolute right-2 top-2 z-10 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                      Прочитано
                    </span>
                  ) : null}
                  <FeedRow
                    post={post}
                    onOpen={(openedPost) => navigate(`/post/${openedPost.id}`)}
                    reactionSummary={summariesById.get(post.id)}
                    reactionsDisabled={isPending(post.id)}
                    onToggleReaction={toggle}
                    recommendationReason={recommendationReasons.get(post.id) ?? 'Подобрано для вашей ленты'}
                  />
                  {topicKey ? (
                    <div className="mt-1 flex items-center gap-2 pl-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={`h-7 rounded-full px-2 text-xs ${topicPreference === 'more' ? 'bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/20' : 'text-muted-foreground hover:bg-secondary/40'}`}
                        onClick={() => {
                          if (topicPreference === 'more') {
                            clearTopicPreference(topicKey);
                            return;
                          }

                          likeTopic(topicKey);
                        }}
                      >
                        <ThumbsUp className="h-3.5 w-3.5" />
                        Больше такого
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={`h-7 rounded-full px-2 text-xs ${topicPreference === 'less' ? 'bg-amber-500/15 text-amber-200 hover:bg-amber-500/20' : 'text-muted-foreground hover:bg-secondary/40'}`}
                        onClick={() => {
                          if (topicPreference === 'less') {
                            clearTopicPreference(topicKey);
                            return;
                          }

                          dislikeTopic(topicKey);
                        }}
                      >
                        <ThumbsDown className="h-3.5 w-3.5" />
                        Меньше такого
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </motion.section>
    </FlatPage>
  );
}
