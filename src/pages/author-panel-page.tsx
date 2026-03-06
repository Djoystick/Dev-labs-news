import { ChevronRight, FilePenLine, LoaderCircle, X } from 'lucide-react';
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
  updated_at: string;
  topic_id: string;
  author_id: string | null;
  is_published: boolean;
  published_at: string | null;
  scheduled_at: string | null;
};

type TabKey = 'drafts' | 'published' | 'scheduled';
type QuickAction = 'publish' | 'unschedule' | 'unpublish';
type PostStatus = TabKey;

const TAB_ITEMS: Array<{ key: TabKey; label: string }> = [
  { key: 'drafts', label: 'Черновики' },
  { key: 'published', label: 'Опубликовано' },
  { key: 'scheduled', label: 'Запланировано' },
];

function getPostStatus(post: AuthorPost): PostStatus {
  if (post.is_published) {
    return 'published';
  }

  if (post.scheduled_at) {
    return 'scheduled';
  }

  return 'drafts';
}

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
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastFailedAction, setLastFailedAction] = useState<{ action: QuickAction; postId: string } | null>(null);

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

  const updatePostFields = useCallback(async (postId: string, patch: { is_published?: boolean; scheduled_at?: string | null }) => {
    const supabase = getSupabaseClient();
    const { error: updateError } = await supabase.from('posts').update(patch).eq('id', postId);

    if (updateError) {
      throw new Error(updateError.message);
    }
  }, []);

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
      .order('created_at', { ascending: false })
      .limit(100);

    if (!isAdmin) {
      query = query.eq('author_id', user.id);
    }

    const { data, error: queryError } = await query;

    if (queryError) {
      throw new Error(queryError.message);
    }

    setPosts((data ?? []) as AuthorPost[]);
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
        setActionError(null);
        setLastFailedAction(null);
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

  const runQuickAction = useCallback(
    async (postId: string, action: QuickAction) => {
      if (action === 'unpublish') {
        const confirmed = window.confirm('Снять публикацию? Пост исчезнет из ленты.');
        if (!confirmed) {
          return;
        }
      }

      if (action === 'unschedule') {
        const confirmed = window.confirm('Снять с расписания? Публикация станет черновиком.');
        if (!confirmed) {
          return;
        }
      }

      setActionBusyId(postId);
      setActionError(null);
      setLastFailedAction(null);

      try {
        if (action === 'publish') {
          await updatePostFields(postId, { is_published: true, scheduled_at: null });
        } else if (action === 'unschedule') {
          await updatePostFields(postId, { is_published: false, scheduled_at: null });
        } else {
          await updatePostFields(postId, { is_published: false, scheduled_at: null });
        }

        await loadPosts();
      } catch {
        setActionError('Не удалось применить действие. Попробуйте ещё раз.');
        setLastFailedAction({ action, postId });
      } finally {
        setActionBusyId(null);
      }
    },
    [loadPosts, updatePostFields],
  );

  const emptyStateTitle = activeTab === 'drafts' ? 'Нет черновиков' : activeTab === 'published' ? 'Нет опубликованных' : 'Нет запланированных';
  const stats = useMemo(() => {
    let drafts = 0;
    let published = 0;
    let scheduled = 0;

    posts.forEach((post) => {
      const status = getPostStatus(post);
      if (status === 'published') {
        published += 1;
      } else if (status === 'scheduled') {
        scheduled += 1;
      } else {
        drafts += 1;
      }
    });

    return {
      drafts,
      published,
      scheduled,
      total: posts.length,
    };
  }, [posts]);

  const tabPosts = useMemo(() => {
    const filtered = posts.filter((post) => getPostStatus(post) === activeTab);

    if (activeTab === 'published') {
      return [...filtered].sort((left, right) => {
        const leftPublished = new Date(left.published_at ?? left.created_at).getTime();
        const rightPublished = new Date(right.published_at ?? right.created_at).getTime();
        if (leftPublished !== rightPublished) {
          return rightPublished - leftPublished;
        }

        return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
      });
    }

    if (activeTab === 'scheduled') {
      return [...filtered].sort((left, right) => {
        const leftScheduled = new Date(left.scheduled_at ?? left.created_at).getTime();
        const rightScheduled = new Date(right.scheduled_at ?? right.created_at).getTime();
        if (leftScheduled !== rightScheduled) {
          return leftScheduled - rightScheduled;
        }

        return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
      });
    }

    return [...filtered].sort((left, right) => {
      const leftUpdated = new Date(left.updated_at ?? left.created_at).getTime();
      const rightUpdated = new Date(right.updated_at ?? right.created_at).getTime();
      if (leftUpdated !== rightUpdated) {
        return rightUpdated - leftUpdated;
      }

      return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
    });
  }, [activeTab, posts]);

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
        return `${isOverdue ? 'Ожидает публикации' : 'Запланировано'} • ${formatDateTime(post.scheduled_at)}${isOverdue ? ' • обычно до 5 минут' : ''}`;
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

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/55">Всего</p>
            <p className="mt-1 text-xl font-semibold text-white">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/55">Опубликовано</p>
            <p className="mt-1 text-xl font-semibold text-emerald-200">{stats.published}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/55">Черновики</p>
            <p className="mt-1 text-xl font-semibold text-white">{stats.drafts}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/55">Запланировано</p>
            <p className="mt-1 text-xl font-semibold text-cyan-200">{stats.scheduled}</p>
          </div>
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

        {!isLoadingPosts && !error && actionError ? (
          <div className="border-y border-destructive/35 bg-destructive/10 p-4 text-sm text-destructive">
            <p>{actionError}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={() => {
                if (lastFailedAction) {
                  void runQuickAction(lastFailedAction.postId, lastFailedAction.action);
                  return;
                }

                setReloadKey((value) => value + 1);
              }}
            >
              {'Повторить'}
            </Button>
          </div>
        ) : null}

        {!isLoadingPosts && !error && tabPosts.length === 0 ? (
          <StateCard
            title={emptyStateTitle}
            description="Когда появятся публикации этого типа, они отобразятся здесь."
          />
        ) : null}

        {!isLoadingPosts && !error && tabPosts.length > 0 ? (
          <div className="divide-y divide-white/10">
            {tabPosts.map((post) => (
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
                  {activeTab === 'drafts' ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={actionBusyId === post.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        void runQuickAction(post.id, 'publish');
                      }}
                    >
                      {actionBusyId === post.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                      {'Опубликовать'}
                    </Button>
                  ) : null}
                  {activeTab === 'scheduled' ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={actionBusyId === post.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          void runQuickAction(post.id, 'publish');
                        }}
                      >
                        {actionBusyId === post.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                        {'Опубликовать'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={actionBusyId === post.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          void runQuickAction(post.id, 'unschedule');
                        }}
                      >
                        {actionBusyId === post.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                        {'Снять'}
                      </Button>
                    </>
                  ) : null}
                  {activeTab === 'published' ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={actionBusyId === post.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        void runQuickAction(post.id, 'unpublish');
                      }}
                    >
                      {actionBusyId === post.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                      {'Снять с публикации'}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={actionBusyId === post.id}
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
