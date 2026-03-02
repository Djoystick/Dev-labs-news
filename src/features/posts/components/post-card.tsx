import { ArrowUpRight, Clock3 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import type { Post } from '@/types/post';

export function PostCard({ post, index }: { post: Post; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.35, ease: 'easeOut' }}
    >
      <Link to={`/post/${post.id}`} className="group block">
        <Card className="overflow-hidden transition duration-300 group-hover:-translate-y-1 group-hover:border-primary/45">
          {post.cover_url ? (
            <div className="aspect-[16/8] overflow-hidden">
              <img src={post.cover_url} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
            </div>
          ) : null}
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                {post.topic?.name ?? 'General'}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5" />
                {new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-extrabold leading-tight">{post.title}</h2>
              <p className="text-sm leading-6 text-muted-foreground">{post.excerpt}</p>
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              Read article
              <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}
