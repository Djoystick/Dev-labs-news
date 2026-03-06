import { Bell, Send, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { FlatPage } from '@/components/layout/flat';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StateCard } from '@/components/ui/state-card';
import { fetchTopics } from '@/features/topics/api';
import { filterToSections } from '@/features/topics/sections';
import { getSupabaseClient } from '@/lib/supabase';
import { getTelegramUser } from '@/lib/telegram-user';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import type { Topic } from '@/types/db';

type TopicSubscriptionRow = {
  topic_id: string;
};

type TopicSubscriptionsSelectBuilder = {
  eq: (column: string, value: string) => Promise<{ data: TopicSubscriptionRow[] | null; error: { message: string } | null }>;
};

type TopicSubscriptionsDeleteBuilder = {
  eq: (column: string, value: string) => TopicSubscriptionsDeleteBuilder | Promise<{ error: { message: string } | null }>;
};

type TopicSubscriptionsQueryBuilder = {
  select: (columns: string) => TopicSubscriptionsSelectBuilder;
  insert: (payload: { user_id: string; topic_id: string }) => Promise<{ error: { message: string } | null }>;
  delete: () => TopicSubscriptionsDeleteBuilder;
};

type TelegramSettingsRow = {
  telegram_linked_at: string | null;
  telegram_notifications_enabled: boolean;
  telegram_user_id: number | string | null;
};

type InvokeResponse = {
  error?: string;
  message?: string;
  ok?: boolean;
} | null;

function parseTelegramUserId(value: number | string | null | undefined): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string' && /^\d+$/u.test(value.trim())) {
    const parsed = Number(value.trim());
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

function formatLinkedAt(value: string | null) {
  if (!value) {
    return 'Не привязан';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Не привязан';
  }

  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message.trim();
    }
  }

  return fallback;
}

