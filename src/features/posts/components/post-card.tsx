import { motion } from 'framer-motion';
import { ArrowUpRight, Clock3 } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { AppLink } from '@/components/ui/app-link';
import { Button } from '@/components/ui/button';
import { useAuthorHandles } from '@/features/profiles/use-author-handles';
import { BookmarkButton } from '@/features/profile/components/bookmark-button';
import { PostReactions } from '@/features/reactions/components/PostReactions';
import type { ReactionSummary } from '@/features/reactions/api';
import { normalizeHandle } from '@/lib/author-label';
import { markFeedReturnIntent, saveFeedState } from '@/lib/feed-state';
import { getPostPath } from '@/lib/post-links';
import { useAuth } from '@/providers/auth-provider';
import type { Post } from '@/types/db';

function getReadingTime(content: string) {
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(wordCount / 200));
}

export function PostCard({
  post,
  index,
  reactionSummary,
  reactionsDisabled = false,
  onToggleReaction,
  onOpenPost,
}: {
  post: Post;
  index: number;
  reactionSummary?: ReactionSummary | null;
  reactionsDisabled?: boolean;
  onToggleReaction?: (postId: string, value: -1 | 1) => void;
  onOpenPost?: (post: Post) => void;
}) {
  const { isAdmin } = useAuth();
  const location = useLocation();
  const readingTime = getReadingTime(post.content);
  const { getName } = useAuthorHandles(post.author_id ? [post.author_id] : []);
  const authorLabel = normalizeHandle(getName(post.author_id)) ?? 'Автор';
  const postPath = getPostPath(post.id);
  const openState = {
    from: `${location.pathname}${location.search}`,
  };

  const handleOpen = () => {
    onOpenPost?.(post);
    saveFeedState({
      scrollY: window.scrollY,
      search: window.location.search,
    });
    markFeedReturnIntent();
  };

  return (
    <motion.article initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05, duration: 0.35, ease: 'easeOut' }} className="py-4">
      <Link to={postPath} state={openState} className="block" onClick={handleOpen}>
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="font-bold uppercase tracking-[0.2em]">{post.topic?.name ?? 'News'}</span>
              <span className="flex items-center gap-1">
                <Clock3 className="h-3.5 w-3.5" />
                {new Date(post.created_at).toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' })}
              </span>
              <span>{readingTime} min</span>
              <span className="max-w-[9rem] truncate">{authorLabel}</span>
            </div>
            <h2 className="mt-2 text-xl font-extrabold leading-tight text-balance">{post.title}</h2>
            <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{post.excerpt}</p>
          </div>
          {post.cover_url ? (
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-secondary sm:h-24 sm:w-24">
              <img src={post.cover_url} alt="" loading="lazy" className="h-full w-full object-cover" />
            </div>
          ) : null}
        </div>
      </Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3 text-sm font-semibold text-primary">
        <div className="flex items-center gap-3">
          {onToggleReaction ? (
            <PostReactions postId={post.id} summary={reactionSummary} disabled={reactionsDisabled} onToggle={onToggleReaction} />
          ) : null}
          <BookmarkButton postId={post.id} size="sm" variant="ghost" showLabel className="h-8 px-2.5 text-foreground" />
        </div>
        <div className="flex items-center gap-2">
          {isAdmin ? (
            <Button asChild size="sm" variant="outline">
              <AppLink to={`/admin/edit/${post.id}`}>{'Редактировать'}</AppLink>
            </Button>
          ) : null}
          <Button asChild size="sm" variant={isAdmin ? 'ghost' : 'outline'}>
            <AppLink to={postPath} state={openState} onClick={handleOpen}>
              {'Читать'}
              <ArrowUpRight className="h-4 w-4" />
            </AppLink>
          </Button>
        </div>
      </div>
    </motion.article>
  );
}
