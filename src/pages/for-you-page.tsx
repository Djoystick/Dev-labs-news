import { motion } from 'framer-motion';
import { RefreshCw, Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { AppLayoutContext } from '@/App';
import { Container } from '@/components/layout/container';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/features/posts/components/empty-state';
import { FeedSkeleton } from '@/features/posts/components/feed-skeleton';
import { PostCard } from '@/features/posts/components/post-card';
import { useRecommendedPosts } from '@/features/recommendations/hooks';
import type { Post, Topic } from '@/types/db';

const defaultLimit = 20;

function InlineError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-[1.75rem] border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive shadow-[0_20px_48px_-36px_rgba(239,68,68,0.55)]">
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
  const { topics } = useOutletContext<AppLayoutContext>();
  const { data, error, isLoading, retry } = useRecommendedPosts(defaultLimit);
  const posts = useMemo(() => attachTopics(data, topics), [data, topics]);

  return (
    <Container className="safe-pb py-6 sm:py-8">
      <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="space-y-6">
        <div className="rounded-[2rem] border border-border/70 bg-card/80 p-5 shadow-[0_28px_80px_-42px_rgba(15,23,42,0.48)] backdrop-blur sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/14 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Для тебя</p>
              <h1 className="mt-1 text-3xl font-extrabold sm:text-4xl">Рекомендованные материалы по вашим интересам</h1>
            </div>
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
            Эта лента в первую очередь показывает материалы по выбранным вами темам и убирает статьи, которые вы уже сохранили.
          </p>
        </div>

        {error ? <InlineError message={error} onRetry={retry} /> : null}

        {isLoading ? (
          <FeedSkeleton />
        ) : posts.length === 0 ? (
          <EmptyState
            title="Пока нет рекомендаций"
            description="Выберите темы или сохраните статьи, чтобы мы лучше настроили эту ленту под ваши интересы."
            actionLabel="Повторить"
            onReset={retry}
          />
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {posts.map((post, index) => (
              <PostCard key={post.id} post={post} index={index} />
            ))}
          </div>
        )}
      </motion.section>
    </Container>
  );
}
