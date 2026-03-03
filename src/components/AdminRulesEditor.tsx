import { useEffect, useState } from 'react';
import { LoaderCircle, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { getSupabaseClient } from '@/lib/supabase';
import type { PublicationRule } from '@/types/db';

type AdminRulesResponse = {
  notifiedCount: number;
  ok: true;
  rules: {
    updated_at: string;
    version: number;
  };
};

export function AdminRulesEditor() {
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notifiedCount, setNotifiedCount] = useState<number | null>(null);
  const [rules, setRules] = useState<PublicationRule | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadRules() {
      setIsLoading(true);
      setError(null);

      try {
        const supabase = getSupabaseClient();
        const { data, error: queryError } = await supabase
          .from('publication_rules')
          .select('id, content_md, version, updated_at, updated_by')
          .eq('id', 1)
          .single();

        if (queryError) {
          throw new Error(queryError.message);
        }

        if (!ignore) {
          const nextRules = data as PublicationRule;
          setRules(nextRules);
          setContent(nextRules.content_md);
        }
      } catch (loadError) {
        if (!ignore) {
          setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить правила.');
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadRules();

    return () => {
      ignore = true;
    };
  }, []);

  const saveRules = async () => {
    setIsSaving(true);
    setError(null);
    setNotifiedCount(null);

    try {
      const supabase = getSupabaseClient();
      const { data, error: invokeError } = await supabase.functions.invoke('admin-rules', {
        body: { content_md: content },
      });

      if (invokeError) {
        throw new Error(invokeError.message);
      }

      const payload = data as AdminRulesResponse;
      setNotifiedCount(payload.notifiedCount);
      setRules((currentRules) =>
        currentRules
          ? {
              ...currentRules,
              content_md: content,
              updated_at: payload.rules.updated_at,
              version: payload.rules.version,
            }
          : {
              content_md: content,
              id: 1,
              updated_at: payload.rules.updated_at,
              updated_by: null,
              version: payload.rules.version,
            },
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Не удалось сохранить правила.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="mx-auto max-w-5xl border-border/70 bg-card/90">
      <CardHeader>
        <CardTitle>Правила публикаций</CardTitle>
        <p className="text-sm leading-6 text-muted-foreground">Изменения сохраняются в `publication_rules`, а редакторы получают Telegram-уведомление.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          className="min-h-[220px]"
          placeholder="Правила публикаций в markdown"
          disabled={isLoading || isSaving}
        />

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-muted-foreground">
            {isLoading
              ? 'Загружаем правила...'
              : rules
                ? `Версия ${rules.version}, обновлено ${new Date(rules.updated_at).toLocaleString('ru-RU')}`
                : 'Правила ещё не загружены.'}
          </div>
          <Button type="button" onClick={() => void saveRules()} disabled={isLoading || isSaving}>
            {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Сохранить правила
          </Button>
        </div>

        {notifiedCount !== null ? (
          <div className="rounded-[1.25rem] border border-border/70 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
            Уведомлено редакторов: {notifiedCount}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-[1.25rem] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
