import { Check, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FlatPage, FlatSection } from '@/components/layout/flat';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchMyTopicIds, fetchTopics, setMyTopics } from '@/features/topics/api';
import { filterToSections } from '@/features/topics/sections';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import type { Topic } from '@/types/db';

const chipSkeletonWidths = ['w-28', 'w-36', 'w-32', 'w-40', 'w-24', 'w-44', 'w-28', 'w-36'];

function InlineError({ actionLabel = 'Повторить', message, onAction }: { actionLabel?: string; message: string; onAction: () => void }) {
  return (
    <div className="border-y border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p>{message}</p>
        <button type="button" onClick={onAction} className="font-semibold transition hover:opacity-80">
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

function TopicChip({ onClick, selected, topic }: { onClick: () => void; selected: boolean; topic: Topic }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex max-w-full items-center gap-2 border px-4 py-3 text-left text-sm font-semibold transition-all duration-200',
        selected ? 'border-primary bg-primary/10 text-foreground' : 'border-border/80 text-foreground hover:border-primary/60 hover:bg-secondary/20',
      )}
    >
      <span className={cn('flex h-5 w-5 items-center justify-center border text-[11px]', selected ? 'border-primary text-primary' : 'border-border/70 text-muted-foreground')}>
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
    <FlatPage className="safe-pb safe-pt flex min-h-full flex-col pb-36 pt-6 sm:pb-40 sm:pt-8">
      <FlatSection className="pt-0">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary">{'Аккаунт'}</p>
            <h1 className="mt-2 text-4xl font-bold sm:text-5xl">{'Настройки разделов'}</h1>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={() => navigate('/profile')}>
            <X className="h-5 w-5" />
            <span className="sr-only">{'Отмена'}</span>
          </Button>
        </div>

        <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
          {'Эти разделы формируют вкладку «Для тебя» и будущие digest-уведомления. Обычная Лента настраивается отдельно на своём экране.'}
        </p>
      </FlatSection>

      <FlatSection className="space-y-4">
        {loadError ? <InlineError message={loadError} onAction={() => setRetryToken((current) => current + 1)} /> : null}

        <div className="flex flex-wrap gap-3">
          {bootstrapping
            ? chipSkeletonWidths.map((widthClass, index) => <Skeleton key={`${widthClass}-${index}`} className={cn('h-12 bg-secondary/55', widthClass)} />)
            : topics.map((topic) => <TopicChip key={topic.id} topic={topic} selected={selectedIds.includes(topic.id)} onClick={() => toggleTopic(topic.id)} />)}
        </div>
      </FlatSection>

      <FlatSection className="mt-2">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">{'Выбрано'}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {selectedTopics.length > 0 ? selectedTopics.map((topic) => topic.name).join(', ') : 'Выберите хотя бы один раздел, чтобы сохранить настройки.'}
        </p>
      </FlatSection>

      <div className="mt-auto pt-8">
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/95 px-4 pt-4" style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}>
          <div className="w-full px-0 sm:px-2">
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
              {'Отмена'}
            </button>
          </div>
        </div>
      </div>
    </FlatPage>
  );
}
