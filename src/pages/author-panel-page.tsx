import { ChevronRight, FilePenLine, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FlatPage } from '@/components/layout/flat';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StateCard } from '@/components/ui/state-card';
import { getSupabaseClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';

type AuthorPost = {
  id: string;
  title: string;
  excerpt: string | null;
  cover_url: string | null;
  created_at: string;
  topic_id: string;
  author_id: string | null;
  is_published?: boolean | null;
  published_at?: string | null;
  scheduled_at?: string | null;
};

type PostsSelectBuilder = {
  order: (
    column: string,
    options: { ascending: boolean },
  ) => Promise<{
    data: AuthorPost[] | null;
    error: { message: string } | null;
  }>;
  eq: (column: string, value: string) => PostsSelectBuilder;
};

type PostsQueryBuilder = {
  select: (columns: string) => PostsSelectBuilder;
};

type TabKey = 'drafts' | 'published' | 'scheduled';

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

function AuthorPanelSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-9 w-32 rounded-full" />
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
              <div className="h-9 w-28 animate-pulse rounded-full bg-secondary" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AuthorPanelPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthed, loading, profile, user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('drafts');
  const [posts, setPosts] = useState<AuthorPost[]>([]);
  const [hasPublishedAt, setHasPublishedAt] = useState(false);
  const [hasScheduledAt, setHasScheduledAt] = useState(false);
  const [hasIsPublished, setHasIsPublished] = useState(false);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const isAdmin = profile?.role === 'admin';
  const canUseAuthorPanel = profile?.role === 'admin' || profile?.role === 'editor';

  const onClose = useCallback(() => {
    if (location.key && location.key !== 'default') {
      navigate(-1);
      return;
    }

    navigate('/profile', { replace: true });
  }, [location.key, navigate]);

  const openEditor = useCallback(
    (postId: string) => {
      navigate(`/admin/edit/${postId}`, {
        state: {
          returnTo: '/author',
          returnScrollY: getCurrentScrollY(),
        },
      });
    },
    [navigate],
  );

  const loadPosts = useCallback(async () => {
    if (!user?.id || !canUseAuthorPanel) {
      setPosts([]);
      setError(null);
      setIsLoadingPosts(false);
      return;
    }

    setIsLoadingPosts(true);
    setError(null);

    const supabase = getSupabaseClient();
    const postsTable = supabase.from('posts') as unknown as PostsQueryBuilder;
    const selectCandidates = [
      { columns: 'id, title, excerpt, cover_url, created_at, topic_id, author_id, is_published, published_at, scheduled_at', hasPublishedAt: true, hasScheduledAt: true, hasIsPublished: true },
      { columns: 'id, title, excerpt, cover_url, created_at, topic_id, author_id, is_published, published_at', hasPublishedAt: true, hasScheduledAt: false, hasIsPublished: true },
      { columns: 'id, title, excerpt, cover_url, created_at, topic_id, author_id, is_published', hasPublishedAt: false, hasScheduledAt: false, hasIsPublished: true },
      { columns: 'id, title, excerpt, cover_url, created_at, topic_id, author_id', hasPublishedAt: false, hasScheduledAt: false, hasIsPublished: false },
    ];

    let lastErrorMessage = 'Не удалось загрузить публикации.';

    for (const candidate of selectCandidates) {
      const baseQuery = postsTable.select(candidate.columns);
      const queryResult = isAdmin ? await baseQuery.order('created_at', { ascending: false }) : await baseQuery.eq('author_id', user.id).order('created_at', { ascending: false });

      if (queryResult.error) {
        lastErrorMessage = queryResult.error.message;
        const isMissingColumn = queryResult.error.message.toLowerCase().includes('column');

        if (isMissingColumn) {
          continue;
        }

        throw new Error(lastErrorMessage);
      }

      setPosts(queryResult.data ?? []);
      setHasPublishedAt(candidate.hasPublishedAt);
      setHasScheduledAt(candidate.hasScheduledAt);
      setHasIsPublished(candidate.hasIsPublished);
      return;
    }

    throw new Error(lastErrorMessage);
  }, [canUseAuthorPanel, isAdmin, user?.id]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!canUseAuthorPanel || !user?.id) {
        if (!cancelled) {
          setPosts([]);
          setError(null);
          setIsLoadingPosts(false);
        }
        return;
      }

      try {
        await loadPosts();
      } catch {
        if (!cancelled) {
          setPosts([]);
          setError('Не удалось загрузить панель автора.');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPosts(false);
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [canUseAuthorPanel, loadPosts, reloadKey, user?.id]);

  const nowTs = Date.now();
  const classified = useMemo(() => {
    if (hasPublishedAt && hasScheduledAt) {
      const drafts = posts.filter((post) => !post.published_at && !post.scheduled_at);
      const published = posts.filter((post) => Boolean(post.published_at));
      const scheduled = posts.filter((post) => !post.published_at && Boolean(post.scheduled_at) && new Date(post.scheduled_at ?? '').getTime() > nowTs);
      return { drafts, published, scheduled, scheduledUnsupported: false };
    }

    if (hasPublishedAt) {
      const drafts = posts.filter((post) => !post.published_at);
      const published = posts.filter((post) => Boolean(post.published_at));
      return { drafts, published, scheduled: [] as AuthorPost[], scheduledUnsupported: true };
    }

    if (hasIsPublished) {
      const drafts = posts.filter((post) => post.is_published !== true);
      const published = posts.filter((post) => post.is_published === true);
      return { drafts, published, scheduled: [] as AuthorPost[], scheduledUnsupported: true };
    }

    return { drafts: posts, published: [] as AuthorPost[], scheduled: [] as AuthorPost[], scheduledUnsupported: true };
  }, [hasIsPublished, hasPublishedAt, hasScheduledAt, nowTs, posts]);

  const tabItems = useMemo(
    () => [
      { key: 'drafts' as const, label: 'Черновики', count: classified.drafts.length },
      { key: 'published' as const, label: 'Опубликовано', count: classified.published.length },
      { key: 'scheduled' as const, label: 'Запланировано', count: classified.scheduled.length },
    ],
    [classified.drafts.length, classified.published.length, classified.scheduled.length],
  );

  const currentList = activeTab === 'drafts' ? classified.drafts : activeTab === 'published' ? classified.published : classified.scheduled;

  const getStatusLabel = useCallback(
    (post: AuthorPost) => {
      if (hasPublishedAt && hasScheduledAt) {
        if (post.published_at) {
          return 'Опубликовано';
        }
        if (post.scheduled_at && new Date(post.scheduled_at).getTime() > nowTs) {
          return 'Запланировано';
        }
        return 'Черновик';
      }

      if (hasPublishedAt) {
        return post.published_at ? 'Опубликовано' : 'Черновик';
      }

      if (hasIsPublished) {
        return post.is_published ? 'Опубликовано' : 'Черновик';
      }

      return activeTab === 'published' ? 'Опубликовано' : activeTab === 'scheduled' ? 'Запланировано' : 'Черновик';
    },
    [activeTab, hasIsPublished, hasPublishedAt, hasScheduledAt, nowTs],
  );

  if (loading) {
    return (
      <FlatPage className="py-6 sm:py-8">
        <AuthorPanelSkeleton />
      </FlatPage>
    );
  }

  if (!isAuthed || !user) {
    return (
      <FlatPage className="py-6 sm:py-8">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-3xl font-extrabold">Панель автора</h1>
            <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Закрыть">
              <X className="h-5 w-5" />
            </Button>
          </div>
          <StateCard title="Нужен вход" description="Войдите, чтобы открыть панель автора." />
          <Button type="button" onClick={() => navigate('/profile')}>
            {'Перейти в профиль'}
          </Button>
        </div>
      </FlatPage>
    );
  }

  if (!canUseAuthorPanel) {
    return (
      <FlatPage className="py-6 sm:py-8">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-3xl font-extrabold">Панель автора</h1>
            <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Закрыть">
              <X className="h-5 w-5" />
            </Button>
          </div>
          <StateCard title="Нет доступа" description="Доступно только редакторам и администраторам." />
          <Button type="button" onClick={() => navigate('/profile')}>
            {'Вернуться в профиль'}
          </Button>
        </div>
      </FlatPage>
    );
  }

  return (
    <FlatPage className="py-6 sm:py-8">
      <div className="space-y-5">
        <div className="border-b border-border/60 pb-4">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-3xl font-extrabold">Панель автора</h1>
            <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Закрыть">
              <X className="h-5 w-5" />
            </Button>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Управляйте публикациями по статусам.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {tabItems.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors',
                activeTab === tab.key ? 'bg-white/10 text-white' : 'bg-white/5 text-white/80 hover:bg-white/10',
              )}
            >
              <span>{tab.label}</span>
              <span className="text-xs text-white/60">{tab.count}</span>
            </button>
          ))}
        </div>

        {isLoadingPosts ? <AuthorPanelSkeleton /> : null}

        {!isLoadingPosts && error ? (
          <div className="border-y border-destructive/35 bg-destructive/10 p-4 text-sm text-destructive">
            <p>{error}</p>
            <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => setReloadKey((value) => value + 1)}>
              {'Повторить'}
            </Button>
          </div>
        ) : null}

        {!isLoadingPosts && !error && activeTab === 'scheduled' && classified.scheduledUnsupported ? (
          <StateCard title="Планирование пока не поддерживается" description="Для текущей схемы публикаций вкладка запланированных пока недоступна." />
        ) : null}

        {!isLoadingPosts && !error && !(activeTab === 'scheduled' && classified.scheduledUnsupported) && currentList.length === 0 ? (
          <StateCard
            title={activeTab === 'drafts' ? 'Нет черновиков' : activeTab === 'published' ? 'Нет опубликованных' : 'Нет запланированных'}
            description="Когда появятся публикации этого типа, они отобразятся здесь."
          />
        ) : null}

        {!isLoadingPosts && !error && !(activeTab === 'scheduled' && classified.scheduledUnsupported) && currentList.length > 0 ? (
          <div className="divide-y divide-white/10">
            {currentList.map((post) => (
              <button
                key={`${activeTab}:${post.id}`}
                type="button"
                className="flex w-full items-start gap-4 py-4 text-left transition-colors hover:bg-white/5 active:bg-white/10"
                onClick={() => openEditor(post.id)}
              >
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-secondary sm:h-24 sm:w-24">
                  {post.cover_url ? <img src={post.cover_url} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="line-clamp-2 text-lg font-bold leading-tight">{post.title}</h2>
                  {post.excerpt ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{post.excerpt}</p> : null}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {`${getStatusLabel(post)} • ${formatDate(post.created_at)}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={(event) => {
                      event.stopPropagation();
                      openEditor(post.id);
                    }}
                  >
                    <FilePenLine className="h-4 w-4" />
                    {'Редактировать'}
                  </Button>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </FlatPage>
  );
}
