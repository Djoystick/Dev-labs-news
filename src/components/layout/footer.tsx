import { Container } from '@/components/layout/container';

export function Footer() {
  return (
    <footer className="border-t border-border/60 pb-[calc(var(--app-bottom-bar-height)+0.5rem)] pt-4 md:pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
      <Container className="flex items-center justify-center text-center text-xs text-muted-foreground">
        <span>
          Разработано{' '}
          <a href="https://t.me/Tvoy_Kosmonavt" target="_blank" rel="noreferrer" className="font-semibold text-foreground transition hover:text-primary">
            Твой Космонавт
          </a>
        </span>
      </Container>
    </footer>
  );
}
