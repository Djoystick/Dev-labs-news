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
    return 'РќРµ РїСЂРёРІСЏР·Р°РЅ';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'РќРµ РїСЂРёРІСЏР·Р°РЅ';
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
          setLoadError(error instanceof Error ? error.message : 'РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РЅР°СЃС‚СЂРѕР№РєРё СѓРІРµРґРѕРјР»РµРЅРёР№.');
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
          toast.success('РџРѕРґРїРёСЃРєР° РѕС‚РєР»СЋС‡РµРЅР°.');
        } else {
          const { error } = await subscriptionsTable.insert({ user_id: user.id, topic_id: topicId });

          if (error) {
            throw new Error(error.message);
          }

          setSubscribedTopicIds((current) => (current.includes(topicId) ? current : [...current, topicId]));
          toast.success('РџРѕРґРїРёСЃРєР° РІРєР»СЋС‡РµРЅР°.');
        }
      } catch (error) {
        toast.error(getErrorMessage(error, 'РќРµ СѓРґР°Р»РѕСЃСЊ РёР·РјРµРЅРёС‚СЊ РїРѕРґРїРёСЃРєСѓ РЅР° С‚РµРјСѓ.'));
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
      toast.success('Telegram СѓСЃРїРµС€РЅРѕ РїСЂРёРІСЏР·Р°РЅ.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'РќРµ СѓРґР°Р»РѕСЃСЊ РїСЂРёРІСЏР·Р°С‚СЊ Telegram.'));
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
      toast.success(nextValue ? 'РЈРІРµРґРѕРјР»РµРЅРёСЏ РІ Telegram РІРєР»СЋС‡РµРЅС‹.' : 'РЈРІРµРґРѕРјР»РµРЅРёСЏ РІ Telegram РІС‹РєР»СЋС‡РµРЅС‹.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'РќРµ СѓРґР°Р»РѕСЃСЊ РёР·РјРµРЅРёС‚СЊ РЅР°СЃС‚СЂРѕР№РєРё Telegram.'));
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
      return 'Р’С‹Р±РµСЂРёС‚Рµ С‚РµРјС‹, С‡С‚РѕР±С‹ РїРѕР»СѓС‡Р°С‚СЊ СѓРІРµРґРѕРјР»РµРЅРёСЏ РїРѕ РЅРѕРІС‹Рј РїСѓР±Р»РёРєР°С†РёСЏРј.';
    }

    return subscribedTopicIds.length > 0 ? `РџРѕРґРїРёСЃРѕРє: ${subscribedTopicIds.length}` : 'РџРѕРєР° РЅРµС‚ РїРѕРґРїРёСЃРѕРє РЅР° С‚РµРјС‹.';
  }, [subscribedTopicIds.length, user]);

  return (
    <FlatPage className="py-6 sm:py-8">
      <div className="space-y-5">
        <div className="border-b border-border/60 pb-4">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-3xl font-extrabold">РЈРІРµРґРѕРјР»РµРЅРёСЏ РїРѕ С‚РµРјР°Рј</h1>
            <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Р—Р°РєСЂС‹С‚СЊ">
              <X className="h-5 w-5" />
            </Button>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{pageDescription}</p>
        </div>

        <div className="space-y-3 rounded-xl border border-white/10 bg-transparent p-4">
          <h2 className="text-base font-semibold text-white">Telegram СѓРІРµРґРѕРјР»РµРЅРёСЏ</h2>

          {!user ? <p className="text-sm text-white/70">Р’РѕР№РґРёС‚Рµ, С‡С‚РѕР±С‹ РЅР°СЃС‚СЂРѕРёС‚СЊ СѓРІРµРґРѕРјР»РµРЅРёСЏ РІ Telegram.</p> : null}

          {user && !telegramRuntimeUserId ? (
            <p className="text-sm text-white/70">РћС‚РєСЂРѕР№С‚Рµ РїСЂРёР»РѕР¶РµРЅРёРµ РІРЅСѓС‚СЂРё Telegram, С‡С‚РѕР±С‹ РїРѕРґРєР»СЋС‡РёС‚СЊ СѓРІРµРґРѕРјР»РµРЅРёСЏ.</p>
          ) : null}

          {user && telegramRuntimeUserId ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">{isTelegramLinked ? 'Telegram РїСЂРёРІСЏР·Р°РЅ' : 'Telegram РЅРµ РїСЂРёРІСЏР·Р°РЅ'}</p>
                  <p className="text-xs text-white/60">ID РІ Telegram: {telegramRuntimeUserId}</p>
                  <p className="text-xs text-white/50">РџСЂРёРІСЏР·РєР°: {formatLinkedAt(telegramLinkedAt)}</p>
                </div>
                <Button type="button" size="sm" variant="outline" disabled={isTelegramActionPending} onClick={() => void linkTelegram()}>
                  {telegramAction === 'link' ? 'РЎРѕС…СЂР°РЅСЏРµРј...' : 'РџСЂРёРІСЏР·Р°С‚СЊ Telegram'}
                </Button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">РЈРІРµРґРѕРјР»РµРЅРёСЏ РІ Telegram</p>
                  <p className="text-xs text-white/60">{telegramNotificationsEnabled ? 'Р’РєР»СЋС‡РµРЅС‹' : 'Р’С‹РєР»СЋС‡РµРЅС‹'}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={telegramNotificationsEnabled ? 'default' : 'outline'}
                  disabled={!isTelegramLinked || isTelegramActionPending}
                  onClick={() => void toggleTelegramNotifications()}
                >
                  {telegramAction === 'toggle' ? 'РЎРѕС…СЂР°РЅСЏРµРј...' : telegramNotificationsEnabled ? 'Р’С‹РєР»СЋС‡РёС‚СЊ' : 'Р’РєР»СЋС‡РёС‚СЊ'}
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
                  {telegramAction === 'test' ? 'РћС‚РїСЂР°РІР»СЏРµРј...' : 'РћС‚РїСЂР°РІРёС‚СЊ С‚РµСЃС‚'}
                </Button>
                {botUsername ? (
                  <Button type="button" size="sm" variant="outline" onClick={openBot}>
                    {'РћС‚РєСЂС‹С‚СЊ Р±РѕС‚Р°'}
                  </Button>
                ) : (
                  <p className="text-xs text-white/60">РћС‚РєСЂРѕР№С‚Рµ Р±РѕС‚Р° Рё РЅР°Р¶РјРёС‚Рµ Start, С‡С‚РѕР±С‹ РїРѕР»СѓС‡Р°С‚СЊ СЃРѕРѕР±С‰РµРЅРёСЏ.</p>
                )}
              </div>
            </>
          ) : null}
        </div>

        {loading ? <NotificationTopicsSkeleton /> : null}

        {!loading && !user ? <StateCard title="Р’РѕР№РґРёС‚Рµ, С‡С‚РѕР±С‹ РЅР°СЃС‚СЂРѕРёС‚СЊ СѓРІРµРґРѕРјР»РµРЅРёСЏ" description="РџРѕРґРїРёСЃРєРё РґРѕСЃС‚СѓРїРЅС‹ С‚РѕР»СЊРєРѕ Р°РІС‚РѕСЂРёР·РѕРІР°РЅРЅС‹Рј РїРѕР»СЊР·РѕРІР°С‚РµР»СЏРј." /> : null}

        {!loading && user && isLoading ? <NotificationTopicsSkeleton /> : null}

        {!loading && user && !isLoading && loadError ? (
          <div className="border-y border-destructive/35 bg-destructive/10 p-4 text-sm text-destructive">
            <p>{loadError}</p>
            <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => setReloadKey((value) => value + 1)}>
              {'РџРѕРІС‚РѕСЂРёС‚СЊ'}
            </Button>
          </div>
        ) : null}

        {!loading && user && !isLoading && !loadError && topics.length === 0 ? (
          <StateCard title="РўРµРјС‹ РЅРµ РЅР°Р№РґРµРЅС‹" description="РџРѕРєР° РЅРµС‚ С‚РµРј РґР»СЏ РїРѕРґРїРёСЃРєРё." />
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
                    <p className="mt-0.5 text-xs text-white/60">{isSubscribed ? 'РџРѕРґРїРёСЃР°РЅ(Р°)' : 'РќРµ РїРѕРґРїРёСЃР°РЅ(Р°)'}</p>
                  </div>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs',
                      isSubscribed ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200' : 'border-white/15 bg-white/5 text-white/65',
                    )}
                  >
                    {isBusy ? <Bell className="h-3.5 w-3.5 animate-pulse" /> : <Bell className="h-3.5 w-3.5" />}
                    {isSubscribed ? 'Р’РєР»' : 'Р’С‹РєР»'}
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



