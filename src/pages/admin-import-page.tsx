import { AlertTriangle, ArrowLeft, LoaderCircle, Link2, PencilLine } from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AdminGuard } from '@/components/auth/admin-guard';
import { FlatPage, FlatSection } from '@/components/layout/flat';
import { AppLink } from '@/components/ui/app-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { importPostDraftByUrl, type ImportDraftFailure, type ImportDraftSuccess } from '@/features/posts/import-draft-api';

const AI_IMPORT_ERROR_CODES = new Set([
  'AI_ALL_MODELS_FAILED',
  'AI_FAILED',
  'AI_INVALID',
  'AI_LANGUAGE_MISMATCH',
  'AI_MODEL_UNAVAILABLE',
  'AI_NETWORK',
  'AI_PROVIDER_ERROR',
  'AI_RATE_LIMIT',
  'AI_TIMEOUT',
]);

function isAiImportError(code?: string) {
  return typeof code === 'string' && AI_IMPORT_ERROR_CODES.has(code);
}

function getFriendlyErrorMessage(errorResult: ImportDraftFailure) {
  if (isAiImportError(errorResult.code)) {
    return 'AI-РёРјРїРѕСЂС‚ СЃРµР№С‡Р°СЃ РЅРµРґРѕСЃС‚СѓРїРµРЅ. РџРѕРїСЂРѕР±СѓР№С‚Рµ РїРѕР·Р¶Рµ РёР»Рё СЃРѕР·РґР°Р№С‚Рµ С‡РµСЂРЅРѕРІРёРє РІСЂСѓС‡РЅСѓСЋ.';
  }

  return errorResult.message;
}

function getAiDiagnostics(errorResult: ImportDraftFailure) {
  if (!isAiImportError(errorResult.code)) {
    return null;
  }

  const details = errorResult.details ?? {};
  const rawReason = typeof details.aiFailureReason === 'string' ? details.aiFailureReason : errorResult.message;
  const modelsTried = Array.isArray(details.aiModelsTried)
    ? details.aiModelsTried.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

  const modelHint = modelsTried.length > 0 ? `Models: ${modelsTried.join(', ')}` : '';
  return [rawReason, modelHint].filter(Boolean).join(' | ');
}

