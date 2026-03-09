import { ArrowLeft, LoaderCircle, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AdminGuard } from '@/components/auth/admin-guard';
import { Container } from '@/components/layout/container';
import { Button } from '@/components/ui/button';
import { getPendingDraftBacklogCount, listRecentImportRuns } from '@/features/import-runs/api';
import { useAuthorHandles } from '@/features/profiles/use-author-handles';
import { listContentSources } from '@/features/sources/api';
import { cn } from '@/lib/utils';
import type { ContentSource, ImportRun, ImportRunStatus } from '@/types/db';

const RECENT_WINDOW_HOURS = 24;
const RECENT_WINDOW_MS = RECENT_WINDOW_HOURS * 60 * 60 * 1000;

type LoadState = {
  error: string | null;
  isLoading: boolean;
  pendingDraftBacklog: number | null;
  runs: ImportRun[];
  sourcesById: Map<string, ContentSource>;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'message' in error) {
    const value = (error as { message?: unknown }).message;
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }

  return fallback;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function getRunTypeLabel(value: ImportRun['run_type']) {
  return value === 'rss_import' ? 'RSS-импорт' : 'Импорт по URL';
}

function getTriggerModeLabel(value: ImportRun['trigger_mode']) {
  return value === 'scheduled' ? 'По расписанию' : 'Вручную';
}

function getStatusLabel(value: ImportRunStatus) {
  if (value === 'success') {
    return 'Успешно';
  }

  if (value === 'partial_success') {
    return 'Частично';
  }

  if (value === 'failed') {
    return 'Ошибка';
  }

  return 'В процессе';
}

function getStatusClass(value: ImportRunStatus) {
  if (value === 'success') {
    return 'bg-emerald-500/15 text-emerald-200 border-emerald-400/35';
  }

  if (value === 'partial_success') {
    return 'bg-amber-500/15 text-amber-200 border-amber-400/35';
  }

  if (value === 'failed') {
    return 'bg-destructive/15 text-destructive border-destructive/35';
  }

  return 'bg-cyan-500/15 text-cyan-200 border-cyan-400/35';
}

function pickSummaryLine(run: ImportRun) {
  if (run.error_message) {
    return run.error_message;
  }

  const resultCode = typeof run.summary.resultCode === 'string' ? run.summary.resultCode : null;
  const errorCode = typeof run.summary.errorCode === 'string' ? run.summary.errorCode : null;
  const aiModel = typeof run.summary.aiModelUsed === 'string' ? run.summary.aiModelUsed : null;

  if (errorCode) {
    return `Код ошибки: ${errorCode}`;
  }

  if (resultCode && aiModel) {
    return `${resultCode} • модель ${aiModel}`;
  }

  if (resultCode) {
    return `Код результата: ${resultCode}`;
  }

  return 'Без дополнительных деталей';
}

