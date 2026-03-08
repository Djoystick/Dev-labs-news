import { AnimatePresence, motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { useMemo, useRef } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import type { AppLayoutContext } from '@/App';
import { FlatPage } from '@/components/layout/flat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StateCard } from '@/components/ui/state-card';
import { EmptyState } from '@/features/posts/components/empty-state';
import { FeedRow } from '@/features/posts/components/FeedRow';
import { isPostRead, useFilteredFeedPosts, useReadingProgress } from '@/features/reading/reading-progress';
import { feedSearchStorageKey, usePersistentSearchQuery, usePostSearch } from '@/features/search/post-search';
import { useReactions } from '@/features/reactions/use-reactions';
import { getVisiblePosts } from '@/features/topics/model';
import { markFeedReturnIntent, saveFeedState } from '@/lib/feed-state';
import { getPostPath } from '@/lib/post-links';
import { useReadingPreferences } from '@/providers/preferences-provider';

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

export function FeedPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    hasMore,
    isLoading,
    isLoadingMore,
    isRefreshing,
    loadMore,
    posts,
    postsError,
    retryPosts,
    selectedTopic,
  } = useOutletContext<AppLayoutContext>();
  const { topicFilters } = useReadingPreferences();
  const { setHiddenReadEnabled } = useReadingProgress();
  const [searchQuery, setSearchQuery] = usePersistentSearchQuery(feedSearchStorageKey);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const topicFilteredPosts = useMemo(() => getVisiblePosts(posts, topicFilters), [posts, topicFilters]);
  const { filteredPosts, hiddenReadEnabled } = useFilteredFeedPosts(topicFilteredPosts);
  const { debouncedQuery, filteredPosts: searchedPosts, hasQuery } = usePostSearch(filteredPosts, searchQuery);
  const filteredPostIds = useMemo(() => searchedPosts.map((post) => post.id), [searchedPosts]);
  const { summariesById, toggle, isPending } = useReactions(filteredPostIds);
  const hasBackendPosts = posts.length > 0;
  const isFiltersOnlyEmpty = hasBackendPosts && topicFilteredPosts.length === 0;
  const isReadHiddenEmpty = hasBackendPosts && topicFilteredPosts.length > 0 && filteredPosts.length === 0 && hiddenReadEnabled;
  const isSearchEmpty = hasQuery && filteredPosts.length > 0 && searchedPosts.length === 0;

  const handleOpenPost = (postId: string) => {
    saveFeedState({
      scrollY: window.scrollY,
      search: window.location.search,
    });
    markFeedReturnIntent();
    void navigate(getPostPath(postId), {
      state: {
        from: `${location.pathname}${location.search}`,
      },
    });
  };

  return (
    <FlatPage className="safe-pb py-4 sm:py-6">
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="mb-5 space-y-4 border-b border-border/60 pb-4">
        <div>
          <h1 className="text-3xl font-extrabold sm:text-4xl">{'Лента'}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {selectedTopic.name} {'•'} {searchedPosts.length} {'из'} {filteredPosts.length}
          </p>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            id="feed-search"
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
      </motion.section>

      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <FeedRowsSkeleton />
          </motion.div>
        ) : postsError && posts.length === 0 ? (
          <motion.div key="error" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }}>
            <StateCard title="Не удалось загрузить материалы" description={postsError} actionLabel="Повторить" onAction={retryPosts} />
          </motion.div>
        ) : posts.length === 0 ? (
          <motion.div key="empty" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }}>
            <EmptyState onReset={retryPosts} actionLabel="Повторить" description="Материалы пока не найдены. Попробуйте обновить ленту." title="Лента пока пуста" />
          </motion.div>
        ) : isFiltersOnlyEmpty ? (
          <motion.div key="filtered-empty" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }}>
            <EmptyState
              onReset={retryPosts}
              actionLabel="Обновить"
              description="По выбранным разделам материалов нет. Измените фильтры разделов через верхнюю панель."
              title="Ничего не найдено"
            />
          </motion.div>
        ) : isReadHiddenEmpty ? (
          <motion.div key="read-hidden-empty" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }}>
            <StateCard
              title="Вы уже прочитали всё из этой ленты"
              description="Попробуйте отключить скрытие прочитанного в профиле."
              actionLabel="Показать прочитанные"
              onAction={() => setHiddenReadEnabled(false)}
            />
          </motion.div>
        ) : isSearchEmpty ? (
          <motion.div key="search-empty" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }}>
            <StateCard title="Ничего не найдено" description="Попробуйте изменить запрос." />
          </motion.div>
        ) : (
          <motion.div key="feed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {isRefreshing ? <FeedRowsSkeleton /> : null}
            <div className="divide-y divide-border/60">
              {searchedPosts.map((post) => {
                const read = isPostRead(post.id);

                return (
                  <div key={post.id} className={`relative transition-opacity ${read ? 'opacity-70 hover:opacity-90' : ''}`}>
                    {read ? (
                      <span className="pointer-events-none absolute right-2 top-2 z-10 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                        Прочитано
                      </span>
                    ) : null}
                    <FeedRow
                      post={post}
                      onOpen={(openedPost) => handleOpenPost(openedPost.id)}
                      reactionSummary={summariesById.get(post.id)}
                      reactionsDisabled={isPending(post.id)}
                      onToggleReaction={toggle}
                    />
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex flex-col items-center gap-3">
              {isLoadingMore ? (
                <div className="w-full">
                  <FeedRowsSkeleton />
                </div>
              ) : postsError ? (
                <StateCard title="Не удалось загрузить материалы" description={postsError} actionLabel="Повторить" onAction={retryPosts} />
              ) : hasMore ? (
                <Button variant="outline" onClick={loadMore}>
                  {'Показать ещё'}
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">{debouncedQuery ? 'Все найденные материалы уже показаны.' : 'Это конец текущей подборки.'}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </FlatPage>
  );
}