function NotificationTopicsSkeleton() {
  return (
    <div className="divide-y divide-border/60">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex items-center justify-between gap-4 py-4">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="h-7 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function NotificationTopicsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loading, user } = useAuth();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [subscribedTopicIds, setSubscribedTopicIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyTopicId, setBusyTopicId] = useState<string | null>(null);
  const [linkedTelegramUserId, setLinkedTelegramUserId] = useState<number | null>(null);
  const [telegramNotificationsEnabled, setTelegramNotificationsEnabled] = useState(false);
  const [telegramLinkedAt, setTelegramLinkedAt] = useState<string | null>(null);
  const [telegramAction, setTelegramAction] = useState<'link' | 'toggle' | 'test' | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const telegramUser = getTelegramUser();
  const telegramRuntimeUserId = telegramUser?.id ?? null;
  const botUsername = useMemo(() => {
    const rawValue = (import.meta.env as Record<string, string | undefined>).VITE_TELEGRAM_BOT_USERNAME;
    const normalized = rawValue?.trim().replace(/^@/u, '');
    return normalized || null;
  }, []);
  const isTelegramLinked = linkedTelegramUserId !== null;
  const isTelegramActionPending = telegramAction !== null;

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
        setTopics([]);
        setSubscribedTopicIds([]);
        setLinkedTelegramUserId(null);
        setTelegramNotificationsEnabled(false);
        setTelegramLinkedAt(null);
        setLoadError(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError(null);

      try {
        const supabase = getSupabaseClient();
        const subscriptionsTable = (supabase as unknown as { from: (table: string) => TopicSubscriptionsQueryBuilder }).from('topic_subscriptions');
        const [loadedTopics, subscriptionsResult, telegramSettingsResult] = await Promise.all([
          fetchTopics(),
          subscriptionsTable.select('topic_id').eq('user_id', user.id),
          supabase
            .from('profiles')
            .select('telegram_user_id, telegram_notifications_enabled, telegram_linked_at')
            .eq('id', user.id)
            .maybeSingle(),
        ]);

        if (subscriptionsResult.error) {
          throw new Error(subscriptionsResult.error.message);
        }

        if (telegramSettingsResult.error) {
          throw new Error(telegramSettingsResult.error.message);
        }

        if (!cancelled) {
          const settings = telegramSettingsResult.data as TelegramSettingsRow | null;
          setTopics(filterToSections(loadedTopics));
          setSubscribedTopicIds((subscriptionsResult.data ?? []).map((item) => item.topic_id));
          setLinkedTelegramUserId(parseTelegramUserId(settings?.telegram_user_id));
          setTelegramNotificationsEnabled(Boolean(settings?.telegram_notifications_enabled));
          setTelegramLinkedAt(settings?.telegram_linked_at ?? null);
        }
      } catch (error) {
        if (!cancelled) {
          setTopics([]);
          setSubscribedTopicIds([]);
          setLoadError(error instanceof Error ? error.message : 'Не удалось загрузить настройки уведомлений.');
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

  const subscribedSet = useMemo(() => new Set(subscribedTopicIds), [subscribedTopicIds]);

  const toggleTopicSubscription = useCallback(
    async (topicId: string) => {
      if (!user?.id || busyTopicId) {
        return;
      }

      const isSubscribed = subscribedSet.has(topicId);
      setBusyTopicId(topicId);

      try {
        const supabase = getSupabaseClient();
        const subscriptionsTable = (supabase as unknown as { from: (table: string) => TopicSubscriptionsQueryBuilder }).from('topic_subscriptions');

        if (isSubscribed) {
          const deleteBuilder = subscriptionsTable.delete().eq('user_id', user.id);
          const deleteResult = await (deleteBuilder as TopicSubscriptionsDeleteBuilder).eq('topic_id', topicId);
          const deleteError = deleteResult && 'error' in deleteResult ? deleteResult.error : null;

          if (deleteError) {
            throw new Error(deleteError.message);
          }

          setSubscribedTopicIds((current) => current.filter((id) => id !== topicId));
          toast.success('Подписка отключена.');
        } else {
          const { error } = await subscriptionsTable.insert({ user_id: user.id, topic_id: topicId });

          if (error) {
            throw new Error(error.message);
          }

          setSubscribedTopicIds((current) => (current.includes(topicId) ? current : [...current, topicId]));
          toast.success('Подписка включена.');
        }
      } catch (error) {
        toast.error(getErrorMessage(error, 'Не удалось изменить подписку на тему.'));
      } finally {
        setBusyTopicId(null);
      }
    },
    [busyTopicId, subscribedSet, user?.id],
  );

  const linkTelegram = useCallback(async () => {
    if (!user?.id || !telegramRuntimeUserId || isTelegramActionPending) {
      return;
    }

    setTelegramAction('link');

    try {
      const linkedAt = new Date().toISOString();
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('profiles')
        .update({
          telegram_linked_at: linkedAt,
          telegram_user_id: telegramRuntimeUserId,
        })
        .eq('id', user.id);

      if (error) {
        throw new Error(error.message);
      }

      setLinkedTelegramUserId(telegramRuntimeUserId);
      setTelegramLinkedAt(linkedAt);
      toast.success('Telegram успешно привязан.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Не удалось привязать Telegram.'));
    } finally {
      setTelegramAction(null);
    }
  }, [isTelegramActionPending, telegramRuntimeUserId, user?.id]);

  const toggleTelegramNotifications = useCallback(async () => {
    if (!user?.id || !isTelegramLinked || isTelegramActionPending) {
      return;
    }

    const nextValue = !telegramNotificationsEnabled;
    setTelegramAction('toggle');

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('profiles')
        .update({
          telegram_notifications_enabled: nextValue,
        })
        .eq('id', user.id);

      if (error) {
        throw new Error(error.message);
      }

      setTelegramNotificationsEnabled(nextValue);
      toast.success(nextValue ? 'Уведомления в Telegram включены.' : 'Уведомления в Telegram выключены.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Не удалось изменить настройки Telegram.'));
    } finally {
      setTelegramAction(null);
    }
  }, [isTelegramActionPending, isTelegramLinked, telegramNotificationsEnabled, user?.id]);

  const sendTelegramTest = useCallback(async () => {
    if (!user?.id || !isTelegramLinked || !telegramNotificationsEnabled || isTelegramActionPending) {
      return;
    }

    setTelegramAction('test');

    try {
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        toast.error('Нужно войти, чтобы отправить тест уведомлений');
        return;
      }

      const { data, error } = await supabase.functions.invoke('telegram-send-test', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {},
      });

      if (error) {
        toast.error(error.message || 'Не удалось отправить тест');
        return;
      }

      const payload = data as InvokeResponse;
      if (payload?.error) {
        throw new Error(payload.error);
      }

      toast.success(payload?.message || 'Тест отправлен.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Не удалось отправить тест'));
    } finally {
      setTelegramAction(null);
    }
  }, [isTelegramActionPending, isTelegramLinked, telegramNotificationsEnabled, user?.id]);

  const openBot = useCallback(() => {
    if (!botUsername || typeof window === 'undefined') {
      return;
    }

    window.open(`https://t.me/${botUsername}`, '_blank', 'noopener,noreferrer');
  }, [botUsername]);

  const pageDescription = useMemo(() => {
    if (!user) {
      return 'Выберите темы, чтобы получать уведомления по новым публикациям.';
    }

    return subscribedTopicIds.length > 0 ? `Подписок: ${subscribedTopicIds.length}` : 'Пока нет подписок на темы.';
  }, [subscribedTopicIds.length, user]);

  return (
    <FlatPage className="py-6 sm:py-8">
      <div className="space-y-5">
        <div className="border-b border-border/60 pb-4">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-3xl font-extrabold">Уведомления по темам</h1>
            <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Закрыть">
              <X className="h-5 w-5" />
            </Button>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{pageDescription}</p>
        </div>

        <div className="space-y-3 rounded-xl border border-white/10 bg-transparent p-4">
          <h2 className="text-base font-semibold text-white">Telegram уведомления</h2>

          {!user ? <p className="text-sm text-white/70">Войдите, чтобы настроить уведомления в Telegram.</p> : null}

          {user && !telegramRuntimeUserId ? (
            <p className="text-sm text-white/70">Откройте приложение внутри Telegram, чтобы подключить уведомления.</p>
          ) : null}

          {user && telegramRuntimeUserId ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">{isTelegramLinked ? 'Telegram привязан' : 'Telegram не привязан'}</p>
                  <p className="text-xs text-white/60">ID в Telegram: {telegramRuntimeUserId}</p>
                  <p className="text-xs text-white/50">Привязка: {formatLinkedAt(telegramLinkedAt)}</p>
                </div>
                <Button type="button" size="sm" variant="outline" disabled={isTelegramActionPending} onClick={() => void linkTelegram()}>
                  {telegramAction === 'link' ? 'Сохраняем...' : 'Привязать Telegram'}
                </Button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">Уведомления в Telegram</p>
                  <p className="text-xs text-white/60">{telegramNotificationsEnabled ? 'Включены' : 'Выключены'}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={telegramNotificationsEnabled ? 'default' : 'outline'}
                  disabled={!isTelegramLinked || isTelegramActionPending}
                  onClick={() => void toggleTelegramNotifications()}
                >
                  {telegramAction === 'toggle' ? 'Сохраняем...' : telegramNotificationsEnabled ? 'Выключить' : 'Включить'}
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={!user || !isTelegramLinked || !telegramNotificationsEnabled || isTelegramActionPending}
                  onClick={() => void sendTelegramTest()}
                >
                  <Send className="mr-1 h-4 w-4" />
                  {telegramAction === 'test' ? 'Отправляем...' : 'Отправить тест'}
                </Button>
                {botUsername ? (
                  <Button type="button" size="sm" variant="outline" onClick={openBot}>
                    {'Открыть бота'}
                  </Button>
                ) : (
                  <p className="text-xs text-white/60">Откройте бота и нажмите Start, чтобы получать сообщения.</p>
                )}
              </div>
            </>
          ) : null}
        </div>

        {loading ? <NotificationTopicsSkeleton /> : null}

        {!loading && !user ? <StateCard title="Войдите, чтобы настроить уведомления" description="Подписки доступны только авторизованным пользователям." /> : null}

        {!loading && user && isLoading ? <NotificationTopicsSkeleton /> : null}

        {!loading && user && !isLoading && loadError ? (
          <div className="border-y border-destructive/35 bg-destructive/10 p-4 text-sm text-destructive">
            <p>{loadError}</p>
            <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => setReloadKey((value) => value + 1)}>
              {'Повторить'}
            </Button>
          </div>
        ) : null}

        {!loading && user && !isLoading && !loadError && topics.length === 0 ? (
          <StateCard title="Темы не найдены" description="Пока нет тем для подписки." />
        ) : null}

        {!loading && user && !isLoading && !loadError && topics.length > 0 ? (
          <div className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-transparent">
            {topics.map((topic) => {
              const isSubscribed = subscribedSet.has(topic.id);
              const isBusy = busyTopicId === topic.id;

              return (
                <button
                  key={topic.id}
                  type="button"
                  disabled={Boolean(busyTopicId)}
                  onClick={() => {
                    void toggleTopicSubscription(topic.id);
                  }}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5 active:bg-white/10 disabled:opacity-70"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{topic.name}</p>
                    <p className="mt-0.5 text-xs text-white/60">{isSubscribed ? 'Подписан(а)' : 'Не подписан(а)'}</p>
                  </div>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs',
                      isSubscribed ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200' : 'border-white/15 bg-white/5 text-white/65',
                    )}
                  >
                    {isBusy ? <Bell className="h-3.5 w-3.5 animate-pulse" /> : <Bell className="h-3.5 w-3.5" />}
                    {isSubscribed ? 'Вкл' : 'Выкл'}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </FlatPage>
  );
}
