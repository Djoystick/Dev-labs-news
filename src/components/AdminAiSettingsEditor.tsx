import { Info, LoaderCircle, Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { getSupabaseClient } from '@/lib/supabase';
import type { AiDedupeMode, AiImportModel, AiImportSettings, AiResultLength, AiRewriteMode } from '@/types/db';

type EditableAiImportSettings = Pick<
  AiImportSettings,
  'dedupe_mode' | 'fallback_model' | 'max_tags' | 'primary_model' | 'result_length' | 'rewrite_mode' | 'use_source_image'
>;

const MODEL_OPTIONS: AiImportModel[] = ['qwen-3-235b-a22b-instruct-2507', 'gpt-oss-120b'];
const REWRITE_MODE_OPTIONS: AiRewriteMode[] = ['conservative', 'balanced', 'aggressive'];
const RESULT_LENGTH_OPTIONS: AiResultLength[] = ['short', 'standard', 'long'];
const DEDUPE_MODE_OPTIONS: AiDedupeMode[] = ['strict_url', 'url_and_soft_title'];

const REWRITE_MODE_LABELS: Record<AiRewriteMode, string> = {
  conservative: 'Ближе к источнику',
  balanced: 'Сбалансированно',
  aggressive: 'Более свободно',
};

const RESULT_LENGTH_LABELS: Record<AiResultLength, string> = {
  short: 'Коротко',
  standard: 'Стандартно',
  long: 'Подробно',
};

const DEDUPE_MODE_LABELS: Record<AiDedupeMode, string> = {
  strict_url: 'Только точное совпадение ссылки',
  url_and_soft_title: 'Ссылка и похожий заголовок',
};

const DEFAULT_AI_IMPORT_SETTINGS: EditableAiImportSettings = {
  dedupe_mode: 'strict_url',
  fallback_model: 'gpt-oss-120b',
  max_tags: 5,
  primary_model: 'qwen-3-235b-a22b-instruct-2507',
  result_length: 'standard',
  rewrite_mode: 'conservative',
  use_source_image: true,
};

function normalizeModel(value: unknown, fallback: AiImportModel): AiImportModel {
  return typeof value === 'string' && MODEL_OPTIONS.includes(value as AiImportModel) ? (value as AiImportModel) : fallback;
}

function normalizeRewriteMode(value: unknown, fallback: AiRewriteMode): AiRewriteMode {
  return typeof value === 'string' && REWRITE_MODE_OPTIONS.includes(value as AiRewriteMode) ? (value as AiRewriteMode) : fallback;
}

function normalizeResultLength(value: unknown, fallback: AiResultLength): AiResultLength {
  return typeof value === 'string' && RESULT_LENGTH_OPTIONS.includes(value as AiResultLength) ? (value as AiResultLength) : fallback;
}

function normalizeDedupeMode(value: unknown, fallback: AiDedupeMode): AiDedupeMode {
  return typeof value === 'string' && DEDUPE_MODE_OPTIONS.includes(value as AiDedupeMode) ? (value as AiDedupeMode) : fallback;
}

function normalizeMaxTags(value: unknown, fallback: number) {
  const numberValue = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  const rounded = Math.round(numberValue);
  return Math.min(5, Math.max(1, rounded));
}

function normalizeSettings(value: Partial<AiImportSettings> | null | undefined): EditableAiImportSettings {
  return {
    dedupe_mode: normalizeDedupeMode(value?.dedupe_mode, DEFAULT_AI_IMPORT_SETTINGS.dedupe_mode),
    fallback_model: normalizeModel(value?.fallback_model, DEFAULT_AI_IMPORT_SETTINGS.fallback_model),
    max_tags: normalizeMaxTags(value?.max_tags, DEFAULT_AI_IMPORT_SETTINGS.max_tags),
    primary_model: normalizeModel(value?.primary_model, DEFAULT_AI_IMPORT_SETTINGS.primary_model),
    result_length: normalizeResultLength(value?.result_length, DEFAULT_AI_IMPORT_SETTINGS.result_length),
    rewrite_mode: normalizeRewriteMode(value?.rewrite_mode, DEFAULT_AI_IMPORT_SETTINGS.rewrite_mode),
    use_source_image: typeof value?.use_source_image === 'boolean' ? value.use_source_image : DEFAULT_AI_IMPORT_SETTINGS.use_source_image,
  };
}

function InfoHint({ hint, label }: { hint: string; label: string }) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border/70 text-muted-foreground transition hover:bg-secondary"
          aria-label={`Подсказка: ${label}`}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-w-[18rem] p-3">
        <p className="text-xs leading-5 text-foreground/90">{hint}</p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LabelWithHint({ hint, htmlFor, text }: { hint?: string; htmlFor: string; text: string }) {
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={htmlFor}>{text}</Label>
      {hint ? <InfoHint hint={hint} label={text} /> : null}
    </div>
  );
}

