import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Container } from '@/components/layout/container';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getEnvIssues } from '@/lib/env';

export function EnvGuard({ children }: { children: ReactNode }) {
  const issues = getEnvIssues();

  if (issues.length === 0) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Container className="safe-pb safe-pt py-10">
        <Card className="mx-auto max-w-2xl">
          <CardHeader>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <CardTitle>Supabase environment is not configured</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertTitle>Missing configuration</AlertTitle>
              <AlertDescription>
                {issues.join('. ')}
              </AlertDescription>
            </Alert>
            <div className="rounded-2xl bg-secondary/60 p-4 text-sm leading-6 text-muted-foreground">
              Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env.local`, then restart `npm run dev`.
            </div>
            <pre className="overflow-x-auto rounded-2xl border border-border bg-background/80 p-4 text-xs text-foreground">
{`VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=`}
            </pre>
          </CardContent>
        </Card>
      </Container>
    </div>
  );
}
