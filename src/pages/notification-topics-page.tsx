import { Bell, X } from 'lucide-react';
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
        setTopics([]);
        setSubscribedTopicIds([]);
        setLoadError(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError(null);

      try {
        const supabase = getSupabaseClient();
        const subscriptionsTable = (supabase as unknown as { from: (table: string) => TopicSubscriptionsQueryBuilder }).from('topic_subscriptions');
        const [loadedTopics, subscriptionsResult] = await Promise.all([
          fetchTopics(),
          subscriptionsTable.select('topic_id').eq('user_id', user.id),
        ]);

        if (subscriptionsResult.error) {
          throw new Error(subscriptionsResult.error.message);
        }

        if (!cancelled) {
          setTopics(filterToSections(loadedTopics));
          setSubscribedTopicIds((subscriptionsResult.data ?? []).map((item) => item.topic_id));
        }
      } catch (error) {
        if (!cancelled) {
          setTopics([]);
          setSubscribedTopicIds([]);
          setLoadError(error instanceof Error ? error.message : 'Не удалось загрузить подписки на темы.');
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
      } catch {
        toast.error('Не удалось изменить подписку на тему.');
      } finally {
        setBusyTopicId(null);
      }
    },
    [busyTopicId, subscribedSet, user?.id],
  );

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
