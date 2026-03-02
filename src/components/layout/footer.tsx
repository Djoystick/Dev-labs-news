import { Container } from '@/components/layout/container';
import { getTelegramEnvironment } from '@/lib/telegram';

export function Footer() {
  const environment = getTelegramEnvironment();

  return (
    <footer className="border-t border-border/60 py-6">
      <Container className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>Stage 1 scaffold with temporary seeded feed.</span>
        <span className="rounded-full border border-border bg-background/80 px-3 py-1 font-semibold">
          Environment: {environment === 'telegram' ? 'Telegram' : 'Browser'}
        </span>
      </Container>
    </footer>
  );
}
