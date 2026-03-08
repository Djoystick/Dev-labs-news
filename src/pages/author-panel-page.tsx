import { FilePenLine, LoaderCircle, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { FlatPage } from '@/components/layout/flat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
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
  topic?: {
    id: string;
    name: string;
  } | null;
  views_count?: number | null;
  reads_count?: number | null;
  read_count?: number | null;
  views?: number | null;
  likes_count?: number | null;
  likes?: number | null;
  dislikes_count?: number | null;
  dislikes?: number | null;
};

type TabKey = 'drafts' | 'published' | 'scheduled';
type QuickAction = 'publish' | 'unschedule' | 'unpublish';
type PostStatus = TabKey;
type SortMode = 'newest' | 'oldest' | 'scheduled';
type TopicFilterOption = { id: string; label: string };

const AUTHOR_SORT_STORAGE_KEY = 'devlabs.author.sort.v1';
const AUTHOR_TOPIC_STORAGE_KEY = 'devlabs.author.topic.v1';
const ALL_TOPICS_VALUE = '__all__';

const TAB_ITEMS: Array<{ key: TabKey; label: string }> = [
  { key: 'drafts', label: 'Черновики' },
  { key: 'published', label: 'Опубликовано' },
  { key: 'scheduled', label: 'Запланировано' },
];

