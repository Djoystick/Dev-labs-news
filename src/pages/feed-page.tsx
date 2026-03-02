import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { AppLayoutContext } from '@/App';
import { Container } from '@/components/layout/container';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/features/posts/components/empty-state';
import { PostCard } from '@/features/posts/components/post-card';
import { postSeeds } from '@/features/posts/data';
import { topicSeeds } from '@/features/topics/data';

export function FeedPage() {
  const { activeTopic, query, setActiveTopic, setQuery } = useOutletContext<AppLayoutContext>();

  const posts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return postSeeds
      .map((post) => ({
        ...post,
        topic: topicSeeds.find((topic) => topic.id === post.topic_id),
      }))
      .filter((post) => {
        const matchesTopic = activeTopic === 'all' || post.topic?.slug === activeTopic;
        const matchesQuery = normalizedQuery.length === 0 || post.title.toLowerCase().includes(normalizedQuery);

        return matchesTopic && matchesQuery;
      });
  }, [activeTopic, query]);

  return (
    <Container className="safe-pb py-8">
      <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="mb-8">
        <div className="grid gap-4 rounded-[2rem] border border-border/70 bg-card/75 p-6 shadow-[0_32px_80px_-40px_rgba(8,145,209,0.55)] backdrop-blur md:grid-cols-[1.4fr_0.8fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">MVP Scaffold</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-extrabold leading-tight sm:text-4xl">
              Clean Habr-like reading surface, ready for Supabase content and Telegram launch flow.
            </h2>
          </div>
          <div className="rounded-[1.5rem] bg-secondary/70 p-5">
            <p className="text-sm font-semibold">Stage 1 notes</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Temporary seeded posts are intentional and marked `TODO`. They exist only until Stage 3 switches the feed to Supabase queries.
            </p>
          </div>
        </div>
      </motion.section>

      {posts.length === 0 ? (
        <EmptyState
          onReset={() => {
            setQuery('');
            setActiveTopic('all');
          }}
        />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {posts.map((post, index) => (
              <PostCard key={post.id} post={post} index={index} />
            ))}
          </div>
          {posts.length >= 3 ? (
            <div className="flex justify-center">
              <Button variant="outline" disabled>
                Load more will be wired in Stage 2
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </Container>
  );
}
