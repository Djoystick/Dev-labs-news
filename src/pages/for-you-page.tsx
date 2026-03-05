import { motion } from 'framer-motion';
import { RefreshCw, Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import type { AppLayoutContext } from '@/App';
import { FlatPage, FlatSection } from '@/components/layout/flat';
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
          {'\u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C'}
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
  const posts = useMemo(() => attachTopics(data, topics), [data, topics]);
  const postIds = useMemo(() => posts.map((post) => post.id), [posts]);
  const { summariesById, toggle, isPending } = useReactions(postIds);

  return (
    <FlatPage className="safe-pb py-6 sm:py-8">
      <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="space-y-6">
        <FlatSection className="pt-0 sm:pt-0">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">{'\u0414\u043B\u044F \u0442\u0435\u0431\u044F'}</p>
              <h1 className="mt-1 text-3xl font-extrabold sm:text-4xl">Recommended posts for your interests</h1>
            </div>
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
            {'\u042D\u0442\u0430 \u043B\u0435\u043D\u0442\u0430 \u0432 \u043F\u0435\u0440\u0432\u0443\u044E \u043E\u0447\u0435\u0440\u0435\u0434\u044C \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442 \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u044B \u043F\u043E \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u043C \u0432\u0430\u043C\u0438 \u0442\u0435\u043C\u0430\u043C \u0438 \u0443\u0431\u0438\u0440\u0430\u0435\u0442 \u0441\u0442\u0430\u0442\u044C\u0438, \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u0432\u044B \u0443\u0436\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u043B\u0438.'}
          </p>
        </FlatSection>

        {error ? <InlineError message={error} onRetry={retry} /> : null}

        {isLoading ? (
          <FeedRowsSkeleton />
        ) : posts.length === 0 ? (
          <EmptyState
            title="\u041F\u043E\u043A\u0430 \u043D\u0435\u0442 \u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0430\u0446\u0438\u0439"
            description="\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0442\u0435\u043C\u044B \u0438\u043B\u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0441\u0442\u0430\u0442\u044C\u0438, \u0447\u0442\u043E\u0431\u044B \u043C\u044B \u043B\u0443\u0447\u0448\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0438\u043B\u0438 \u044D\u0442\u0443 \u043B\u0435\u043D\u0442\u0443 \u043F\u043E\u0434 \u0432\u0430\u0448\u0438 \u0438\u043D\u0442\u0435\u0440\u0435\u0441\u044B."
            actionLabel="\u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C"
            onReset={retry}
          />
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