export function AdminImportRunsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState<LoadState>({
    error: null,
    isLoading: true,
    pendingDraftBacklog: null,
    runs: [],
    sourcesById: new Map(),
  });
  const returnTo = typeof (location.state as { returnTo?: unknown } | null)?.returnTo === 'string'
    ? (location.state as { returnTo: string }).returnTo
    : null;

  const initiatedByIds = useMemo(() => {
    return [...new Set(state.runs.map((run) => run.initiated_by).filter((value): value is string => Boolean(value)))];
  }, [state.runs]);
  const { getName } = useAuthorHandles(initiatedByIds);

  const loadRuns = useCallback(async () => {
    setState((prev) => ({ ...prev, error: null, isLoading: true }));

    try {
      const [runs, sources, pendingDraftBacklog] = await Promise.all([
        listRecentImportRuns(40),
        listContentSources().catch(() => [] as ContentSource[]),
        getPendingDraftBacklogCount().catch(() => null),
      ]);

      setState({
        error: null,
        isLoading: false,
        pendingDraftBacklog,
        runs,
        sourcesById: new Map(sources.map((source) => [source.id, source])),
      });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: getErrorMessage(error, 'Не удалось загрузить историю импортов.'),
        isLoading: false,
      }));
    }
  }, []);

  const overview = useMemo(() => {
    let lastSuccessfulRunAt: string | null = null;
    let recentErrorRuns = 0;
    let recentManualRuns = 0;
    let recentScheduledRuns = 0;
    const now = Date.now();

    for (const run of state.runs) {
      const startedAtMs = new Date(run.started_at).getTime();
      const inRecentWindow = Number.isFinite(startedAtMs) && now - startedAtMs <= RECENT_WINDOW_MS;

      if (inRecentWindow) {
        if (run.trigger_mode === 'scheduled') {
          recentScheduledRuns += 1;
        } else {
          recentManualRuns += 1;
        }

        if (run.status === 'failed' || run.status === 'partial_success' || run.error_count > 0) {
          recentErrorRuns += 1;
        }
      }

      if (
        !lastSuccessfulRunAt
        && (run.status === 'success' || (run.status === 'partial_success' && run.imported_count > 0))
      ) {
        lastSuccessfulRunAt = run.finished_at ?? run.started_at;
      }
    }

    return {
      lastSuccessfulRunAt,
      recentErrorRuns,
      recentManualRuns,
      recentScheduledRuns,
    };
  }, [state.runs]);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  const handleBack = () => {
    if (returnTo && returnTo !== location.pathname) {
      navigate(returnTo, { replace: true });
      return;
    }

    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate('/admin/sources', { replace: true });
  };

  return (
    <AdminGuard>
      <Container className="safe-pb py-6 sm:py-8">
        <div className="mx-auto max-w-5xl space-y-5">
          <div className="flex items-center gap-3">
            <Button type="button" variant="ghost" size="icon" className="rounded-full" onClick={handleBack}>
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Назад</span>
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold sm:text-3xl">История импортов</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Последние запуски импорта по URL и RSS. Все импорты создают только черновики.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={() => void loadRuns()} disabled={state.isLoading}>
              {state.isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Обновить
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div className="rounded-lg border border-border/70 bg-card/70 px-3 py-2">
              <p className="text-muted-foreground">Черновики на проверке</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {typeof state.pendingDraftBacklog === 'number' ? state.pendingDraftBacklog : '—'}
              </p>
            </div>
            <div className="rounded-lg border border-border/70 bg-card/70 px-3 py-2">
              <p className="text-muted-foreground">Последний успешный импорт</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {overview.lastSuccessfulRunAt ? formatDateTime(overview.lastSuccessfulRunAt) : 'Пока нет'}
              </p>
            </div>
            <div className="rounded-lg border border-border/70 bg-card/70 px-3 py-2">
              <p className="text-muted-foreground">{`Ошибки за ${RECENT_WINDOW_HOURS} ч`}</p>
              <p className={cn('mt-1 text-sm font-semibold', overview.recentErrorRuns > 0 ? 'text-destructive' : 'text-emerald-200')}>
                {overview.recentErrorRuns}
              </p>
            </div>
            <div className="rounded-lg border border-border/70 bg-card/70 px-3 py-2">
              <p className="text-muted-foreground">{`Запуски за ${RECENT_WINDOW_HOURS} ч`}</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {`По расписанию: ${overview.recentScheduledRuns} • Вручную: ${overview.recentManualRuns}`}
              </p>
            </div>
          </div>

          {state.error ? (
            <div className="rounded-xl border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {state.error}
            </div>
          ) : null}

          {state.isLoading ? (
            <div className="rounded-xl border border-border/70 bg-card/70 px-4 py-8 text-sm text-muted-foreground">
              Загружаем историю...
            </div>
          ) : state.runs.length === 0 ? (
            <div className="rounded-xl border border-border/70 bg-card/70 px-4 py-8 text-sm text-muted-foreground">
              Запусков импорта пока нет.
            </div>
          ) : (
            <div className="space-y-3">
              {state.runs.map((run) => {
                const sourceFromRegistry = run.content_source_id ? state.sourcesById.get(run.content_source_id) : null;
                const initiatorName = run.initiated_by ? getName(run.initiated_by) : null;

                return (
                  <article key={run.id} className="rounded-2xl border border-border/70 bg-card/70 p-4 sm:p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full border border-border/70 px-2 py-0.5 text-xs text-muted-foreground">
                        {getRunTypeLabel(run.run_type)}
                      </span>
                      <span className="inline-flex items-center rounded-full border border-border/70 px-2 py-0.5 text-xs text-muted-foreground">
                        {getTriggerModeLabel(run.trigger_mode)}
                      </span>
                      <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs', getStatusClass(run.status))}>
                        {getStatusLabel(run.status)}
                      </span>
                      <span className="text-xs text-muted-foreground">{`Старт: ${formatDateTime(run.started_at)}`}</span>
                      <span className="text-xs text-muted-foreground">{`Завершён: ${formatDateTime(run.finished_at)}`}</span>
                    </div>

                    <div className="mt-3 grid gap-2 text-sm text-foreground/90 sm:grid-cols-2">
                      <p className="break-all text-muted-foreground">
                        <span className="text-foreground">Источник:</span>{' '}
                        {run.run_type === 'url_import'
                          ? run.source_url ?? '—'
                          : sourceFromRegistry?.title
                            ? `${sourceFromRegistry.title} • ${run.feed_url ?? '—'}`
                            : run.feed_url ?? run.content_source_id ?? '—'}
                      </p>
                      <p className="text-muted-foreground">
                        <span className="text-foreground">Запустил:</span>{' '}
                        {initiatorName ?? run.initiated_by ?? 'Система'}
                      </p>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                      <div className="rounded-lg border border-border/70 bg-background/60 px-3 py-2">
                        <p className="text-muted-foreground">Найдено</p>
                        <p className="mt-1 text-sm font-semibold text-foreground">{run.discovered_count}</p>
                      </div>
                      <div className="rounded-lg border border-border/70 bg-background/60 px-3 py-2">
                        <p className="text-muted-foreground">Создано черновиков</p>
                        <p className="mt-1 text-sm font-semibold text-foreground">{run.imported_count}</p>
                      </div>
                      <div className="rounded-lg border border-border/70 bg-background/60 px-3 py-2">
                        <p className="text-muted-foreground">Дубликаты</p>
                        <p className="mt-1 text-sm font-semibold text-foreground">{run.duplicate_count}</p>
                      </div>
                      <div className="rounded-lg border border-border/70 bg-background/60 px-3 py-2">
                        <p className="text-muted-foreground">Ошибки</p>
                        <p className="mt-1 text-sm font-semibold text-foreground">{run.error_count}</p>
                      </div>
                    </div>

                    <p className="mt-3 text-xs text-muted-foreground">
                      <span className="text-foreground">Диагностика:</span> {pickSummaryLine(run)}
                    </p>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </Container>
    </AdminGuard>
  );
}
