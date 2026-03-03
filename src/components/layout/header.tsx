import { useState } from 'react';
import { AuthDialog } from '@/components/auth/auth-dialog';
import { UserMenu } from '@/components/auth/user-menu';
import { Container } from '@/components/layout/container';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/providers/auth-provider';

export function Header() {
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const { isAuthed, loading } = useAuth();

  return (
    <header className="fixed inset-x-0 top-0 z-[60] border-b border-border/70 bg-background/95 shadow-[0_20px_45px_-35px_rgba(15,23,42,0.55)] backdrop-blur-xl pt-[env(safe-area-inset-top,0px)]">
      <Container className="py-2 sm:py-1.5">
        <div className="flex h-9 items-center gap-3 sm:h-12">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="group min-w-0">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary shadow-inner shadow-primary/10">
                  <span className="text-[11px] font-extrabold uppercase tracking-[0.22em]">DL</span>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[10px] font-bold uppercase tracking-[0.24em] text-primary transition group-hover:text-primary/80">DEV-LABS NEWS</p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle className="h-9 w-9 border-border/70 bg-background/80 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.65)]" />
            {loading ? (
              <div className="h-9 w-9 rounded-full bg-secondary sm:w-20" aria-hidden />
            ) : isAuthed ? (
              <UserMenu />
            ) : (
              <Button onClick={() => setAuthDialogOpen(true)} size="sm" variant="secondary" className="h-9 shrink-0 rounded-full px-3">
                <span className="hidden sm:inline">Войти</span>
                <span className="sm:hidden">Вход</span>
              </Button>
            )}
          </div>
        </div>
        <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
      </Container>
    </header>
  );
}
