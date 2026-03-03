import { useState } from 'react';
import { LoaderCircle, ShieldCheck, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getSupabaseClient } from '@/lib/supabase';
import type { Profile } from '@/types/db';

type RoleTarget = 'editor' | 'user';

export function RoleManager() {
  const [handle, setHandle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<Profile | null>(null);

  const submit = async (role: RoleTarget) => {
    const normalizedHandle = handle.trim();

    if (!normalizedHandle) {
      setError('Укажите никнейм или handle.');
      setResult(null);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const supabase = getSupabaseClient();
      const { data, error: rpcError } = await supabase.rpc('set_profile_role_by_handle', {
        p_handle: normalizedHandle,
        p_role: role,
      });

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      setResult(data as Profile);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось обновить роль.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resultName = result?.username ? `@${result.username}` : result?.handle ? `@${result.handle}` : result?.id ?? null;

  return (
    <Card className="mx-auto mb-6 max-w-5xl border-border/70 bg-card/90">
      <CardHeader>
        <CardTitle>Управление ролями</CardTitle>
        <p className="text-sm leading-6 text-muted-foreground">Назначьте роль редактора по `@nickname`, `nickname`, `handle` или `username`.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
          <Input
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            placeholder="@nickname"
            disabled={isSubmitting}
          />
          <Button type="button" onClick={() => void submit('editor')} disabled={isSubmitting}>
            {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Сделать редактором
          </Button>
          <Button type="button" variant="outline" onClick={() => void submit('user')} disabled={isSubmitting}>
            {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
            Снять редактора
          </Button>
        </div>

        {result ? (
          <div className="rounded-[1.25rem] border border-border/70 bg-background/70 px-4 py-3 text-sm">
            <p className="font-semibold">Роль обновлена</p>
            <p className="mt-1 text-muted-foreground">
              {resultName} {'->'} {result.role}
            </p>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-[1.25rem] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <p className="text-sm text-muted-foreground">Пользователю нужно перезайти, чтобы роль обновилась в JWT.</p>
      </CardContent>
    </Card>
  );
}
