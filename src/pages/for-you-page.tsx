import { motion } from 'framer-motion';
import { RefreshCw, Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import type { AppLayoutContext } from '@/App';
import { Container } from '@/components/layout/container';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/features/posts/components/empty-state';
import { FeedRow } from '@/features/posts/components/FeedRow';
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
    <div>
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
          <div className="mt-4 h-px bg-border/60" />
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
  const posts = useMemo(() => attachTopics(data, topics), [data, topics]);
  const postIds = useMemo(() => posts.map((post) => post.id), [posts]);
  const { summariesById, toggle, isPending } = useReactions(postIds);

  return (
    <Container className="safe-pb py-6 sm:py-8">
      <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="space-y-6">
        <div className="border-b border-border/60 pb-5 sm:pb-6">
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
          <FeedRowsSkeleton />
        ) : posts.length === 0 ? (
          <EmptyState
            title="Пока нет рекомендаций"
            description="Выберите темы или сохраните статьи, чтобы мы лучше настроили эту ленту под ваши интересы."
            actionLabel="Повторить"
            onReset={retry}
          />
        ) : (
          <div>
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
    </Container>
  );
}