export function AdminAiSettingsEditor() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<EditableAiImportSettings>(DEFAULT_AI_IMPORT_SETTINGS);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadSettings() {
      setIsLoading(true);
      setError(null);

      try {
        const supabase = getSupabaseClient();
        const { data, error: queryError } = await supabase
          .from('ai_import_settings')
          .select('id, primary_model, fallback_model, rewrite_mode, result_length, max_tags, use_source_image, dedupe_mode, updated_at')
          .eq('id', 1)
          .maybeSingle();

        if (queryError) {
          throw new Error(queryError.message);
        }

        if (!ignore) {
          setSettings(normalizeSettings(data as Partial<AiImportSettings> | null));
          setUpdatedAt(typeof data?.updated_at === 'string' ? data.updated_at : null);
        }
      } catch (loadError) {
        if (!ignore) {
          setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить AI-настройки.');
          setSettings(DEFAULT_AI_IMPORT_SETTINGS);
          setUpdatedAt(null);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadSettings();

    return () => {
      ignore = true;
    };
  }, []);

  const saveSettings = async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const supabase = getSupabaseClient();
      const payload = {
        dedupe_mode: settings.dedupe_mode,
        fallback_model: settings.fallback_model,
        id: 1,
        max_tags: normalizeMaxTags(settings.max_tags, DEFAULT_AI_IMPORT_SETTINGS.max_tags),
        primary_model: settings.primary_model,
        result_length: settings.result_length,
        rewrite_mode: settings.rewrite_mode,
        use_source_image: settings.use_source_image,
      };

      const { data, error: updateError } = await supabase
        .from('ai_import_settings')
        .upsert(payload, { onConflict: 'id' })
        .select('primary_model, fallback_model, rewrite_mode, result_length, max_tags, use_source_image, dedupe_mode, updated_at')
        .single();

      if (updateError) {
        throw new Error(updateError.message);
      }

      const normalized = normalizeSettings(data as Partial<AiImportSettings>);
      setSettings(normalized);
      setUpdatedAt(typeof data?.updated_at === 'string' ? data.updated_at : null);
      setSuccessMessage('AI-настройки сохранены.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Не удалось сохранить AI-настройки.');
    } finally {
      setIsSaving(false);
    }
  };

  const hasFallbackReserve = useMemo(() => settings.primary_model !== settings.fallback_model, [settings.fallback_model, settings.primary_model]);

  return (
    <Card className="mx-auto max-w-5xl border-border/70 bg-card/90">
      <CardHeader>
        <CardTitle>AI-настройки импорта в черновик</CardTitle>
        <p className="text-sm leading-6 text-muted-foreground">
          Здесь доступны только безопасные параметры импорта в черновик. Секреты и ключи в интерфейсе не показываются.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ai-primary-model">Основная модель</Label>
            <Select
              id="ai-primary-model"
              value={settings.primary_model}
              onChange={(event) => setSettings((prev) => ({ ...prev, primary_model: event.target.value as AiImportModel }))}
              disabled={isLoading || isSaving}
            >
              {MODEL_OPTIONS.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ai-fallback-model">Резервная модель</Label>
            <Select
              id="ai-fallback-model"
              value={settings.fallback_model}
              onChange={(event) => setSettings((prev) => ({ ...prev, fallback_model: event.target.value as AiImportModel }))}
              disabled={isLoading || isSaving}
            >
              {MODEL_OPTIONS.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <LabelWithHint
              htmlFor="ai-rewrite-mode"
              text="Режим переработки"
              hint="Определяет, насколько свободно AI перерабатывает исходный текст: ближе к источнику, сбалансированно или более свободно."
            />
            <Select
              id="ai-rewrite-mode"
              value={settings.rewrite_mode}
              onChange={(event) => setSettings((prev) => ({ ...prev, rewrite_mode: event.target.value as AiRewriteMode }))}
              disabled={isLoading || isSaving}
            >
              {REWRITE_MODE_OPTIONS.map((mode) => (
                <option key={mode} value={mode}>
                  {REWRITE_MODE_LABELS[mode]}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <LabelWithHint
              htmlFor="ai-result-length"
              text="Длина результата"
              hint="Управляет объёмом черновика: коротко, стандартно или подробно."
            />
            <Select
              id="ai-result-length"
              value={settings.result_length}
              onChange={(event) => setSettings((prev) => ({ ...prev, result_length: event.target.value as AiResultLength }))}
              disabled={isLoading || isSaving}
            >
              {RESULT_LENGTH_OPTIONS.map((length) => (
                <option key={length} value={length}>
                  {RESULT_LENGTH_LABELS[length]}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <LabelWithHint
              htmlFor="ai-max-tags"
              text="Макс. тегов (1-5)"
              hint="Ограничивает количество тематических тегов, которые AI может добавить в черновик."
            />
            <Input
              id="ai-max-tags"
              type="number"
              min={1}
              max={5}
              step={1}
              value={settings.max_tags}
              onChange={(event) => setSettings((prev) => ({ ...prev, max_tags: normalizeMaxTags(event.target.value, prev.max_tags) }))}
              disabled={isLoading || isSaving}
            />
          </div>

          <div className="space-y-2">
            <LabelWithHint
              htmlFor="ai-dedupe-mode"
              text="Режим дедупликации"
              hint="Определяет, как строго система считает материал дублем: только по ссылке или по ссылке и похожему заголовку."
            />
            <Select
              id="ai-dedupe-mode"
              value={settings.dedupe_mode}
              onChange={(event) => setSettings((prev) => ({ ...prev, dedupe_mode: event.target.value as AiDedupeMode }))}
              disabled={isLoading || isSaving}
            >
              {DEDUPE_MODE_OPTIONS.map((mode) => (
                <option key={mode} value={mode}>
                  {DEDUPE_MODE_LABELS[mode]}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="rounded-[1.25rem] border border-border/70 bg-background/70 px-4 py-3">
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">Использовать изображение источника</p>
              <p className="text-xs text-muted-foreground">Если включено, AI может подтянуть source/og:image в черновик.</p>
            </div>
            <input
              type="checkbox"
              className="h-4 w-4 accent-cyan-500"
              checked={settings.use_source_image}
              onChange={(event) => setSettings((prev) => ({ ...prev, use_source_image: event.target.checked }))}
              disabled={isLoading || isSaving}
            />
          </label>
        </div>

        {!hasFallbackReserve ? (
          <div className="rounded-[1.25rem] border border-amber-300/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Основная и резервная модели совпадают, поэтому резервного переключения по модели не будет.
          </div>
        ) : null}

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-muted-foreground">
            {isLoading
              ? 'Загружаем настройки...'
              : updatedAt
                ? `Обновлено ${new Date(updatedAt).toLocaleString('ru-RU')}`
                : 'Используются настройки по умолчанию.'}
          </div>
          <Button type="button" onClick={() => void saveSettings()} disabled={isLoading || isSaving}>
            {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Сохранить настройки
          </Button>
        </div>

        {successMessage ? (
          <div className="rounded-[1.25rem] border border-emerald-400/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {successMessage}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-[1.25rem] border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
