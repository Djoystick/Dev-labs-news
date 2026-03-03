import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { AppLayoutContext } from '@/App';
import { Container } from '@/components/layout/container';
import { StateCard } from '@/components/ui/state-card';
import { EmptyState } from '@/features/posts/components/empty-state';
import { FeedSkeleton } from '@/features/posts/components/feed-skeleton';
import { PostCard } from '@/features/posts/components/post-card';
import { getVisiblePosts } from '@/features/topics/model';
import { cn } from '@/lib/utils';
import { useReadingPreferences } from '@/providers/preferences-provider';
import type { Post } from '@/types/db';

type DigestsTab = 'top' | 'recent';

const digestLimit = 20;
const popularityMetricKeys = ['views', 'score', 'popularity', 'rank', 'read_count'] as const;
const editorialFlagKeys = ['is_editorial', 'editorial', 'is_featured', 'featured', 'is_pinned', 'pinned'] as const;

function getTimestamp(value: string) {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getNumericPopularityMetric(post: Post) {
  const candidate = post as Post & Partial<Record<(typeof popularityMetricKeys)[number], unknown>>;

  for (const key of popularityMetricKeys) {
    const value = candidate[key];

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function hasEditorialPriority(post: Post) {
  const candidate = post as Post & Partial<Record<(typeof editorialFlagKeys)[number], unknown>>;

  return editorialFlagKeys.some((key) => candidate[key] === true);
}

function getTopScore(post: Post) {
  const popularityMetric = getNumericPopularityMetric(post);

  if (popularityMetric !== null) {
    return popularityMetric;
  }

  // Fallback heuristic: prefer fresher posts, then slightly boost richer presentation/content.
  return getTimestamp(post.created_at) + post.content.length * 0.1 + (post.cover_url ? 10_000 : 0);
}

export function DigestsPage() {
  const [activeTab, setActiveTab] = useState<DigestsTab>('top');
  const { isLoading, posts, postsError, retryPosts } = useOutletContext<AppLayoutContext>();
  const { resetTopicFilters, topicFilters } = useReadingPreferences();

  const visiblePosts = useMemo(() => getVisiblePosts(posts, topicFilters), [posts, topicFilters]);
  const topPosts = useMemo(
    () =>
      [...visiblePosts]
        .sort((left, right) => {
          const scoreDiff = getTopScore(right) - getTopScore(left);

          if (scoreDiff !== 0) {
            return scoreDiff;
          }

          return getTimestamp(right.created_at) - getTimestamp(left.created_at);
        })
        .slice(0, digestLimit),
    [visiblePosts],
  );
  const recentPosts = useMemo(
    () =>
      [...visiblePosts]
        .sort((left, right) => {
          const editorialDiff = Number(hasEditorialPriority(right)) - Number(hasEditorialPriority(left));

          if (editorialDiff !== 0) {
            return editorialDiff;
          }

          return getTimestamp(right.created_at) - getTimestamp(left.created_at);
        })
        .slice(0, digestLimit),
    [visiblePosts],
  );
  const activePosts = activeTab === 'top' ? topPosts : recentPosts;
  const hasBackendPosts = posts.length > 0;
  const isFiltersOnlyEmpty = hasBackendPosts && visiblePosts.length === 0;

  return (
    <Container className="safe-pb py-6 sm:py-8">
      <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="mb-6 sm:mb-8">
        <div className="rounded-[2rem] border border-border/70 bg-card/80 p-5 shadow-[0_28px_80px_-42px_rgba(15,23,42,0.48)] backdrop-blur sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Сводки</p>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-3">
              <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">Сводки</h1>
              <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                Подборки строятся только из уже загруженных материалов и автоматически учитывают выбранные темы.
              </p>
            </div>
            <span className="rounded-full border border-border bg-background/75 px-4 py-2 text-sm font-semibold text-muted-foreground">
              {visiblePosts.length} из {posts.length} материалов
            </span>
          </div>

          <div className="mt-6 flex rounded-[1.5rem] border border-border/70 bg-background/70 p-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('top')}
              className={cn(
                'min-h-11 flex-1 rounded-[1.1rem] px-4 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background',
                activeTab === 'top' ? 'bg-secondary/80 text-foreground' : 'text-muted-foreground hover:bg-secondary/50',
              )}
              aria-pressed={activeTab === 'top'}
            >
              <span className="block text-base font-extrabold">Top</span>
              <span
                className={cn('mt-1 block h-0.5 w-14 rounded-full transition-colors duration-200', activeTab === 'top' ? 'bg-primary' : 'bg-transparent')}
                aria-hidden={activeTab !== 'top'}
              />
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('recent')}
              className={cn(
                'min-h-11 flex-1 rounded-[1.1rem] px-4 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background',
                activeTab === 'recent' ? 'bg-secondary/80 text-foreground' : 'text-muted-foreground hover:bg-secondary/50',
              )}
              aria-pressed={activeTab === 'recent'}
            >
              <span className="block text-base font-extrabold">Recent</span>
              <span
                className={cn('mt-1 block h-0.5 w-14 rounded-full transition-colors duration-200', activeTab === 'recent' ? 'bg-primary' : 'bg-transparent')}
                aria-hidden={activeTab !== 'recent'}
              />
            </button>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            {activeTab === 'top'
              ? 'Самое читаемое: популярность из доступных полей, а при их отсутствии аккуратная эвристика по свежести и наполненности.'
              : 'Рекомендации: сначала отмеченные редакцией материалы, затем самые новые публикации.'}
          </p>
        </div>
      </motion.section>

      {isLoading && posts.length === 0 ? (
        <FeedSkeleton />
      ) : postsError && posts.length === 0 ? (
        <StateCard title="Не удалось загрузить материалы" description={postsError} actionLabel="Повторить" onAction={retryPosts} />
      ) : posts.length === 0 ? (
        <EmptyState title="Пока нет материалов" description="Как только материалы появятся, здесь сформируются свежие сводки." onReset={retryPosts} actionLabel="Обновить" />
      ) : isFiltersOnlyEmpty ? (
        <EmptyState
          title="По выбранным темам материалов нет"
          description="Сбросьте фильтры тем, чтобы снова увидеть подборки."
          onReset={resetTopicFilters}
          actionLabel="Сбросить"
        />
      ) : (
        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.3 }}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-2xl font-extrabold">{activeTab === 'top' ? 'Самое читаемое' : 'Рекомендации'}</h2>
            <span className="text-sm text-muted-foreground">{activePosts.length} карточек</span>
          </div>
          <div className="grid gap-5">
            {activePosts.map((post, index) => (
              <PostCard key={`${activeTab}-${post.id}`} post={post} index={index} />
            ))}
          </div>
        </motion.section>
      )}
    </Container>
  );
}
