import { ArrowUpRight, Clock3 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { AppLink } from '@/components/ui/app-link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BookmarkButton } from '@/features/profile/components/bookmark-button';
import { markFeedReturnIntent, saveFeedState } from '@/lib/feed-state';
import { useAuth } from '@/providers/auth-provider';
import type { Post } from '@/types/db';

function getReadingTime(content: string) {
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(wordCount / 200));
}

export function PostCard({ post, index }: { post: Post; index: number }) {
  const { isAdmin } = useAuth();
  const readingTime = getReadingTime(post.content);

  const handleOpen = () => {
    saveFeedState({
      scrollY: window.scrollY,
      search: window.location.search,
    });
    markFeedReturnIntent();
  };

  return (
    <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05, duration: 0.35, ease: 'easeOut' }}>
      <Card className="group overflow-hidden transition duration-300 hover:-translate-y-1.5 hover:border-primary/45 hover:shadow-[0_32px_90px_-42px_rgba(8,145,209,0.55)]">
        <Link to={`/post/${post.id}`} className="block" onClick={handleOpen}>
          {post.cover_url ? (
            <div className="relative aspect-[16/8] overflow-hidden">
              <img src={post.cover_url} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-transparent" />
            </div>
          ) : null}
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                {post.topic?.name ?? 'Новости'}
              </span>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock3 className="h-3.5 w-3.5" />
                  {new Date(post.created_at).toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' })}
                </span>
                <span>{readingTime} мин</span>
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-extrabold leading-tight text-balance">{post.title}</h2>
              <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{post.excerpt}</p>
            </div>
          </CardContent>
        </Link>
        <div className="flex items-center justify-between gap-2 border-t border-border/70 px-6 py-4 text-sm font-semibold text-primary">
          <BookmarkButton postId={post.id} size="sm" variant="ghost" showLabel className="h-8 px-2.5 text-foreground" />
          <div className="flex items-center gap-2">
            {isAdmin ? (
              <Button asChild size="sm" variant="outline">
                <AppLink to={`/admin/edit/${post.id}`}>Редактировать</AppLink>
              </Button>
            ) : null}
            <Button asChild size="sm" variant={isAdmin ? 'ghost' : 'outline'}>
              <AppLink to={`/post/${post.id}`} onClick={handleOpen}>
                Читать
                <ArrowUpRight className="h-4 w-4" />
              </AppLink>
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
