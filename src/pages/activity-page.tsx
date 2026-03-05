import { ChevronRight, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FlatPage } from '@/components/layout/flat';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StateCard } from '@/components/ui/state-card';
import { getSupabaseClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';

type ReactionRow = {
  post_id: string;
  value: number;
  created_at: string;
};

type ActivityPostRow = {
  id: string;
  title: string;
  excerpt: string | null;
  cover_url: string | null;
  created_at: string;
  topic_id: string;
};

type ActivityItem = ActivityPostRow & {
  reacted_at: string;
};

type ReactionsSelectBuilder = {
  eq: (column: string, value: string) => ReactionsSelectBuilder;
  order: (column: string, options: { ascending: boolean }) => ReactionsSelectBuilder;
  limit: (count: number) => Promise<{ data: ReactionRow[] | null; error: { message: string } | null }>;
};

type ReactionsQueryBuilder = {
  select: (columns: string) => ReactionsSelectBuilder;
};

type ReadCountSelectBuilder = {
  eq: (column: string, value: string) => Promise<{ count: number | null; error: { message: string } | null }>;
};

type ReadCountQueryBuilder = {
  select: (columns: string, options: { count: 'exact'; head: true }) => ReadCountSelectBuilder;
};

type ActivityPostsSelectBuilder = {
  in: (column: string, values: string[]) => Promise<{ data: ActivityPostRow[] | null; error: { message: string } | null }>;
};

type ActivityPostsQueryBuilder = {
  select: (columns: string) => ActivityPostsSelectBuilder;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ActivitySkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-xl border border-white/10 bg-white/5 p-3">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="mt-2 h-7 w-12" />
          </div>
        ))}
      </div>
      <div className="divide-y divide-border/60">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="py-4">
            <div className="flex items-start gap-4">
              <div className="h-20 w-20 shrink-0 animate-pulse rounded-xl bg-secondary sm:h-24 sm:w-24" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-5 w-3/4 animate-pulse rounded bg-secondary" />
                <div className="h-4 w-full animate-pulse rounded bg-secondary" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-secondary" />
              </div>
              <div className="h-5 w-5 animate-pulse rounded bg-secondary" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ActivityPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'liked' | 'disliked'>('liked');
  const [likedItems, setLikedItems] = useState<ActivityItem[]>([]);
  const [dislikedItems, setDislikedItems] = useState<ActivityItem[]>([]);
  const [readCount, setReadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const onClose = useCallback(() => {
    if (location.key && location.key !== 'default') {
      navigate(-1);
      return;
    }

    navigate('/profile', { replace: true });
  }, [location.key, navigate]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!user?.id) {
        setLikedItems([]);
        setDislikedItems([]);
        setReadCount(0);
        setError(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const supabase = getSupabaseClient();
        const reactionsTable = (supabase as unknown as { from: (table: string) => ReactionsQueryBuilder }).from('post_reactions');
        const readCountTable = (supabase as unknown as { from: (table: string) => ReadCountQueryBuilder }).from('post_reads');

        const [{ data: reactions, error: reactionsError }, { count, error: readCountError }] = await Promise.all([
          reactionsTable.select('post_id, value, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(200),
          readCountTable.select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        ]);

        if (reactionsError) {
          throw new Error(reactionsError.message);
        }

        if (readCountError) {
          throw new Error(readCountError.message);
        }

        const nextReadCount = count ?? 0;
        const orderedReactions = reactions ?? [];
        const seenPostIds = new Set<string>();
        const likedReactions: Array<{ post_id: string; reacted_at: string }> = [];
        const dislikedReactions: Array<{ post_id: string; reacted_at: string }> = [];

        for (const reaction of orderedReactions) {
          if (seenPostIds.has(reaction.post_id)) {
            continue;
          }

          seenPostIds.add(reaction.post_id);

          if (reaction.value === 1) {
            likedReactions.push({ post_id: reaction.post_id, reacted_at: reaction.created_at });
            continue;
          }

          if (reaction.value === -1) {
            dislikedReactions.push({ post_id: reaction.post_id, reacted_at: reaction.created_at });
          }
        }

        const allPostIds = [...new Set([...likedReactions.map((entry) => entry.post_id), ...dislikedReactions.map((entry) => entry.post_id)])];
        let postsById = new Map<string, ActivityPostRow>();

        if (allPostIds.length > 0) {
          const postsTable = supabase.from('posts') as unknown as ActivityPostsQueryBuilder;
          const { data: posts, error: postsError } = await postsTable.select('id, title, excerpt, cover_url, created_at, topic_id').in('id', allPostIds);

          if (postsError) {
            throw new Error(postsError.message);
          }

          postsById = new Map((posts ?? []).map((post) => [post.id, post]));
        }

        const nextLikedItems = likedReactions
          .map((entry) => {
            const post = postsById.get(entry.post_id);

            if (!post) {
              return null;
            }

            return {
              ...post,
              reacted_at: entry.reacted_at,
            };
          })
          .filter((entry): entry is ActivityItem => entry !== null);

        const nextDislikedItems = dislikedReactions
          .map((entry) => {
            const post = postsById.get(entry.post_id);

            if (!post) {
              return null;
            }

            return {
              ...post,
              reacted_at: entry.reacted_at,
            };
          })
          .filter((entry): entry is ActivityItem => entry !== null);

        if (!cancelled) {
          setLikedItems(nextLikedItems);
          setDislikedItems(nextDislikedItems);
          setReadCount(nextReadCount);
        }
      } catch {
        if (!cancelled) {
          setLikedItems([]);
          setDislikedItems([]);
          setReadCount(0);
          setError('Не удалось загрузить активность.');
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
  }, [reloadKey, user?.id]);

  const currentItems = activeTab === 'liked' ? likedItems : dislikedItems;

  return (
    <FlatPage className="py-6 sm:py-8">
      <div className="space-y-5">
        <div className="border-b border-border/60 pb-4">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-3xl font-extrabold">Активность</h1>
            <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Закрыть">
              <X className="h-5 w-5" />
            </Button>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Ваши реакции и история чтения.</p>
        </div>

        {!user ? (
          <div className="space-y-3">
            <StateCard title="Нужен вход" description="Войдите, чтобы видеть активность." />
            <Button type="button" onClick={() => navigate('/profile')}>
              {'Перейти в профиль'}
            </Button>
          </div>
        ) : null}

        {user && isLoading ? <ActivitySkeleton /> : null}

        {user && !isLoading && error ? (
          <div className="border-y border-destructive/35 bg-destructive/10 p-4 text-sm text-destructive">
            <p>{error}</p>
            <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => setReloadKey((value) => value + 1)}>
              {'Повторить'}
            </Button>
          </div>
        ) : null}

        {user && !isLoading && !error ? (
          <>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs text-white/60">Лайки</p>
                <p className="mt-1 text-xl font-semibold text-white">{likedItems.length}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs text-white/60">Дизлайки</p>
                <p className="mt-1 text-xl font-semibold text-white">{dislikedItems.length}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs text-white/60">Прочитано</p>
                <p className="mt-1 text-xl font-semibold text-white">{readCount}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('liked')}
                className={cn(
                  'inline-flex items-center rounded-full px-3 py-1.5 text-sm transition-colors',
                  activeTab === 'liked' ? 'bg-white/10 text-white' : 'bg-white/5 text-white/80 hover:bg-white/10',
                )}
              >
                {'👍 Понравилось'}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('disliked')}
                className={cn(
                  'inline-flex items-center rounded-full px-3 py-1.5 text-sm transition-colors',
                  activeTab === 'disliked' ? 'bg-white/10 text-white' : 'bg-white/5 text-white/80 hover:bg-white/10',
                )}
              >
                {'👎 Не понравилось'}
              </button>
            </div>

            {currentItems.length === 0 ? (
              <StateCard title={activeTab === 'liked' ? 'Пока нет понравившихся' : 'Пока нет дизлайков'} description="Реагируйте на публикации, и они появятся здесь." />
            ) : (
              <div className="divide-y divide-white/10">
                {currentItems.map((item) => (
                  <button
                    key={`${activeTab}:${item.id}:${item.reacted_at}`}
                    type="button"
                    className="flex w-full items-start gap-4 py-4 text-left transition-colors hover:bg-white/5 active:bg-white/10"
                    onClick={() => navigate(`/post/${item.id}`)}
                  >
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-secondary sm:h-24 sm:w-24">
                      {item.cover_url ? <img src={item.cover_url} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="line-clamp-2 text-lg font-bold leading-tight">{item.title}</h2>
                      {item.excerpt ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.excerpt}</p> : null}
                      <p className="mt-2 text-xs text-muted-foreground">{`Реакция: ${formatDate(item.reacted_at)}`}</p>
                    </div>
                    <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </FlatPage>
  );
}
