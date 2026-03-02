import { Container } from '@/components/layout/container';

export function Footer() {
  return (
    <footer className="border-t border-border/60 py-5">
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
