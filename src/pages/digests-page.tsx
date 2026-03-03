import { Container } from '@/components/layout/container';
import { Card, CardContent } from '@/components/ui/card';

export function DigestsPage() {
  return (
    <Container className="safe-pb py-10">
      <Card className="mx-auto max-w-3xl border-border/70 bg-card/85 shadow-[0_28px_70px_-40px_rgba(15,23,42,0.45)]">
        <CardContent className="space-y-4 p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Сводки</p>
          <h1 className="text-3xl font-extrabold sm:text-4xl">Coming soon</h1>
          <p className="text-sm leading-7 text-muted-foreground sm:text-base">Здесь появится отдельный раздел со сводками и краткими подборками материалов.</p>
        </CardContent>
      </Card>
    </Container>
  );
}
