import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, Plus, Search } from 'lucide-react';
import { AuthDialog } from '@/components/auth/auth-dialog';
import { UserMenu } from '@/components/auth/user-menu';
import { Container } from '@/components/layout/container';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/providers/auth-provider';

type HeaderProps = {
  onMenuClick: () => void;
  onSearchChange?: (value: string) => void;
  resultsCount: number;
  searchValue?: string;
  selectedTopicName: string;
};

export function Header({ onMenuClick, onSearchChange, resultsCount, searchValue = '', selectedTopicName }: HeaderProps) {
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const { isAdmin, isAuthed, loading } = useAuth();

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
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-medium text-muted-foreground">
              <span className="rounded-full bg-secondary px-3 py-1 text-foreground">{selectedTopicName}</span>
              <span>{resultsCount} visible articles</span>
            </div>
          </div>
          {isAuthed && isAdmin ? (
            <Button asChild variant="outline" className="hidden sm:inline-flex">
              <Link to="/admin/new">
                <Plus className="h-4 w-4" />
                New post
              </Link>
            </Button>
          ) : null}
          {loading ? (
            <div className="h-10 w-24 rounded-full bg-secondary" aria-hidden />
          ) : isAuthed ? (
            <UserMenu />
          ) : (
            <Button onClick={() => setAuthDialogOpen(true)}>Sign in</Button>
          )}
          <ThemeToggle />
        </div>
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={searchValue} onChange={(event) => onSearchChange?.(event.target.value)} className="pl-11" placeholder="Search by title" />
        </div>
        <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
      </Container>
    </header>
  );
}
