import { AnimatePresence, motion } from 'framer-motion';
import { FilePenLine, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useNavigate, useOutletContext } from 'react-router-dom';
import type { AppLayoutContext } from '@/App';
import { FlatPage, FlatSection } from '@/components/layout/flat';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { StateCard } from '@/components/ui/state-card';
import { EmptyState } from '@/features/posts/components/empty-state';
import { FeedRow } from '@/features/posts/components/FeedRow';
import { markPostRead } from '@/features/posts/mark-post-read';
import { isPostRead, useFilteredFeedPosts, useReadingProgress } from '@/features/reading/reading-progress';
import { usePostSearch } from '@/features/search/post-search';
import { PostReactions } from '@/features/reactions/components/PostReactions';
import { useReactions } from '@/features/reactions/use-reactions';
import { getVisiblePosts } from '@/features/topics/model';
import { useAuth } from '@/providers/auth-provider';
import { useReadingPreferences } from '@/providers/preferences-provider';
import type { Post } from '@/types/db';

function getReadingTime(content: string) {
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(wordCount / 200));
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

export function FeedPage() {
  const navigate = useNavigate();
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
  const { profile, user } = useAuth();
  const { topicFilters } = useReadingPreferences();
  const { setHiddenReadEnabled } = useReadingProgress();
  const [openPost, setOpenPost] = useState<Post | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const topicFilteredPosts = useMemo(() => getVisiblePosts(posts, topicFilters), [posts, topicFilters]);
  const { filteredPosts, hiddenReadEnabled } = useFilteredFeedPosts(topicFilteredPosts);
  const { debouncedQuery, filteredPosts: searchedPosts, hasQuery } = usePostSearch(filteredPosts, searchQuery);
  const filteredPostIds = useMemo(() => searchedPosts.map((post) => post.id), [searchedPosts]);
  const { summariesById, toggle, isPending } = useReactions(filteredPostIds);
  const hasBackendPosts = posts.length > 0;
  const isFiltersOnlyEmpty = hasBackendPosts && topicFilteredPosts.length === 0;
  const isReadHiddenEmpty = hasBackendPosts && topicFilteredPosts.length > 0 && filteredPosts.length === 0 && hiddenReadEnabled;
  const isSearchEmpty = hasQuery && filteredPosts.length > 0 && searchedPosts.length === 0;
  const canEditOpenPost =
    profile?.role === 'admin' || (profile?.role === 'editor' && Boolean(user?.id) && openPost?.author_id === user?.id);

  useEffect(() => {
    if (!openPost?.id) {
      return;
    }

    void markPostRead(openPost.id, {
      path: `/post/${openPost.id}`,
      topicKey: openPost.topic?.id ?? openPost.topic_id ?? null,
      title: openPost.title,
      updatedAt: new Date().toISOString(),
    });
  }, [openPost]);

  return (
    <>
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
              id="feed-search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="h-12 rounded-[1.25rem] border-border/70 bg-background/85 pl-11 pr-24"
              placeholder="Поиск по новостям"
            />
            {searchQuery.trim() ? (
              <Button type="button" variant="ghost" size="sm" className="absolute right-2 top-1/2 h-8 -translate-y-1/2 px-2 text-xs text-muted-foreground" onClick={() => setSearchQuery('')}>
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
                        onOpen={setOpenPost}
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

      <Dialog open={openPost !== null} onOpenChange={(open) => !open && setOpenPost(null)}>
        <DialogContent className="inset-x-0 bottom-0 top-auto z-[100] w-full max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-b-none rounded-t-[2rem] border-x-0 border-b-0 border-t border-border/70 p-0">
          {openPost ? (
            <div className="safe-pb max-h-[85svh] overflow-y-auto px-5 pb-6 pt-5 sm:px-6">
              <FlatSection className="pt-0">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{openPost.topic?.name ?? 'Источник'}</p>
                  {canEditOpenPost ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      aria-label="Редактировать"
                      onClick={() => {
                        navigate(`/admin/edit/${openPost.id}`);
                        setOpenPost(null);
                      }}
                    >
                      <FilePenLine className="h-4 w-4" />
                      {'Редактировать'}
                    </Button>
                  ) : null}
                </div>
                <h2 className="mt-2 text-2xl font-extrabold leading-tight sm:text-3xl">{openPost.title}</h2>
                <p className="mt-2 text-xs text-muted-foreground">
                  {new Date(openPost.created_at).toLocaleDateString('ru-RU', { dateStyle: 'medium' })}
                  {openPost.content?.trim() ? ` • ${getReadingTime(openPost.content)} мин чтения` : ''}
                </p>
                <div className="mt-2">
                  <PostReactions postId={openPost.id} summary={summariesById.get(openPost.id)} disabled={isPending(openPost.id)} onToggle={toggle} />
                </div>
              </FlatSection>
              {openPost.cover_url ? (
                <FlatSection>
                  <img src={openPost.cover_url} alt="" loading="lazy" className="max-h-[220px] w-full object-cover" />
                </FlatSection>
              ) : null}
              <FlatSection className="border-b-0 pb-0">
                <div className="prose prose-slate max-w-none dark:prose-invert">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{openPost.content?.trim() || openPost.excerpt || 'Текст новости отсутствует.'}</ReactMarkdown>
                </div>
              </FlatSection>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
