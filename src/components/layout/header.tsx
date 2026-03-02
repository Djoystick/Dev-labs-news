import { Menu, Search } from 'lucide-react';
import { Container } from '@/components/layout/container';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type HeaderProps = {
  onMenuClick: () => void;
  onSearchChange?: (value: string) => void;
  searchValue?: string;
};

export function Header({ onMenuClick, onSearchChange, searchValue = '' }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <Container className="safe-pt pb-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={onMenuClick} aria-label="Open topics">
            <Menu className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-primary">Dev-labs News</p>
            <h1 className="truncate text-lg font-extrabold sm:text-xl">Engineering dispatches in a Telegram-native shell</h1>
          </div>
          <ThemeToggle />
        </div>
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={searchValue} onChange={(event) => onSearchChange?.(event.target.value)} className="pl-11" placeholder="Search by title" />
        </div>
      </Container>
    </header>
  );
}
