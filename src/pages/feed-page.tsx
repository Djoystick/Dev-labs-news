import { AnimatePresence, motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useOutletContext } from 'react-router-dom';
import type { AppLayoutContext } from '@/App';
import { FlatPage, FlatSection } from '@/components/layout/flat';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { StateCard } from '@/components/ui/state-card';
import { EmptyState } from '@/features/posts/components/empty-state';
import { FeedRow } from '@/features/posts/components/FeedRow';
import { PostReactions } from '@/features/reactions/components/PostReactions';
import { useReactions } from '@/features/reactions/use-reactions';
import { getVisiblePosts } from '@/features/topics/model';
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
  const {
    hasMore,
    isLoading,
    isLoadingMore,
    isRefreshing,
    loadMore,
    posts,
    postsError,
    query,
    resultsCount,
    retryPosts,
    selectedTopic,
    setQuery,
  } = useOutletContext<AppLayoutContext>();
  const { topicFilters } = useReadingPreferences();
  const [openPost, setOpenPost] = useState<Post | null>(null);
  const filteredPosts = useMemo(() => getVisiblePosts(posts, topicFilters), [posts, topicFilters]);
  const filteredPostIds = useMemo(() => filteredPosts.map((post) => post.id), [filteredPosts]);
  const { summariesById, toggle, isPending } = useReactions(filteredPostIds);
  const hasBackendPosts = posts.length > 0;
  const isFiltersOnlyEmpty = hasBackendPosts && filteredPosts.length === 0;

  return (
    <>
      <FlatPage className="safe-pb py-4 sm:py-6">
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="mb-5 space-y-4 border-b border-border/60 pb-4">
          <div>
            <h1 className="text-3xl font-extrabold sm:text-4xl">{'\u041B\u0435\u043D\u0442\u0430'}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedTopic.name} {'\u2022'} {filteredPosts.length} {'\u0438\u0437'} {resultsCount}
            </p>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="feed-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-12 rounded-[1.25rem] border-border/70 bg-background/85 pl-11"
              placeholder="\u041D\u0430\u0439\u0442\u0438 \u043F\u043E \u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043A\u0443 \u0438\u043B\u0438 \u0441\u043E\u0434\u0435\u0440\u0436\u0430\u043D\u0438\u044E"
            />
          </div>
        </motion.section>

        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <FeedRowsSkeleton />
            </motion.div>
          ) : postsError && posts.length === 0 ? (
            <motion.div key="error" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }}>
              <StateCard title="\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u044B" description={postsError} actionLabel="\u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C" onAction={retryPosts} />
            </motion.div>
          ) : posts.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }}>
              <EmptyState onReset={retryPosts} actionLabel="\u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C" description="\u041C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u044B \u043F\u043E\u043A\u0430 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u044B. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u043E\u0431\u043D\u043E\u0432\u0438\u0442\u044C \u043B\u0435\u043D\u0442\u0443." title="\u041B\u0435\u043D\u0442\u0430 \u043F\u043E\u043A\u0430 \u043F\u0443\u0441\u0442\u0430" />
            </motion.div>
          ) : isFiltersOnlyEmpty ? (
            <motion.div key="filtered-empty" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }}>
              <EmptyState
                onReset={retryPosts}
                actionLabel="\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C"
                description="\u041F\u043E \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u043C \u0440\u0430\u0437\u0434\u0435\u043B\u0430\u043C \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u043E\u0432 \u043D\u0435\u0442. \u0418\u0437\u043C\u0435\u043D\u0438\u0442\u0435 \u0444\u0438\u043B\u044C\u0442\u0440\u044B \u0440\u0430\u0437\u0434\u0435\u043B\u043E\u0432 \u0447\u0435\u0440\u0435\u0437 \u0432\u0435\u0440\u0445\u043D\u044E\u044E \u043F\u0430\u043D\u0435\u043B\u044C."
                title="\u041D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E"
              />
            </motion.div>
          ) : (
            <motion.div key="feed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {isRefreshing ? <FeedRowsSkeleton /> : null}
              <div className="divide-y divide-border/60">
                {filteredPosts.map((post) => (
                  <FeedRow
                    key={post.id}
                    post={post}
                    onOpen={setOpenPost}
                    reactionSummary={summariesById.get(post.id)}
                    reactionsDisabled={isPending(post.id)}
                    onToggleReaction={toggle}
                  />
                ))}
              </div>

              <div className="mt-6 flex flex-col items-center gap-3">
                {isLoadingMore ? (
                  <div className="w-full">
                    <FeedRowsSkeleton />
                  </div>
                ) : postsError ? (
                  <StateCard title="\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u044B" description={postsError} actionLabel="\u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C" onAction={retryPosts} />
                ) : hasMore ? (
                  <Button variant="outline" onClick={loadMore}>
                    {'\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u0435\u0449\u0451'}
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">{query ? '\u0412\u0441\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043D\u044B\u0435 \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u044B \u0443\u0436\u0435 \u043F\u043E\u043A\u0430\u0437\u0430\u043D\u044B.' : '\u042D\u0442\u043E \u043A\u043E\u043D\u0435\u0446 \u0442\u0435\u043A\u0443\u0449\u0435\u0439 \u043F\u043E\u0434\u0431\u043E\u0440\u043A\u0438.'}</p>
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
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{openPost.topic?.name ?? '\u0418\u0441\u0442\u043E\u0447\u043D\u0438\u043A'}</p>
                <h2 className="mt-2 text-2xl font-extrabold leading-tight sm:text-3xl">{openPost.title}</h2>
                <p className="mt-2 text-xs text-muted-foreground">
                  {new Date(openPost.created_at).toLocaleDateString('ru-RU', { dateStyle: 'medium' })}
                  {openPost.content?.trim() ? ` \u2022 ${getReadingTime(openPost.content)} \u043C\u0438\u043D \u0447\u0442\u0435\u043D\u0438\u044F` : ''}
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
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{openPost.content?.trim() || openPost.excerpt || '\u0422\u0435\u043A\u0441\u0442 \u043D\u043E\u0432\u043E\u0441\u0442\u0438 \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u0435\u0442.'}</ReactMarkdown>
                </div>
              </FlatSection>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
