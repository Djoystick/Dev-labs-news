import { motion } from 'framer-motion';
import { RefreshCw, Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import type { AppLayoutContext } from '@/App';
import { FlatPage, FlatSection } from '@/components/layout/flat';
import { Button } from '@/components/ui/button';
import { StateCard } from '@/components/ui/state-card';
import { EmptyState } from '@/features/posts/components/empty-state';
import { FeedRow } from '@/features/posts/components/FeedRow';
import { useFilteredFeedPosts } from '@/features/reading/reading-progress';
import { useReactions } from '@/features/reactions/use-reactions';
import { useRecommendedPosts } from '@/features/recommendations/hooks';
import type { Post, Topic } from '@/types/db';

const defaultLimit = 20;

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

export function ForYouPage() {
  const navigate = useNavigate();
  const { topics } = useOutletContext<AppLayoutContext>();
  const { data, error, isLoading, retry } = useRecommendedPosts(defaultLimit);
  const recommendedPosts = useMemo(() => attachTopics(data, topics), [data, topics]);
  const { filteredPosts: posts, hiddenReadEnabled } = useFilteredFeedPosts(recommendedPosts);
  const postIds = useMemo(() => posts.map((post) => post.id), [posts]);
  const { summariesById, toggle, isPending } = useReactions(postIds);
  const isReadHiddenEmpty = hiddenReadEnabled && recommendedPosts.length > 0 && posts.length === 0;

  return (
    <FlatPage className="safe-pb py-6 sm:py-8">
      <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="space-y-6">
        <FlatSection className="pt-0 sm:pt-0">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Для тебя</p>
              <h1 className="mt-1 text-3xl font-extrabold sm:text-4xl">Рекомендации для вас</h1>
            </div>
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">Лента показывает материалы по выбранным разделам и скрывает статьи, которые вы уже сохранили.</p>
        </FlatSection>

        {error ? <InlineError message={error} onRetry={retry} /> : null}

        {isLoading ? (
          <FeedRowsSkeleton />
        ) : recommendedPosts.length === 0 ? (
          <EmptyState
            title="Пока нет рекомендаций"
            description="Выберите разделы или сохраните статьи, чтобы мы лучше настроили эту ленту под ваши интересы."
            actionLabel="Повторить"
            onReset={retry}
          />
        ) : isReadHiddenEmpty ? (
          <StateCard title="Вы уже прочитали всё из этой ленты" description="Попробуйте отключить скрытие прочитанного в профиле." />
        ) : (
          <div className="divide-y divide-border/60">
            {posts.map((post) => (
              <FeedRow
                key={post.id}
                post={post}
                onOpen={(openedPost) => navigate(`/post/${openedPost.id}`)}
                reactionSummary={summariesById.get(post.id)}
                reactionsDisabled={isPending(post.id)}
                onToggleReaction={toggle}
              />
            ))}
          </div>
        )}
      </motion.section>
    </FlatPage>
  );
}
