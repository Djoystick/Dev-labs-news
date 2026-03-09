import { ArrowLeft, History, LoaderCircle, Play, Plus, RefreshCw, Rss, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AdminGuard } from '@/components/auth/admin-guard';
import { Container } from '@/components/layout/container';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  createContentSource,
  deleteContentSource,
  listContentSources,
  runContentSourceImport,
  updateContentSource,
  type SourceImportRunResult,
} from '@/features/sources/api';
import { listTopics } from '@/features/topics/api';
import { cn } from '@/lib/utils';
import type { ContentSource, Topic } from '@/types/db';

type ActionState = Record<string, boolean>;

function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'message' in error) {
    const raw = (error as { message?: unknown }).message;
    if (typeof raw === 'string' && raw.trim().length > 0) {
      return raw.trim();
    }
  }

  return fallback;
}

export function AdminSourcesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sources, setSources] = useState<ContentSource[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [defaultTopicId, setDefaultTopicId] = useState('');
  const [enabledByDefault, setEnabledByDefault] = useState(true);
  const [actionsBusy, setActionsBusy] = useState<ActionState>({});
  const [runResultsBySourceId, setRunResultsBySourceId] = useState<Record<string, SourceImportRunResult>>({});
  const returnTo = typeof (location.state as { returnTo?: unknown } | null)?.returnTo === 'string'
    ? (location.state as { returnTo: string }).returnTo
    : null;

  const topicById = useMemo(() => {
    return new Map(topics.map((topic) => [topic.id, topic]));
  }, [topics]);

  const setSourceActionBusy = (sourceId: string, busy: boolean) => {
    setActionsBusy((prev) => {
      if (!busy) {
        const next = { ...prev };
        delete next[sourceId];
        return next;
      }

      return {
        ...prev,
        [sourceId]: true,
      };
    });
  };

  const loadSources = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [nextSources, nextTopics] = await Promise.all([
        listContentSources(),
        listTopics().catch(() => [] as Topic[]),
      ]);

      setSources(nextSources);
      setTopics(nextTopics);
    } catch (loadError) {
      setSources([]);
      setError(getErrorMessage(loadError, 'Не удалось загрузить источники.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadSources();
  }, []);

  const handleBack = () => {
    if (returnTo && returnTo !== location.pathname) {
      navigate(returnTo, { replace: true });
      return;
    }

    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate('/profile', { replace: true });
  };

  const handleCreate = async () => {
    const normalizedTitle = title.trim();
    const normalizedUrl = url.trim();
    if (!normalizedTitle || !normalizedUrl) {
      toast.error('Укажите название и RSS URL.');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const created = await createContentSource({
        default_topic_id: defaultTopicId || null,
        is_enabled: enabledByDefault,
        title: normalizedTitle,
        url: normalizedUrl,
      });

      setSources((prev) => [created, ...prev]);
      setTitle('');
      setUrl('');
      setDefaultTopicId('');
      setEnabledByDefault(true);
      toast.success('Источник добавлен.');
    } catch (createError) {
      const message = getErrorMessage(createError, 'Не удалось добавить источник.');
      setError(message);
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleEnabled = async (source: ContentSource) => {
    setSourceActionBusy(source.id, true);
    setError(null);

    try {
      const updated = await updateContentSource(source.id, { is_enabled: !source.is_enabled });
      setSources((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      toast.success(updated.is_enabled ? 'Источник включён.' : 'Источник отключён.');
    } catch (toggleError) {
      const message = getErrorMessage(toggleError, 'Не удалось обновить источник.');
      setError(message);
      toast.error(message);
    } finally {
      setSourceActionBusy(source.id, false);
    }
  };

  const handleDelete = async (source: ContentSource) => {
    const confirmed = window.confirm(`Удалить источник "${source.title}"?`);
    if (!confirmed) {
      return;
    }

    setSourceActionBusy(source.id, true);
    setError(null);

    try {
      await deleteContentSource(source.id);
      setSources((prev) => prev.filter((item) => item.id !== source.id));
      setRunResultsBySourceId((prev) => {
        const next = { ...prev };
        delete next[source.id];
        return next;
      });
      toast.success('Источник удалён.');
    } catch (deleteError) {
      const message = getErrorMessage(deleteError, 'Не удалось удалить источник.');
      setError(message);
      toast.error(message);
    } finally {
      setSourceActionBusy(source.id, false);
    }
  };

  const handleRunImport = async (source: ContentSource) => {
    setSourceActionBusy(source.id, true);
    setError(null);

    try {
      const result = await runContentSourceImport(source.id);
      setRunResultsBySourceId((prev) => ({
        ...prev,
        [source.id]: result,
      }));

      if (result.ok) {
        toast.success(
          `Готово: импортировано ${result.summary.importedItems}, дубликатов ${result.summary.duplicateItems}, ошибок ${result.summary.errorItems}.`,
        );
      } else {
        toast.error(result.message);
      }
    } catch (runError) {
      const message = getErrorMessage(runError, 'Не удалось запустить импорт.');
      setRunResultsBySourceId((prev) => ({
        ...prev,
        [source.id]: {
          message,
          ok: false,
        },
      }));
      setError(message);
      toast.error(message);
    } finally {
      setSourceActionBusy(source.id, false);
    }
  };

  return (
    <AdminGuard>
      <Container className="safe-pb py-6 sm:py-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="flex items-center gap-3">
            <Button type="button" variant="ghost" size="icon" className="rounded-full" onClick={handleBack}>
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Назад</span>
            </Button>
            <div>
              <h1 className="text-3xl font-extrabold">Источники</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                RSS реестр и ручной запуск импорта в draft через текущий AI pipeline.
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/admin/import-runs', { state: { returnTo: '/admin/sources' } })}
            >
              <History className="h-4 w-4" />
              Import history
            </Button>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card/70 p-4 sm:p-5">
            <div className="grid gap-3 md:grid-cols-[1fr_1.4fr_1fr_auto]">
              <div className="space-y-1.5">
                <Label htmlFor="source-title">Название</Label>
                <Input
                  id="source-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Например, Хабр: Backend"
                  disabled={isCreating}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="source-url">RSS URL</Label>
                <Input
                  id="source-url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://example.com/rss.xml"
                  disabled={isCreating}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="source-topic">Тема по умолчанию</Label>
                <Select
                  id="source-topic"
                  value={defaultTopicId}
                  onChange={(event) => setDefaultTopicId(event.target.value)}
                  disabled={isCreating}
                >
                  <option value="">Без темы по умолчанию</option>
                  {topics.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {topic.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex items-end gap-3">
                <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-cyan-500"
                    checked={enabledByDefault}
                    onChange={(event) => setEnabledByDefault(event.target.checked)}
                    disabled={isCreating}
                  />
                  Включён
                </label>
                <Button type="button" disabled={isCreating} onClick={() => void handleCreate()}>
                  {isCreating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Добавить
                </Button>
              </div>
            </div>
          </div>

          {error ? (
            <div className="rounded-xl border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Реестр источников</h2>
              <Button type="button" variant="outline" onClick={() => void loadSources()} disabled={isLoading}>
                {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Обновить
              </Button>
            </div>

            {isLoading ? (
              <div className="rounded-2xl border border-border/70 bg-card/70 px-4 py-8 text-sm text-muted-foreground">
                Загружаем источники...
              </div>
            ) : sources.length === 0 ? (
              <div className="rounded-2xl border border-border/70 bg-card/70 px-4 py-8 text-sm text-muted-foreground">
                Источники пока не добавлены.
              </div>
            ) : (
              <div className="space-y-3">
                {sources.map((source) => {
                  const isBusy = Boolean(actionsBusy[source.id]);
                  const runResult = runResultsBySourceId[source.id];
                  const defaultTopic = source.default_topic_id ? topicById.get(source.default_topic_id) : null;

                  return (
                    <div key={source.id} className="rounded-2xl border border-border/70 bg-card/70 p-4 sm:p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full border border-border/70 px-2 py-0.5 text-xs text-muted-foreground">
                              <Rss className="h-3.5 w-3.5" />
                              {source.type.toUpperCase()}
                            </span>
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-xs',
                                source.is_enabled ? 'bg-emerald-500/15 text-emerald-200' : 'bg-white/10 text-white/65',
                              )}
                            >
                              {source.is_enabled ? 'Включён' : 'Отключён'}
                            </span>
                            {defaultTopic ? (
                              <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-xs text-cyan-200">
                                {`Тема: ${defaultTopic.name}`}
                              </span>
                            ) : null}
                          </div>
                          <h3 className="text-lg font-semibold leading-tight">{source.title}</h3>
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block truncate text-sm text-cyan-200/90 hover:text-cyan-100"
                            title={source.url}
                          >
                            {source.url}
                          </a>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button type="button" size="sm" onClick={() => void handleRunImport(source)} disabled={isBusy}>
                            {isBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                            Запустить импорт
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => void handleToggleEnabled(source)} disabled={isBusy}>
                            {source.is_enabled ? 'Выключить' : 'Включить'}
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => void handleDelete(source)} disabled={isBusy}>
                            <Trash2 className="h-4 w-4" />
                            Удалить
                          </Button>
                        </div>
                      </div>

                      {runResult ? (
                        <div
                          className={cn(
                            'mt-4 rounded-xl border px-3 py-2 text-sm',
                            runResult.ok
                              ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-100'
                              : 'border-destructive/35 bg-destructive/10 text-destructive',
                          )}
                        >
                          {runResult.ok ? (
                            <div className="space-y-1">
                              <p>
                                {`Найдено: ${runResult.summary.feedItemsTotal}. Обработано: ${runResult.summary.consideredItems}.`}
                              </p>
                              <p>
                                {`Импортировано: ${runResult.summary.importedItems}, дубликатов: ${runResult.summary.duplicateItems}, ошибок: ${runResult.summary.errorItems}.`}
                              </p>
                            </div>
                          ) : (
                            <p>{runResult.message}</p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Container>
    </AdminGuard>
  );
}
