import { Check, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container } from '@/components/layout/container';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchMyTopicIds, fetchTopics, setMyTopics } from '@/features/topics/api';
import { filterToSections } from '@/features/topics/sections';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import type { Topic } from '@/types/db';

const chipSkeletonWidths = ['w-28', 'w-36', 'w-32', 'w-40', 'w-24', 'w-44', 'w-28', 'w-36'];

function InlineError({
  actionLabel = 'Повторить',
  message,
  onAction,
}: {
  actionLabel?: string;
  message: string;
  onAction: () => void;
}) {
  return (
    <div className="rounded-[1.5rem] border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p>{message}</p>
        <button type="button" onClick={onAction} className="font-semibold transition hover:opacity-80">
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

function TopicChip({
  onClick,
  selected,
  topic,
}: {
  onClick: () => void;
  selected: boolean;
  topic: Topic;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex max-w-full items-center gap-2 rounded-full border px-4 py-3 text-left text-sm font-semibold transition-all duration-200',
        selected
          ? 'border-transparent bg-indigo-500 text-white shadow-[0_16px_40px_-24px_rgba(99,102,241,0.95)]'
          : 'border-border/80 bg-card/70 text-foreground hover:border-indigo-400/60 hover:bg-card',
      )}
    >
      <span
        className={cn(
          'flex h-5 w-5 items-center justify-center rounded-full border text-[11px]',
          selected ? 'border-white/30 bg-white/18 text-white' : 'border-border/70 bg-background/60 text-muted-foreground',
        )}
      >
        <Check className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 max-w-[15rem] break-words leading-snug line-clamp-2">{topic.name}</span>
    </button>
  );
}

export function TopicPreferencesPage() {
  const navigate = useNavigate();
  const { isAuthed, loading, user } = useAuth();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [retryToken, setRetryToken] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!isAuthed || !user?.id) {
      void navigate('/profile', { replace: true });
      return;
    }

    const controller = new AbortController();
    setBootstrapping(true);
    setLoadError(null);

    void Promise.all([fetchTopics(controller.signal), fetchMyTopicIds(user.id, controller.signal)])
      .then(([loadedTopics, myTopicIds]) => {
        if (controller.signal.aborted) {
          return;
        }

        setTopics(filterToSections(loadedTopics));
        setSelectedIds(myTopicIds);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setLoadError(error instanceof Error ? error.message : 'Не удалось загрузить настройки разделов.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setBootstrapping(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [isAuthed, loading, navigate, retryToken, user?.id]);

  const selectedTopics = useMemo(() => topics.filter((topic) => selectedIds.includes(topic.id)), [selectedIds, topics]);

  const toggleTopic = (topicId: string) => {
    if (saving) {
      return;
    }

    setSaveError(null);
    setSelectedIds((currentIds) => (currentIds.includes(topicId) ? currentIds.filter((id) => id !== topicId) : [...currentIds, topicId]));
  };

  const handleSave = async () => {
    if (selectedIds.length === 0 || saving) {
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      await setMyTopics(selectedIds);
      void navigate('/profile', { replace: true });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Не удалось сохранить настройки разделов.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top,hsl(229_84%_68%_/_0.12),transparent_34%),linear-gradient(180deg,hsl(220_28%_10%),hsl(220_30%_8%))]">
      <Container className="safe-pb safe-pt flex min-h-full max-w-3xl flex-col pb-36 pt-6 sm:pb-40 sm:pt-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary">Аккаунт</p>
            <h1 className="mt-2 text-4xl font-bold sm:text-5xl">Настройки разделов</h1>
          </div>
          <Button type="button" variant="ghost" size="icon" className="rounded-full" onClick={() => navigate('/profile')}>
            <X className="h-5 w-5" />
            <span className="sr-only">Отмена</span>
          </Button>
        </div>

        <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
          Обновите разделы, которые влияют на ваши рекомендации и будущие уведомления.
        </p>

        <div className="mt-6 space-y-4">
          {loadError ? <InlineError message={loadError} onAction={() => setRetryToken((current) => current + 1)} /> : null}

          <div className="flex flex-wrap gap-3">
            {bootstrapping
              ? chipSkeletonWidths.map((widthClass, index) => <Skeleton key={`${widthClass}-${index}`} className={cn('h-12 rounded-full bg-secondary/55', widthClass)} />)
              : topics.map((topic) => <TopicChip key={topic.id} topic={topic} selected={selectedIds.includes(topic.id)} onClick={() => toggleTopic(topic.id)} />)}
          </div>
        </div>

        <div className="mt-8">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Выбрано</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {selectedTopics.length > 0 ? selectedTopics.map((topic) => topic.name).join(', ') : 'Выберите хотя бы один раздел, чтобы сохранить настройки.'}
          </p>
        </div>

        <div className="mt-auto pt-8">
          <div
            className="fixed inset-x-0 bottom-0 z-30 bg-[linear-gradient(180deg,transparent_0%,hsl(220_30%_8%_/_0.82)_26%,hsl(220_30%_8%)_100%)] px-4 pt-8 backdrop-blur-xl"
            style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}
          >
            <div className="mx-auto max-w-3xl rounded-[2rem] border border-border/70 bg-background/88 p-4 shadow-[0_-20px_60px_-42px_rgba(15,23,42,0.9)]">
              <Button className="h-14 w-full text-base" onClick={handleSave} disabled={saving || bootstrapping || Boolean(loadError) || selectedIds.length === 0}>
                {saving ? 'Сохраняем...' : 'Сохранить'}
              </Button>
              {saveError ? <p className="mt-3 text-sm text-destructive">{saveError}</p> : null}
              <button
                type="button"
                onClick={() => navigate('/profile')}
                className="mt-4 w-full text-center text-sm font-semibold text-muted-foreground transition hover:text-foreground"
                disabled={saving}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
