import { AnimatePresence, motion } from 'framer-motion';
import { Link, useOutletContext } from 'react-router-dom';
import type { AppLayoutContext } from '@/App';
import { Container } from '@/components/layout/container';
import { Button } from '@/components/ui/button';
import { StateCard } from '@/components/ui/state-card';
import { EmptyState } from '@/features/posts/components/empty-state';
import { FeedSkeleton } from '@/features/posts/components/feed-skeleton';
import { PostCard } from '@/features/posts/components/post-card';

export function FeedPage() {
  const { hasMore, isLoading, isLoadingMore, loadMore, posts, postsError, query, resultsCount, retryPosts, selectedTopic, setActiveTopic, setQuery } =
    useOutletContext<AppLayoutContext>();
  const featuredPost = posts[0];
  const remainingPosts = posts.slice(1);

  return (
    <Container className="safe-pb py-8">
      <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="mb-8">
        <div className="grid gap-4 rounded-[2rem] border border-border/70 bg-card/75 p-6 shadow-[0_32px_80px_-40px_rgba(8,145,209,0.55)] backdrop-blur md:grid-cols-[1.35fr_0.85fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">UI Layout</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-extrabold leading-tight text-balance sm:text-4xl">
              A calmer, sharper reading surface for technical news inside Telegram and the browser.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              Search by title, pivot by topic from the drawer, and scan a feed tuned for dense editorial content instead of dashboard chrome.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm">
              <span className="rounded-full border border-border bg-background/70 px-4 py-2 font-semibold">{selectedTopic.name}</span>
              <span className="rounded-full border border-border bg-background/70 px-4 py-2 text-muted-foreground">{resultsCount} matching posts</span>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
            <div className="rounded-[1.5rem] bg-secondary/70 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Search-first</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">The header now owns the main discovery path: search, topic context, and theme switching.</p>
            </div>
            <div className="rounded-[1.5rem] bg-secondary/70 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Seeded data</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">Supabase is now the source of truth for topics and posts. Search stays client-side over the loaded feed for this MVP.</p>
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
            <StateCard title="Feed unavailable" description={postsError} onAction={retryPosts} />
          </motion.div>
        ) : posts.length === 0 ? (
          <motion.div key="empty" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }}>
            <EmptyState
              onReset={() => {
                setQuery('');
                setActiveTopic('all');
              }}
            />
          </motion.div>
        ) : (
          <motion.div key="feed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
            {featuredPost ? (
              <motion.article
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="overflow-hidden rounded-[2rem] border border-border/70 bg-card/85 shadow-[0_32px_90px_-46px_rgba(15,23,42,0.55)]"
              >
                <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
                  {featuredPost.cover_url ? <img src={featuredPost.cover_url} alt="" className="h-full min-h-[280px] w-full object-cover" /> : null}
                  <div className="flex flex-col justify-between p-6 sm:p-8">
                    <div>
                      <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                        Featured in {featuredPost.topic?.name ?? 'General'}
                      </span>
                      <h3 className="mt-5 font-['Source_Serif_4'] text-3xl font-bold leading-tight text-balance sm:text-4xl">{featuredPost.title}</h3>
                      <p className="mt-4 text-base leading-8 text-muted-foreground">{featuredPost.excerpt}</p>
                    </div>
                    <div className="mt-8 flex items-center justify-between gap-3">
                      <span className="text-sm text-muted-foreground">
                        {new Date(featuredPost.created_at).toLocaleDateString('en-US', { dateStyle: 'medium' })}
                      </span>
                      <Button asChild>
                        <Link to={`/post/${featuredPost.id}`}>Open story</Link>
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
                <StateCard title="More posts could not be loaded" description={postsError} onAction={retryPosts} />
              ) : hasMore ? (
                <Button variant="outline" onClick={loadMore}>
                  Load more articles
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {query ? 'All matching results are visible.' : 'You have reached the end of the loaded feed.'}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Container>
  );
}