const SORT_ITEMS: Array<{ key: SortMode; label: string }> = [
  { key: 'newest', label: 'Новые сначала' },
  { key: 'oldest', label: 'Старые сначала' },
  { key: 'scheduled', label: 'По расписанию' },
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

function getDateWeight(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function getPostFreshnessWeight(post: AuthorPost) {
  return getDateWeight(post.updated_at ?? post.created_at);
}

function getStoredSortMode(): SortMode {
  if (typeof window === 'undefined') {
    return 'newest';
  }

  const raw = window.sessionStorage.getItem(AUTHOR_SORT_STORAGE_KEY);
  if (raw === 'newest' || raw === 'oldest' || raw === 'scheduled') {
    return raw;
  }

  return 'newest';
}

function getStoredTopicFilter(): string {
  if (typeof window === 'undefined') {
    return ALL_TOPICS_VALUE;
  }

  const raw = window.sessionStorage.getItem(AUTHOR_TOPIC_STORAGE_KEY);
  return raw && raw.length > 0 ? raw : ALL_TOPICS_VALUE;
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

function toDatetimeLocal(value: string | null | undefined) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const pad = (input: number) => input.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getDefaultScheduleLocal() {
  const date = new Date(Date.now() + 30 * 60 * 1000);
  date.setSeconds(0, 0);
  return toDatetimeLocal(date.toISOString());
}

function getScheduleValidationError(value: string) {
  if (!value.trim()) {
    return 'Укажите дату и время публикации.';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Введите корректную дату и время.';
  }

  if (date.getTime() <= Date.now()) {
    return 'Дата публикации должна быть позже текущего времени.';
  }

  return null;
}

function resolveMetricValue(post: AuthorPost, keys: string[]) {
  const source = post as Record<string, unknown>;

  for (const key of keys) {
    if (!(key in source)) {
      continue;
    }

    const raw = source[key];
    if (raw === null || raw === undefined || raw === '') {
      continue;
    }

    const value = Number(raw);
    if (Number.isFinite(value)) {
      return Math.max(0, Math.trunc(value));
    }
  }

  return null;
}

function getPostStats(post: AuthorPost) {
  const views = resolveMetricValue(post, ['views_count', 'reads_count', 'read_count', 'views']);
  const likes = resolveMetricValue(post, ['likes_count', 'likes']);
  const dislikes = resolveMetricValue(post, ['dislikes_count', 'dislikes']);

  return {
    dislikes,
    hasAny: views !== null || likes !== null || dislikes !== null,
    likes,
    views,
  };
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
  const [sortMode, setSortMode] = useState<SortMode>(() => getStoredSortMode());
  const [topicFilter, setTopicFilter] = useState<string>(() => getStoredTopicFilter());
  const [posts, setPosts] = useState<AuthorPost[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastFailedAction, setLastFailedAction] = useState<{ action: QuickAction; postId: string } | null>(null);
  const [editingSchedulePostId, setEditingSchedulePostId] = useState<string | null>(null);
  const [editingScheduleValue, setEditingScheduleValue] = useState('');
  const [scheduleEditorError, setScheduleEditorError] = useState<string | null>(null);
  const [scheduleSavingId, setScheduleSavingId] = useState<string | null>(null);

  const isAdmin = profile?.role === 'admin';
  const canUseAuthorPanel = profile?.role === 'admin' || profile?.role === 'editor';
  const topicOptions = useMemo<TopicFilterOption[]>(() => {
    const topicMap = new Map<string, string>();

    posts.forEach((post) => {
      const topicId = post.topic_id?.trim();
      if (!topicId) {
        return;
      }

      const topicName = post.topic?.name?.trim();
      if (topicName) {
        topicMap.set(topicId, topicName);
        return;
      }

      if (!topicMap.has(topicId)) {
        topicMap.set(topicId, 'Без названия раздела');
      }
    });

    return [...topicMap.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((left, right) => left.label.localeCompare(right.label, 'ru'));
  }, [posts]);
  const canFilterByTopic = topicOptions.length > 0;
  const restoreScrollY = useMemo(() => {
    const state = location.state as { restoreScrollY?: unknown } | null;
    if (!state || typeof state.restoreScrollY !== 'number' || !Number.isFinite(state.restoreScrollY)) {
      return null;
    }

    return Math.max(0, state.restoreScrollY);
  }, [location.state]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.sessionStorage.setItem(AUTHOR_SORT_STORAGE_KEY, sortMode);
  }, [sortMode]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.sessionStorage.setItem(AUTHOR_TOPIC_STORAGE_KEY, topicFilter);
  }, [topicFilter]);

  useEffect(() => {
    if (!canFilterByTopic && topicFilter !== ALL_TOPICS_VALUE) {
      setTopicFilter(ALL_TOPICS_VALUE);
      return;
    }

    if (canFilterByTopic && topicFilter !== ALL_TOPICS_VALUE && !topicOptions.some((topic) => topic.id === topicFilter)) {
      setTopicFilter(ALL_TOPICS_VALUE);
    }
  }, [canFilterByTopic, topicFilter, topicOptions]);

  useEffect(() => {
    setEditingSchedulePostId(null);
    setEditingScheduleValue('');
    setScheduleEditorError(null);
  }, [activeTab]);

  const onClose = useCallback(() => {
    navigate('/profile', { replace: true });
  }, [navigate]);

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
      .select('id, title, excerpt, cover_url, created_at, updated_at, topic_id, author_id, is_published, scheduled_at, published_at, topic:topics(id, name)')
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

  useEffect(() => {
    if (restoreScrollY === null || loading || isLoadingPosts) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      const container = getAppScrollContainer();
      if (container) {
        container.scrollTo({ top: restoreScrollY, behavior: 'auto' });
      } else {
        window.scrollTo({ top: restoreScrollY, behavior: 'auto' });
      }

      navigate('.', { replace: true, state: null });
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [isLoadingPosts, loading, navigate, restoreScrollY]);

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

  const openScheduleEditor = useCallback((post: AuthorPost) => {
    const nextValue = toDatetimeLocal(post.scheduled_at) || getDefaultScheduleLocal();
    setEditingSchedulePostId(post.id);
    setEditingScheduleValue(nextValue);
    setScheduleEditorError(null);
    setActionError(null);
  }, []);

  const closeScheduleEditor = useCallback(() => {
    setEditingSchedulePostId(null);
    setEditingScheduleValue('');
    setScheduleEditorError(null);
  }, []);

  const saveSchedule = useCallback(
    async (post: AuthorPost) => {
      const validationError = getScheduleValidationError(editingScheduleValue);
      if (validationError) {
        setScheduleEditorError(validationError);
        toast.error(validationError);
        return;
      }

      const iso = new Date(editingScheduleValue).toISOString();
      setScheduleSavingId(post.id);
      setActionError(null);

      try {
        await updatePostFields(post.id, {
          is_published: false,
          scheduled_at: iso,
        });

        await loadPosts();
        closeScheduleEditor();
        toast.success(activeTab === 'drafts' ? 'Публикация запланирована.' : 'Время публикации обновлено.');
      } catch {
        setActionError('Не удалось сохранить дату публикации. Попробуйте ещё раз.');
        toast.error('Не удалось сохранить дату публикации.');
      } finally {
        setScheduleSavingId(null);
      }
    },
    [activeTab, closeScheduleEditor, editingScheduleValue, loadPosts, updatePostFields],
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
    const byTab = posts.filter((post) => getPostStatus(post) === activeTab);
    const byTopic =
      canFilterByTopic && topicFilter !== ALL_TOPICS_VALUE ? byTab.filter((post) => post.topic_id === topicFilter) : byTab;
    const withIndex = byTopic.map((post, index) => ({ index, post }));

    withIndex.sort((left, right) => {
      if (sortMode === 'scheduled') {
        const leftHasScheduled = Boolean(left.post.scheduled_at);
        const rightHasScheduled = Boolean(right.post.scheduled_at);

        if (leftHasScheduled !== rightHasScheduled) {
          return leftHasScheduled ? -1 : 1;
        }

        if (leftHasScheduled && rightHasScheduled) {
          const leftScheduled = getDateWeight(left.post.scheduled_at);
          const rightScheduled = getDateWeight(right.post.scheduled_at);

          if (leftScheduled !== rightScheduled) {
            return leftScheduled - rightScheduled;
          }
        }
      } else {
        const leftFreshness = getPostFreshnessWeight(left.post);
        const rightFreshness = getPostFreshnessWeight(right.post);

        if (leftFreshness !== rightFreshness) {
          return sortMode === 'oldest' ? leftFreshness - rightFreshness : rightFreshness - leftFreshness;
        }
      }

      return left.index - right.index;
    });

    return withIndex.map((item) => item.post);
  }, [activeTab, canFilterByTopic, posts, sortMode, topicFilter]);

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

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => navigate('/admin/new', { state: { returnTo: '/author', returnScrollY: getCurrentScrollY() } })}>
            {'Новый материал'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/admin/import', { state: { returnTo: '/author', returnScrollY: getCurrentScrollY() } })}>
            {'Импортировать в черновик'}
          </Button>
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

        <div className="flex flex-wrap items-center gap-2">
          {SORT_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setSortMode(item.key)}
              className={cn(
                'inline-flex items-center rounded-full px-3 py-1.5 text-xs transition-colors',
                sortMode === item.key ? 'bg-white/10 text-white' : 'bg-white/5 text-white/75 hover:bg-white/10',
              )}
            >
              {item.label}
            </button>
          ))}

          {canFilterByTopic ? (
            <label className="ml-auto inline-flex items-center gap-2 text-xs text-white/60">
              <span className="whitespace-nowrap">Тема</span>
              <Select
                value={topicFilter}
                onChange={(event) => setTopicFilter(event.target.value)}
                className="author-topic-filter-select h-8 min-w-[12rem] rounded-full border-white/10 bg-white/5 px-3 text-xs text-white hover:bg-white/10"
              >
                <option value={ALL_TOPICS_VALUE}>Все темы</option>
                {topicOptions.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.label}
                  </option>
                ))}
              </Select>
            </label>
          ) : null}
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
          <div className="space-y-3">
            {tabPosts.map((post) => {
              const isRowBusy = actionBusyId === post.id || scheduleSavingId === post.id;
              const isScheduleEditorOpen = editingSchedulePostId === post.id;
              const postStats = getPostStats(post);

              return (
              <div key={`${activeTab}:${post.id}:${post.updated_at}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-secondary sm:h-24 sm:w-24">
                  {post.cover_url ? <img src={post.cover_url} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
                </div>
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openEditor(post.id)}>
                  <h2 className="line-clamp-2 text-lg font-bold leading-tight">{post.title}</h2>
                  {post.excerpt ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{post.excerpt}</p> : null}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {getMetaLine(post)}
                  </p>
                  {postStats.hasAny ? (
                    <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-white/50">
                      {postStats.views !== null ? <span>{`Views: ${postStats.views}`}</span> : null}
                      {postStats.likes !== null ? <span>{`Likes: ${postStats.likes}`}</span> : null}
                      {postStats.dislikes !== null ? <span>{`Dislikes: ${postStats.dislikes}`}</span> : null}
                    </p>
                  ) : null}
                </button>
                <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:self-start">
                  {activeTab === 'drafts' ? (
                    <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={isRowBusy}
                      onClick={() => {
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
                      disabled={isRowBusy}
                      onClick={() => {
                        openScheduleEditor(post);
                      }}
                    >
                      {'Запланировать...'}
                    </Button>
                    </div>
                  ) : null}
                  {activeTab === 'scheduled' ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={isRowBusy}
                        onClick={() => {
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
                        disabled={isRowBusy}
                        onClick={() => {
                          void runQuickAction(post.id, 'unschedule');
                        }}
                      >
                        {actionBusyId === post.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                        {'Снять'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={isRowBusy}
                        onClick={() => {
                          openScheduleEditor(post);
                        }}
                      >
                        {'Изменить время...'}
                      </Button>
                    </>
                  ) : null}
                  {activeTab === 'published' ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={isRowBusy}
                      onClick={() => {
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
                    disabled={isRowBusy}
                    onClick={() => {
                      openEditor(post.id);
                    }}
                  >
                    <FilePenLine className="h-4 w-4" />
                    {'Редактировать'}
                  </Button>
                </div>
              </div>
              {isScheduleEditorOpen ? (
                <div className="pt-3">
                  <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
                    <label className="block text-xs text-white/70">Дата и время публикации</label>
                    <Input
                      type="datetime-local"
                      value={editingScheduleValue}
                      onChange={(event) => {
                        setEditingScheduleValue(event.target.value);
                        setScheduleEditorError(null);
                      }}
                    />
                    {scheduleEditorError ? <p className="text-xs text-destructive">{scheduleEditorError}</p> : null}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={scheduleSavingId === post.id}
                        onClick={() => {
                          void saveSchedule(post);
                        }}
                      >
                        {scheduleSavingId === post.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                        {'Сохранить'}
                      </Button>
                      <Button type="button" size="sm" variant="ghost" disabled={scheduleSavingId === post.id} onClick={closeScheduleEditor}>
                        {'Отмена'}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
              </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </FlatPage>
  );
}