function ImportResultSuccess({ result, onOpenDraft }: { onOpenDraft: () => void; result: ImportDraftSuccess }) {
  return (
    <div className="rounded-[1.25rem] border border-emerald-400/35 bg-emerald-500/10 p-4 text-sm">
      <p className="font-semibold text-emerald-100">Р§РµСЂРЅРѕРІРёРє СЃРѕР·РґР°РЅ</p>
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
          {'РћС‚РєСЂС‹С‚СЊ С‡РµСЂРЅРѕРІРёРє'}
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
  const friendlyMessage = getFriendlyErrorMessage(errorResult);
  const diagnostics = getAiDiagnostics(errorResult);

  return (
    <div className="rounded-[1.25rem] border border-destructive/35 bg-destructive/10 p-4 text-sm text-destructive">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-semibold">{errorResult.code ?? 'IMPORT_ERROR'}</p>
          <p className="mt-1">{friendlyMessage}</p>
          {diagnostics ? (
            <p className="mt-2 text-xs text-destructive/80">{diagnostics}</p>
          ) : null}
          {errorResult.existingPostId ? (
            <Button type="button" size="sm" variant="outline" className="mt-3" onClick={onOpenExisting}>
              {'РћС‚РєСЂС‹С‚СЊ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёР№ С‡РµСЂРЅРѕРІРёРє'}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
export function AdminImportPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState<ImportDraftSuccess | null>(null);
  const [errorResult, setErrorResult] = useState<ImportDraftFailure | null>(null);
  const returnTo = typeof (location.state as { returnTo?: unknown } | null)?.returnTo === 'string'
    ? (location.state as { returnTo: string }).returnTo
    : null;
  const returnScrollY = typeof (location.state as { returnScrollY?: unknown } | null)?.returnScrollY === 'number'
    && Number.isFinite((location.state as { returnScrollY?: number }).returnScrollY)
    ? Math.max(0, (location.state as { returnScrollY: number }).returnScrollY)
    : 0;

  const handleBack = () => {
    if (returnTo && returnTo !== location.pathname) {
      navigate(returnTo, {
        replace: true,
        state: returnScrollY > 0 ? { restoreScrollY: returnScrollY } : null,
      });
      return;
    }

    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate('/author', { replace: true });
  };

  const openPostEditor = (postId: string) => {
    navigate(`/admin/edit/${postId}`, {
      state: {
        returnTo: returnTo ?? '/author',
        returnScrollY: typeof window !== 'undefined' ? window.scrollY : returnScrollY,
      },
    });
  };

  const submit = async () => {
    const normalizedUrl = url.trim();
    if (!normalizedUrl) {
      setErrorResult({
        message: 'РЈРєР°Р¶РёС‚Рµ URL СЃС‚Р°С‚СЊРё РґР»СЏ РёРјРїРѕСЂС‚Р°.',
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
          toast.info('РќР°Р№РґРµРЅ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёР№ РёРјРїРѕСЂС‚ РґР»СЏ СЌС‚РѕРіРѕ РёСЃС‚РѕС‡РЅРёРєР°.');
        } else {
          toast.error(getFriendlyErrorMessage(result));
        }
        return;
      }

      setSuccessResult(result);
      toast.success('Р§РµСЂРЅРѕРІРёРє РёРјРїРѕСЂС‚РёСЂРѕРІР°РЅ. РџСЂРѕРІРµСЂСЊС‚Рµ РµРіРѕ РїРµСЂРµРґ РїСѓР±Р»РёРєР°С†РёРµР№.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'РќРµ СѓРґР°Р»РѕСЃСЊ РІС‹РїРѕР»РЅРёС‚СЊ РёРјРїРѕСЂС‚.';
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
              <div className="flex items-center gap-3">
                <Button type="button" variant="ghost" size="icon" className="rounded-full" onClick={handleBack}>
                  <ArrowLeft className="h-5 w-5" />
                  <span className="sr-only">Назад</span>
                </Button>
                <div>
                <h1 className="text-3xl font-bold">{'РРјРїРѕСЂС‚РёСЂРѕРІР°С‚СЊ РІ С‡РµСЂРЅРѕРІРёРє'}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {'URL -> server extraction -> AI draft. РџСѓР±Р»РёРєР°С†РёСЏ РѕСЃС‚Р°С‘С‚СЃСЏ С‚РѕР»СЊРєРѕ СЂСѓС‡РЅРѕР№.'}
                </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button asChild type="button" variant="outline">
                  <AppLink to="/admin/new" state={{ returnTo: '/admin/import' }}>{'РЎРѕР·РґР°С‚СЊ РІСЂСѓС‡РЅСѓСЋ'}</AppLink>
                </Button>
                <Button asChild type="button" variant="ghost">
                  <AppLink to="/author">{'Рљ С‡РµСЂРЅРѕРІРёРєР°Рј'}</AppLink>
                </Button>
              </div>
            </div>
          </FlatSection>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="source-url">{'URL РёСЃС‚РѕС‡РЅРёРєР°'}</Label>
              <Input
                id="source-url"
                placeholder="https://example.com/article"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editor-note">{'Р—Р°РјРµС‚РєР° СЂРµРґР°РєС‚РѕСЂР° (РѕРїС†РёРѕРЅР°Р»СЊРЅРѕ)'}</Label>
              <Textarea
                id="editor-note"
                placeholder="РљРѕРЅС‚РµРєСЃС‚, Р°РєС†РµРЅС‚С‹, С‚СЂРµР±РѕРІР°РЅРёСЏ Рє РїРµСЂРµСЂР°Р±РѕС‚РєРµ..."
                value={note}
                onChange={(event) => setNote(event.target.value)}
                disabled={isSubmitting}
                className="min-h-[110px]"
              />
            </div>

            <div className="rounded-[1.25rem] border border-border/60 bg-background/60 p-3 text-xs leading-6 text-muted-foreground">
              {'РРјРїРѕСЂС‚ СЃРѕР·РґР°С‘С‚ С‚РѕР»СЊРєРѕ draft. РџРµСЂРµРґ РїСѓР±Р»РёРєР°С†РёРµР№ РѕР±СЏР·Р°С‚РµР»СЊРЅРѕ РѕС‚РєСЂРѕР№С‚Рµ С‡РµСЂРЅРѕРІРёРє, РїСЂРѕРІРµСЂСЊС‚Рµ С„Р°РєС‚С‹ Рё РІРЅРµСЃРёС‚Рµ СЂСѓС‡РЅС‹Рµ РїСЂР°РІРєРё.'}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="button" disabled={isSubmitting} onClick={() => void submit()}>
                {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                {'РРјРїРѕСЂС‚РёСЂРѕРІР°С‚СЊ РІ С‡РµСЂРЅРѕРІРёРє'}
              </Button>
              {successResult ? (
                <Button type="button" variant="outline" onClick={() => openPostEditor(successResult.post.id)}>
                  <PencilLine className="h-4 w-4" />
                  {'РћС‚РєСЂС‹С‚СЊ СЃРѕР·РґР°РЅРЅС‹Р№ С‡РµСЂРЅРѕРІРёРє'}
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





