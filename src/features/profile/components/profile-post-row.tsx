import { BookmarkCheck, History, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getCompactPostMeta } from '@/features/profile/api';
import type { Post } from '@/types/db';

type ProfilePostRowProps = {
  post: Post;
  metaLabel: string;
  metaValue: string;
  mode: 'favorites' | 'history';
};

export function ProfilePostRow({ post, metaLabel, metaValue, mode }: ProfilePostRowProps) {
  const meta = getCompactPostMeta(post);

  return (
    <article className="overflow-hidden rounded-[1.5rem] border border-border/70 bg-card/80 p-4 shadow-[0_22px_48px_-38px_rgba(15,23,42,0.55)]">
      <div className="flex gap-4">
        <Link to={`/post/${post.id}`} className="shrink-0">
          <div className="h-20 w-20 overflow-hidden rounded-2xl bg-secondary">
            {post.cover_url ? <img src={post.cover_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-[11px] font-semibold text-muted-foreground">{meta.topicName}</div>}
          </div>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <span>{meta.topicName}</span>
            <span>{meta.createdAt}</span>
          </div>
          <Link to={`/post/${post.id}`} className="mt-2 block">
            <h3 className="line-clamp-2 text-base font-bold leading-snug transition hover:text-primary">{post.title}</h3>
          </Link>
          {post.excerpt ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{post.excerpt}</p> : null}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className={cn('inline-flex items-center gap-2 text-xs text-muted-foreground', mode === 'favorites' ? 'text-amber-600 dark:text-amber-400' : '')}>
              {mode === 'favorites' ? <BookmarkCheck className="h-3.5 w-3.5" /> : <History className="h-3.5 w-3.5" />}
              <span>
                {metaLabel}: {metaValue}
              </span>
            </div>
            <Button asChild size="sm" variant="ghost" className="h-8 px-2.5">
              <Link to={`/post/${post.id}`}>
                Открыть
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
