import { ChevronRight, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FlatPage } from '@/components/layout/flat';
import { Button } from '@/components/ui/button';
import { StateCard } from '@/components/ui/state-card';
import { getSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type PostReadRow = {
  post_id: string;
  read_at: string;
};

type HistoryPostRow = {
  id: string;
  title: string;
  excerpt: string | null;
  cover_url: string | null;
  created_at: string;
  topic_id: string;
};

type ReadingHistoryItem = HistoryPostRow & {
  read_at: string;
};

type PostReadsSelectBuilder = {
  eq: (column: string, value: string) => PostReadsSelectBuilder;
  order: (column: string, options: { ascending: boolean }) => PostReadsSelectBuilder;
  limit: (count: number) => Promise<{ data: PostReadRow[] | null; error: { message: string } | null }>;
};

type PostReadsQueryBuilder = {
  select: (columns: string) => PostReadsSelectBuilder;
};

type HistoryPostsSelectBuilder = {
  in: (column: string, values: string[]) => Promise<{ data: HistoryPostRow[] | null; error: { message: string } | null }>;
};

type HistoryPostsQueryBuilder = {
  select: (columns: string) => HistoryPostsSelectBuilder;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ReadingHistorySkeleton() {
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
            </div>
            <div className="h-5 w-5 animate-pulse rounded bg-secondary" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ReadingHistoryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [items, setItems] = useState<ReadingHistoryItem[]>([]);
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
        setItems([]);
        setError(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const supabase = getSupabaseClient();
        const postReadsTable = (supabase as unknown as { from: (table: string) => PostReadsQueryBuilder }).from('post_reads');
        const { data: reads, error: readsError } = await postReadsTable
          .select('post_id, read_at:created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (readsError) {
          throw new Error(readsError.message);
        }

        const orderedReads = reads ?? [];

        if (orderedReads.length === 0) {
          if (!cancelled) {
            setItems([]);
          }
          return;
        }

        const postIds = [...new Set(orderedReads.map((entry) => entry.post_id))];
        const postsTable = supabase.from('posts') as unknown as HistoryPostsQueryBuilder;
        const { data: posts, error: postsError } = await postsTable.select('id, title, excerpt, cover_url, created_at, topic_id').in('id', postIds);

        if (postsError) {
          throw new Error(postsError.message);
        }

        const postsById = new Map((posts ?? []).map((post) => [post.id, post]));
        const nextItems = orderedReads
          .map((entry) => {
            const post = postsById.get(entry.post_id);

            if (!post) {
              return null;
            }

            return {
              ...post,
              read_at: entry.read_at,
            };
          })
          .filter((entry): entry is ReadingHistoryItem => entry !== null);

        if (!cancelled) {
          setItems(nextItems);
        }
      } catch {
        if (!cancelled) {
          setItems([]);
          setError('Не удалось загрузить историю чтения.');
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

  const pageDescription = useMemo(() => {
    if (items.length === 0) {
      return 'Последние открытые публикации.';
    }

    return `Записей в истории: ${items.length}`;
  }, [items.length]);

  return (
    <FlatPage className="py-6 sm:py-8">
      <div className="space-y-5">
        <div className="border-b border-border/60 pb-4">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-3xl font-extrabold">История чтения</h1>
            <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Закрыть">
              <X className="h-5 w-5" />
            </Button>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{pageDescription}</p>
        </div>

        {!user ? (
          <div className="space-y-3">
            <StateCard title="Нужен вход" description="Войдите, чтобы видеть историю чтения." />
            <Button type="button" onClick={() => navigate('/profile')}>
              {'Перейти в профиль'}
            </Button>
          </div>
        ) : null}

        {user && isLoading ? <ReadingHistorySkeleton /> : null}

        {user && !isLoading && error ? (
          <div className="border-y border-destructive/35 bg-destructive/10 p-4 text-sm text-destructive">
            <p>{error}</p>
            <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => setReloadKey((value) => value + 1)}>
              {'Повторить'}
            </Button>
          </div>
        ) : null}

        {user && !isLoading && !error && items.length === 0 ? (
          <StateCard title="Пока нет истории" description="Открывайте публикации — они появятся здесь." />
        ) : null}

        {user && !isLoading && !error && items.length > 0 ? (
          <div className="divide-y divide-border/60">
            {items.map((item) => (
              <button
                key={`${item.id}:${item.read_at}`}
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
                  <p className="mt-2 text-xs text-muted-foreground">{`Прочитано: ${formatDate(item.read_at)}`}</p>
                </div>
                <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </FlatPage>
  );
}
