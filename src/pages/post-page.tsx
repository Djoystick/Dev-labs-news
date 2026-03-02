import { ArrowLeft, Clock3 } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Container } from '@/components/layout/container';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { postSeeds } from '@/features/posts/data';
import { topicSeeds } from '@/features/topics/data';

export function PostPage() {
  const { id } = useParams();
  const post = postSeeds.find((item) => item.id === id);
  const topic = topicSeeds.find((item) => item.id === post?.topic_id);

  if (!post) {
    return (
      <Container className="safe-pb py-10">
        <Card className="mx-auto max-w-2xl">
          <CardHeader>
            <CardTitle>Post not found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-6 text-sm leading-6 text-muted-foreground">This route is already wired. Real content will come from Supabase in Stage 3.</p>
            <Button asChild>
              <Link to="/">Back to feed</Link>
            </Button>
          </CardContent>
        </Card>
      </Container>
    );
  }

  return (
    <Container className="safe-pb py-10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Button asChild variant="ghost">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock3 className="h-3.5 w-3.5" />
          {new Date(post.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
        </span>
      </div>

      <article className="mx-auto max-w-4xl overflow-hidden rounded-[2rem] border border-border/70 bg-card/85 shadow-[0_30px_80px_-45px_rgba(15,23,42,0.55)] backdrop-blur">
        {post.cover_url ? <img src={post.cover_url} alt="" className="aspect-[16/7] w-full object-cover" /> : null}
        <div className="p-6 sm:p-8 lg:p-10">
          <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
            {topic?.name ?? 'General'}
          </span>
          <h1 className="mt-5 max-w-3xl font-['Source_Serif_4'] text-4xl font-bold leading-tight sm:text-5xl">{post.title}</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-muted-foreground">{post.excerpt}</p>
          <div className="prose prose-slate mt-10 max-w-none dark:prose-invert">
            <p>{post.content}</p>
            <p>Stage 1 intentionally keeps the detail page lightweight: route, layout, typography, and navigation are already in place for the CRUD and markdown editor work coming next.</p>
          </div>
        </div>
      </article>
    </Container>
  );
}
