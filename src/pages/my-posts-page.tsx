import { FilePenLine } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AdminGuard } from '@/components/auth/admin-guard';
import { FlatPage } from '@/components/layout/flat';
import { Button } from '@/components/ui/button';
import { StateCard } from '@/components/ui/state-card';
import { PostReactions } from '@/features/reactions/components/PostReactions';
import { useReactions } from '@/features/reactions/use-reactions';
import { normalizeHandle } from '@/lib/author-label';
import { getSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type MyPost = {
  id: string;
  title: string;
  excerpt: string | null;
  cover_url: string | null;
  created_at: string;
  topic_id: string;
  author_id: string | null;
  is_published?: boolean | null;
};

type MyPostsSelectBuilder = {
  order: (
    column: string,
    options: { ascending: boolean },
  ) => Promise<{
    data: MyPost[] | null;
    error: { message: string } | null;
  }>;
  eq: (column: string, value: string) => MyPostsSelectBuilder;
};

type MyPostsQueryBuilder = {
  select: (columns: string) => MyPostsSelectBuilder;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getAppScrollContainer() {
  return document.getElementById('app-scroll') as HTMLElement | null;
}

function getCurrentScrollY() {
  const container = getAppScrollContainer();
  return container?.scrollTop ?? window.scrollY;
}

function restoreScrollPosition(scrollY: number) {
  const nextY = Math.max(0, scrollY);
  const container = getAppScrollContainer();

  if (container) {
    container.scrollTop = nextY;
    return;
  }

  window.scrollTo({ top: nextY, behavior: 'auto' });
}

function MyPostsSkeleton() {
  return (
    <div className="divide-y divide-border/60">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="py-4">
          <div className="flex items-start gap-4">
            <div className="h-20 w-20 shrink-0 animate-pulse rounded-xl bg-secondary sm:h-24 sm:w-24" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-5 w-3/4 animate-pulse rounded bg-secondary" />
              <div className="h-4 w-full animate-pulse rounded bg-secondary" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-secondary" />
              <div className="h-3 w-40 animate-pulse rounded bg-secondary" />
            </div>
            <div className="h-9 w-28 animate-pulse rounded bg-secondary" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MyPostsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();
  const [posts, setPosts] = useState<MyPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const isAdmin = profile?.role === 'admin';
  const postIds = useMemo(() => posts.map((post) => post.id), [posts]);
  const { summariesById, toggle, isPending } = useReactions(postIds);

  const loadPosts = useCallback(async () => {
    if (!user?.id) {
      setPosts([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const supabase = getSupabaseClient();
    const postsTable = supabase.from('posts') as unknown as MyPostsQueryBuilder;
    const baseQuery = postsTable.select('id, title, excerpt, cover_url, created_at, topic_id, author_id, is_published');
    const { data, error: queryError } = isAdmin
      ? await baseQuery.order('created_at', { ascending: false })
      : await baseQuery.eq('author_id', user.id).order('created_at', { ascending: false });

    if (queryError) {
      throw new Error(`Failed to load posts. ${queryError.message}`);
    }

    setPosts(data ?? []);
  }, [isAdmin, user?.id]);

  const pageTitle = isAdmin ? 'Все публикации' : 'Мои публикации';

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        await loadPosts();
      } catch {
        if (!cancelled) {
          setPosts([]);
          setError('Не удалось загрузить публикации.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [loadPosts, reloadKey]);

  const pageDescription = useMemo(() => {
    if (posts.length === 0) {
      return isAdmin ? 'Публикации всех авторов отображаются здесь.' : 'Публикации, созданные вами.';
    }

    return `Всего публикаций: ${posts.length}`;
  }, [isAdmin, posts.length]);

  const restoreScrollY = useMemo(() => {
    const state = location.state as { restoreScrollY?: unknown } | null;

    if (!state || typeof state.restoreScrollY !== 'number' || !Number.isFinite(state.restoreScrollY)) {
      return null;
    }

    return state.restoreScrollY;
  }, [location.state]);

  useEffect(() => {
    if (restoreScrollY === null || isLoading) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      restoreScrollPosition(restoreScrollY);
      navigate('.', { replace: true, state: null });
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [isLoading, navigate, restoreScrollY]);

  return (
    <AdminGuard allowEditor>
      <FlatPage className="safe-pb py-6 sm:py-8">
        <div className="space-y-5">
          <div className="border-b border-border/60 pb-4">
            <h1 className="text-3xl font-extrabold">{pageTitle}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{pageDescription}</p>
          </div>

          {isLoading ? <MyPostsSkeleton /> : null}

          {!isLoading && error ? (
            <div className="border-y border-destructive/35 bg-destructive/10 p-4 text-sm text-destructive">
              <p>{error}</p>
              <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => setReloadKey((value) => value + 1)}>
                {'Повторить'}
              </Button>
            </div>
          ) : null}

          {!isLoading && !error && posts.length === 0 ? <StateCard title="Пока нет публикаций" description="Создайте первую новость, она появится здесь." /> : null}

          {!isLoading && !error && posts.length > 0 ? (
            <div className="divide-y divide-border/60">
              {posts.map((post) => (
                <div key={post.id} className="py-4">
                  <div className="flex items-start gap-4">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-secondary sm:h-24 sm:w-24">
                      {post.cover_url ? <img src={post.cover_url} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="line-clamp-2 text-lg font-bold leading-tight">{post.title}</h2>
                      {post.excerpt ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{post.excerpt}</p> : null}
                      <p className="mt-2 text-xs text-muted-foreground">
                        {formatDate(post.created_at)}
                        {` • ${normalizeHandle(undefined) ?? 'Автор'}`}
                        {typeof post.is_published === 'boolean' ? ` • ${post.is_published ? 'Опубликовано' : 'Черновик'}` : ''}
                      </p>
                      <div className="mt-2">
                        <PostReactions postId={post.id} summary={summariesById.get(post.id)} disabled={isPending(post.id)} onToggle={toggle} />
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      onClick={() =>
                        navigate(`/admin/edit/${post.id}`, {
                          state: {
                            returnTo: '/my-posts',
                            returnScrollY: getCurrentScrollY(),
                          },
                        })
                      }
                    >
                      <FilePenLine className="h-4 w-4" />
                      Edit
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </FlatPage>
    </AdminGuard>
  );
}
