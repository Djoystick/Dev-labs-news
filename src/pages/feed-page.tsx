import { AnimatePresence, motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { AppLayoutContext } from '@/App';
import { Container } from '@/components/layout/container';
import { AppLink } from '@/components/ui/app-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StateCard } from '@/components/ui/state-card';
import { EmptyState } from '@/features/posts/components/empty-state';
import { FeedSkeleton } from '@/features/posts/components/feed-skeleton';
import { PostCard } from '@/features/posts/components/post-card';
import { getVisiblePosts } from '@/features/topics/model';
import { consumeFeedReturnIntent, markFeedReturnIntent, readFeedState, saveFeedState } from '@/lib/feed-state';
import { useReadingPreferences } from '@/providers/preferences-provider';

export function FeedPage() {
  const { hasMore, isLoading, isLoadingMore, isRefreshing, loadMore, posts, postsError, query, resultsCount, retryPosts, selectedTopic, setQuery } =
    useOutletContext<AppLayoutContext>();
  const { resetTopicFilters, topicFilters } = useReadingPreferences();
  const scrollTimerRef = useRef<number | null>(null);
  const filteredPosts = useMemo(() => getVisiblePosts(posts, topicFilters), [posts, topicFilters]);
  const featuredPost = filteredPosts[0];
  const remainingPosts = filteredPosts.slice(1);
  const hasBackendPosts = posts.length > 0;
  const isFiltersOnlyEmpty = hasBackendPosts && filteredPosts.length === 0;

  useEffect(() => {
    const savedState = readFeedState();

    if (!savedState || savedState.search !== window.location.search) {
      return;
    }

    const shouldRestore = consumeFeedReturnIntent();

    if (!shouldRestore) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      window.scrollTo({ top: savedState.scrollY, behavior: 'auto' });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (scrollTimerRef.current) {
        window.clearTimeout(scrollTimerRef.current);
      }

      scrollTimerRef.current = window.setTimeout(() => {
        saveFeedState({
          scrollY: window.scrollY,
          search: window.location.search,
        });
      }, 200);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);

      if (scrollTimerRef.current) {
        window.clearTimeout(scrollTimerRef.current);
      }
    };
  }, []);

  return (
    <Container className="safe-pb py-6 sm:py-8">
      <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="mb-6 sm:mb-8">
        <div className="grid gap-4 rounded-[2rem] border border-border/70 bg-card/75 p-5 shadow-[0_32px_80px_-40px_rgba(8,145,209,0.55)] backdrop-blur md:grid-cols-[1.35fr_0.85fr] sm:p-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">Dev-labs News</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-extrabold leading-tight text-balance sm:text-4xl">Главное из разработки, инфраструктуры и технологий.</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              Следите за лентой, сохраняйте полезные материалы и настраивайте отображение по интересующим темам.
            </p>
            <div className="mt-5 flex flex-wrap gap-3 text-sm">
              <span className="rounded-full border border-border bg-background/70 px-4 py-2 font-semibold">{selectedTopic.name}</span>
              <span className="rounded-full border border-border bg-background/70 px-4 py-2 text-muted-foreground">
                {filteredPosts.length} из {resultsCount} материалов
              </span>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
            <div className="rounded-[1.5rem] bg-secondary/70 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Лента</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Поиск доступен прямо на этой странице, а фильтры по темам открываются из кнопки в верхней панели.
              </p>
            </div>
            <div className="rounded-[1.5rem] bg-secondary/70 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Чтение</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Открывайте материалы, возвращайтесь к ним позже и управляйте тем, что хотите видеть в ленте.
              </p>
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.3 }} className="mb-6 sm:mb-8">
        <div className="grid gap-4 rounded-[1.75rem] border border-border/70 bg-card/80 p-4 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.45)] sm:p-5">
          <div className="grid gap-3">
            <label htmlFor="feed-search" className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">
              Search
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="feed-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-12 rounded-[1.25rem] border-border/70 bg-background/85 pl-11"
                placeholder="Найти по заголовку, анонсу или содержанию"
              />
            </div>
          </div>
        </div>
      </motion.section>

      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <FeedSkeleton />
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
              onReset={resetTopicFilters}
              description="По выбранным темам материалов нет. Сбросьте фильтр, чтобы снова показать всю ленту."
              title="Ничего не найдено"
            />
          </motion.div>
        ) : (
          <motion.div key="feed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
            {isRefreshing ? (
              <div className="rounded-[1.5rem] border border-border/70 bg-card/70 p-4">
                <FeedSkeleton />
              </div>
            ) : null}

            {featuredPost ? (
              <motion.article
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="overflow-hidden rounded-[2rem] border border-border/70 bg-card/85 shadow-[0_32px_90px_-46px_rgba(15,23,42,0.55)]"
              >
                <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
                  {featuredPost.cover_url ? <img src={featuredPost.cover_url} alt="" className="h-full min-h-[280px] w-full object-cover" loading="lazy" /> : null}
                  <div className="flex flex-col justify-between p-6 sm:p-8">
                    <div>
                      <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                        {featuredPost.topic?.name ?? 'Новости'}
                      </span>
                      <h3 className="mt-5 font-['Source_Serif_4'] text-3xl font-bold leading-tight text-balance sm:text-4xl">{featuredPost.title}</h3>
                      <p className="mt-4 text-base leading-8 text-muted-foreground">{featuredPost.excerpt}</p>
                    </div>
                    <div className="mt-8 flex items-center justify-between gap-3">
                      <span className="text-sm text-muted-foreground">{new Date(featuredPost.created_at).toLocaleDateString('ru-RU', { dateStyle: 'medium' })}</span>
                      <Button
                        asChild
                        onClick={() => {
                          saveFeedState({
                            scrollY: window.scrollY,
                            search: window.location.search,
                          });
                          markFeedReturnIntent();
                        }}
                      >
                        <AppLink to={`/post/${featuredPost.id}`}>Открыть</AppLink>
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.article>
            ) : null}

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {remainingPosts.map((post, index) => (
                <PostCard key={post.id} post={post} index={index} />
              ))}
            </div>

            <div className="flex flex-col items-center gap-3">
              {isLoadingMore ? (
                <div className="w-full">
                  <FeedSkeleton />
                </div>
              ) : postsError ? (
                <StateCard title="Не удалось загрузить материалы" description={postsError} actionLabel="Повторить" onAction={retryPosts} />
              ) : hasMore ? (
                <Button variant="outline" onClick={loadMore}>
                  Показать ещё
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">{query ? 'Все найденные материалы уже показаны.' : 'Это конец текущей подборки.'}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Container>
  );
}
