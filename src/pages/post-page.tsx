import { motion } from 'framer-motion';
import { ArrowLeft, Clock3, PencilLine } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Container } from '@/components/layout/container';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StateCard } from '@/components/ui/state-card';
import { getPost } from '@/features/posts/api';
import { useAuth } from '@/providers/auth-provider';
import type { Post } from '@/types/db';

export function PostPage() {
  const { id } = useParams();
  const { isAdmin } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadPost() {
      if (!id) {
        setError('Post id is missing.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const loadedPost = await getPost(id);

        if (!ignore) {
          setPost(loadedPost);
        }
      } catch (loadError) {
        if (!ignore) {
          setPost(null);
          setError(loadError instanceof Error ? loadError.message : 'Unexpected error.');
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadPost();

    return () => {
      ignore = true;
    };
  }, [id]);

  if (isLoading) {
    return (
      <Container className="safe-pb py-10">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Skeleton className="h-10 w-28 rounded-full" />
          <Skeleton className="h-5 w-40 rounded-full" />
        </div>
        <div className="mx-auto max-w-4xl overflow-hidden rounded-[2rem] border border-border/70 bg-card/85 p-6 shadow-[0_30px_80px_-45px_rgba(15,23,42,0.55)]">
          <Skeleton className="aspect-[16/7] w-full rounded-[1.5rem]" />
          <div className="mt-8 space-y-4">
            <Skeleton className="h-5 w-28 rounded-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-4/5" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-5/6" />
            <Skeleton className="h-6 w-3/4" />
          </div>
        </div>
      </Container>
    );
  }

  if (error || !post) {
    return (
      <Container className="safe-pb py-10">
        <StateCard title="Post unavailable" description={error ?? 'The requested post could not be loaded.'} />
      </Container>
    );
  }

  const topic = post.topic;

  return (
    <Container className="safe-pb py-10">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
          {isAdmin ? (
            <Button asChild variant="outline">
              <Link to={`/admin/edit/${post.id}`}>
                <PencilLine className="h-4 w-4" />
                Edit
              </Link>
            </Button>
          ) : null}
        </div>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock3 className="h-3.5 w-3.5" />
          {new Date(post.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
        </span>
      </motion.div>

      <motion.article
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mx-auto max-w-4xl overflow-hidden rounded-[2rem] border border-border/70 bg-card/85 shadow-[0_30px_80px_-45px_rgba(15,23,42,0.55)] backdrop-blur"
      >
        {post.cover_url ? <img src={post.cover_url} alt="" className="aspect-[16/7] w-full object-cover" /> : null}
        <div className="p-6 sm:p-8 lg:p-10">
          <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
            {topic?.name ?? 'General'}
          </span>
          <h1 className="mt-5 max-w-3xl font-['Source_Serif_4'] text-4xl font-bold leading-tight sm:text-5xl">{post.title}</h1>
          {post.excerpt ? <p className="mt-4 max-w-3xl text-lg leading-8 text-muted-foreground">{post.excerpt}</p> : null}
          <div className="prose prose-slate mt-10 max-w-none prose-headings:font-['Source_Serif_4'] prose-pre:rounded-[1.25rem] prose-pre:bg-slate-950 prose-img:rounded-[1.25rem] dark:prose-invert">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
                code: ({ className, children, ...props }) => (
                  <code className={className} {...props}>
                    {children}
                  </code>
                ),
                img: ({ alt, src }) => <img alt={alt ?? ''} src={src ?? ''} loading="lazy" />,
              }}
            >
              {post.content}
            </ReactMarkdown>
          </div>
        </div>
      </motion.article>
    </Container>
  );
}
