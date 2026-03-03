import { motion } from 'framer-motion';
import { Shuffle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { AppLayoutContext } from '@/App';
import { Container } from '@/components/layout/container';
import { AppLink } from '@/components/ui/app-link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StateCard } from '@/components/ui/state-card';
import { EmptyState } from '@/features/posts/components/empty-state';
import { FeedSkeleton } from '@/features/posts/components/feed-skeleton';
import { getVisiblePosts } from '@/features/topics/model';
import { useReadingPreferences } from '@/providers/preferences-provider';

export function RandomPage() {
  const [currentPostId, setCurrentPostId] = useState<string | null>(null);
  const { isLoading, posts, postsError, retryPosts } = useOutletContext<AppLayoutContext>();
  const { resetTopicFilters, topicFilters } = useReadingPreferences();
  const visiblePosts = useMemo(() => getVisiblePosts(posts, topicFilters), [posts, topicFilters]);
  const hasBackendPosts = posts.length > 0;
  const isFiltersOnlyEmpty = hasBackendPosts && visiblePosts.length === 0;
  const currentPost = useMemo(() => visiblePosts.find((post) => post.id === currentPostId) ?? visiblePosts[0] ?? null, [currentPostId, visiblePosts]);

  useEffect(() => {
    if (visiblePosts.length === 0) {
      setCurrentPostId(null);
      return;
    }

    if (currentPostId && visiblePosts.some((post) => post.id === currentPostId)) {
      return;
    }

    const nextIndex = Math.floor(Math.random() * visiblePosts.length);
    setCurrentPostId(visiblePosts[nextIndex].id);
  }, [currentPostId, visiblePosts]);

  const pickNextPost = () => {
    if (visiblePosts.length <= 1) {
      return;
    }

    let nextPostId = currentPostId;

    while (nextPostId === currentPostId) {
      const nextIndex = Math.floor(Math.random() * visiblePosts.length);
      nextPostId = visiblePosts[nextIndex].id;
    }

    setCurrentPostId(nextPostId);
  };

  if (isLoading && posts.length === 0) {
    return (
      <Container className="safe-pb py-10">
        <FeedSkeleton />
      </Container>
    );
  }

  if (postsError && posts.length === 0) {
    return (
      <Container className="safe-pb py-10">
        <StateCard title="Не удалось загрузить материалы" description={postsError} actionLabel="Повторить" onAction={retryPosts} />
      </Container>
    );
  }

  if (posts.length === 0) {
    return (
      <Container className="safe-pb py-10">
        <EmptyState title="Пока нет материалов" description="Когда в ленте появятся публикации, здесь можно будет быстро открыть случайную." onReset={retryPosts} actionLabel="Обновить" />
      </Container>
    );
  }

  if (isFiltersOnlyEmpty) {
    return (
      <Container className="safe-pb py-10">
        <EmptyState
          title="По выбранным темам материалов нет"
          description="Все темы отключены или текущий набор публикаций не подходит под фильтр. Сбросьте фильтры и попробуйте снова."
          onReset={resetTopicFilters}
        />
      </Container>
    );
  }

  return (
    <Container className="safe-pb py-6 sm:py-8">
      <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="mx-auto max-w-4xl space-y-5">
        <div className="rounded-[2rem] border border-border/70 bg-card/85 p-5 shadow-[0_28px_80px_-42px_rgba(15,23,42,0.48)] sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Случайная</p>
          <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">Откройте что-нибудь неожиданное</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
            Экран берёт уже загруженные материалы, учитывает текущие фильтры тем и предлагает случайную публикацию без отдельной навигации.
          </p>
        </div>

        {currentPost ? (
          <Card className="overflow-hidden border-border/70 bg-card/85 shadow-[0_28px_70px_-40px_rgba(15,23,42,0.45)]">
            {currentPost.cover_url ? <img src={currentPost.cover_url} alt="" className="aspect-[16/7] w-full object-cover" loading="lazy" /> : null}
            <CardContent className="space-y-5 p-6 sm:p-8">
              <div className="space-y-3">
                <span className="inline-flex rounded-full bg-secondary px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                  {currentPost.topic?.name ?? 'Новости'}
                </span>
                <h2 className="font-['Source_Serif_4'] text-3xl font-bold leading-tight text-balance sm:text-4xl">{currentPost.title}</h2>
                <p className="text-sm leading-7 text-muted-foreground sm:text-base">{currentPost.excerpt}</p>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span>{new Date(currentPost.created_at).toLocaleDateString('ru-RU', { dateStyle: 'medium' })}</span>
                <span>{visiblePosts.length} доступно по текущим фильтрам</span>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <AppLink to={`/post/${currentPost.id}`}>Открыть материал</AppLink>
                </Button>
                <Button type="button" variant="outline" onClick={pickNextPost} disabled={visiblePosts.length <= 1}>
                  <Shuffle className="h-4 w-4" />
                  Другой материал
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </motion.section>
    </Container>
  );
}
