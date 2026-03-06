import { ChevronRight, FilePenLine, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
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
  updated_at: string;
  topic_id: string;
  author_id: string | null;
  is_published: boolean;
  published_at: string | null;
  scheduled_at: string | null;
};

type TabKey = 'drafts' | 'published' | 'scheduled';

const TAB_ITEMS: Array<{ key: TabKey; label: string }> = [
  { key: 'drafts', label: 'Черновики' },
  { key: 'published', label: 'Опубликовано' },
  { key: 'scheduled', label: 'Запланировано' },
];

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('ru-RU', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  });
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
    let query = supabase
      .from('posts')
      .select('id, title, excerpt, cover_url, created_at, updated_at, topic_id, author_id, is_published, scheduled_at, published_at')
      .limit(100);

    if (!isAdmin) {
      query = query.eq('author_id', user.id);
    }

    if (activeTab === 'drafts') {
      query = query.eq('is_published', false).is('scheduled_at', null).order('updated_at', { ascending: false }).order('created_at', { ascending: false });
    } else if (activeTab === 'published') {
      query = query.eq('is_published', true).order('published_at', { ascending: false }).order('created_at', { ascending: false });
    } else {
      query = query.eq('is_published', false).not('scheduled_at', 'is', null).order('scheduled_at', { ascending: true }).order('created_at', { ascending: false });
    }

    const { data, error: queryError } = await query;

    if (queryError) {
      throw new Error(queryError.message);
    }

    setPosts((data ?? []) as AuthorPost[]);
  }, [activeTab, canUseAuthorPanel, isAdmin, user?.id]);

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
  }, [activeTab, canUseAuthorPanel, loadPosts, reloadKey, user?.id]);

  const emptyStateTitle = activeTab === 'drafts' ? 'Нет черновиков' : activeTab === 'published' ? 'Нет опубликованных' : 'Нет запланированных';

  const getMetaLine = useCallback(
    (post: AuthorPost) => {
      if (activeTab === 'published') {
        const date = post.published_at ?? post.created_at;
        return `Опубликовано • ${formatDateTime(date)}`;
      }

      if (activeTab === 'scheduled') {
        if (!post.scheduled_at) {
          return `Запланировано • ${formatDateTime(post.created_at)}`;
        }

        const scheduledDate = new Date(post.scheduled_at);
        const isOverdue = !Number.isNaN(scheduledDate.getTime()) && scheduledDate.getTime() <= Date.now();
        return `${isOverdue ? 'Запланировано (просрочено)' : 'Запланировано'} • ${formatDateTime(post.scheduled_at)}`;
      }

      const updatedAt = post.updated_at ?? post.created_at;
      return `Черновик • изменено ${formatDateTime(updatedAt)}`;
    },
    [activeTab],
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
          {TAB_ITEMS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors',
                activeTab === tab.key ? 'bg-white/10 text-white' : 'bg-white/5 text-white/80 hover:bg-white/10',
              )}
            >
              {tab.label}
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

        {!isLoadingPosts && !error && posts.length === 0 ? (
          <StateCard
            title={emptyStateTitle}
            description="Когда появятся публикации этого типа, они отобразятся здесь."
          />
        ) : null}

        {!isLoadingPosts && !error && posts.length > 0 ? (
          <div className="divide-y divide-white/10">
            {posts.map((post) => (
              <button
                key={`${activeTab}:${post.id}:${post.updated_at}`}
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
                    {getMetaLine(post)}
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
