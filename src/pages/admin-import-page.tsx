import { AlertTriangle, LoaderCircle, Link2, PencilLine } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AdminGuard } from '@/components/auth/admin-guard';
import { FlatPage, FlatSection } from '@/components/layout/flat';
import { AppLink } from '@/components/ui/app-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { importPostDraftByUrl, type ImportDraftFailure, type ImportDraftSuccess } from '@/features/posts/import-draft-api';

function ImportResultSuccess({ result, onOpenDraft }: { onOpenDraft: () => void; result: ImportDraftSuccess }) {
  return (
    <div className="rounded-[1.25rem] border border-emerald-400/35 bg-emerald-500/10 p-4 text-sm">
      <p className="font-semibold text-emerald-100">Черновик создан</p>
      <p className="mt-1 text-emerald-50/90">
        {result.post.title}
      </p>
      {result.aiModelUsed ? (
        <p className="mt-2 text-xs text-emerald-100/90">
          {result.aiWasFallback
            ? `AI: fallback model ${result.aiModelUsed}`
            : `AI: model ${result.aiModelUsed}`}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={onOpenDraft}>
          <PencilLine className="h-4 w-4" />
          {'Открыть черновик'}
        </Button>
      </div>
      {result.warnings && result.warnings.length > 0 ? (
        <div className="mt-3 rounded-xl border border-amber-300/35 bg-amber-500/10 p-3 text-amber-100">
          <p className="text-xs font-semibold uppercase tracking-[0.15em]">Warnings</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {result.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ImportResultError({ errorResult, onOpenExisting }: { errorResult: ImportDraftFailure; onOpenExisting: () => void }) {
  return (
    <div className="rounded-[1.25rem] border border-destructive/35 bg-destructive/10 p-4 text-sm text-destructive">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-semibold">{errorResult.code ?? 'IMPORT_ERROR'}</p>
          <p className="mt-1">{errorResult.message}</p>
          {errorResult.existingPostId ? (
            <Button type="button" size="sm" variant="outline" className="mt-3" onClick={onOpenExisting}>
              {'Открыть существующий черновик'}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function AdminImportPage() {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState<ImportDraftSuccess | null>(null);
  const [errorResult, setErrorResult] = useState<ImportDraftFailure | null>(null);

  const openPostEditor = (postId: string) => {
    navigate(`/admin/edit/${postId}`, {
      state: {
        returnTo: '/author',
      },
    });
  };

  const submit = async () => {
    const normalizedUrl = url.trim();
    if (!normalizedUrl) {
      setErrorResult({
        message: 'Укажите URL статьи для импорта.',
        ok: false,
      });
      setSuccessResult(null);
      return;
    }

    setIsSubmitting(true);
    setErrorResult(null);
    setSuccessResult(null);

    try {
      const result = await importPostDraftByUrl({
        note,
        url: normalizedUrl,
      });

      if (!result.ok) {
        setErrorResult(result);
        if (result.code === 'DUPLICATE' || result.code === 'DUPLICATE_SOFT') {
          toast.info('Найден существующий импорт для этого источника.');
        } else {
          toast.error(result.message);
        }
        return;
      }

      setSuccessResult(result);
      toast.success('Черновик импортирован. Проверьте его перед публикацией.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось выполнить импорт.';
      setErrorResult({
        message,
        ok: false,
      });
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AdminGuard allowEditor>
      <FlatPage className="safe-pb py-6 sm:py-8">
        <div className="space-y-6">
          <FlatSection className="pt-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-3xl font-bold">{'Импортировать в черновик'}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {'URL -> server extraction -> AI draft. Публикация остаётся только ручной.'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button asChild type="button" variant="outline">
                  <AppLink to="/admin/new">{'Создать вручную'}</AppLink>
                </Button>
                <Button asChild type="button" variant="ghost">
                  <AppLink to="/author">{'К черновикам'}</AppLink>
                </Button>
              </div>
            </div>
          </FlatSection>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="source-url">{'URL источника'}</Label>
              <Input
                id="source-url"
                placeholder="https://example.com/article"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editor-note">{'Заметка редактора (опционально)'}</Label>
              <Textarea
                id="editor-note"
                placeholder="Контекст, акценты, требования к переработке..."
                value={note}
                onChange={(event) => setNote(event.target.value)}
                disabled={isSubmitting}
                className="min-h-[110px]"
              />
            </div>

            <div className="rounded-[1.25rem] border border-border/60 bg-background/60 p-3 text-xs leading-6 text-muted-foreground">
              {'Импорт создаёт только draft. Перед публикацией обязательно откройте черновик, проверьте факты и внесите ручные правки.'}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="button" disabled={isSubmitting} onClick={() => void submit()}>
                {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                {'Импортировать в черновик'}
              </Button>
              {successResult ? (
                <Button type="button" variant="outline" onClick={() => openPostEditor(successResult.post.id)}>
                  <PencilLine className="h-4 w-4" />
                  {'Открыть созданный черновик'}
                </Button>
              ) : null}
            </div>
          </div>

          {successResult ? (
            <ImportResultSuccess
              result={successResult}
              onOpenDraft={() => openPostEditor(successResult.post.id)}
            />
          ) : null}

          {errorResult ? (
            <ImportResultError
              errorResult={errorResult}
              onOpenExisting={() => {
                if (!errorResult.existingPostId) {
                  return;
                }

                openPostEditor(errorResult.existingPostId);
              }}
            />
          ) : null}
        </div>
      </FlatPage>
    </AdminGuard>
  );
}
