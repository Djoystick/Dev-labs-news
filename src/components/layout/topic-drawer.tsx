import { useState } from 'react';
import { Hash, House, LogOut, PencilLine, Search, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { AuthDialog } from '@/components/auth/auth-dialog';
import { AppLink } from '@/components/ui/app-link';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { StateCard } from '@/components/ui/state-card';
import { cn } from '@/lib/utils';
import type { Topic } from '@/types/db';

type TopicDrawerProps = {
  activeTopic: string;
  isLoading: boolean;
  onOpenChange: (open: boolean) => void;
  onSearchChange: (value: string) => void;
  onRetry: () => void;
  onSelect: (slug: string) => void;
  open: boolean;
  query: string;
  topics: Array<Topic & { count: number }>;
  topicsError: string | null;
};

export function TopicDrawer({ activeTopic, isLoading, onOpenChange, onRetry, onSearchChange, onSelect, open, query, topics, topicsError }: TopicDrawerProps) {
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const { isAdmin, isAuthed, signOut } = useAuth();

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="left" className="safe-pt">
          <SheetHeader className="sr-only">
            <SheetTitle>Меню ленты</SheetTitle>
            <SheetDescription>Поиск, фильтр по темам и быстрые действия.</SheetDescription>
          </SheetHeader>
          <div className="space-y-3">
            <div className="px-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Меню</div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => onSearchChange(event.target.value)}
                className="h-10 rounded-2xl border-border/70 bg-background/85 pl-11"
                placeholder="Поиск по заголовку"
              />
            </div>
            <div className="grid gap-1.5">
              <Button asChild variant="ghost" size="sm" className="h-9 justify-start rounded-xl px-3">
                <AppLink to="/" onClick={() => onOpenChange(false)}>
                  <House className="h-4 w-4" />
                  Главная
                </AppLink>
              </Button>
              {isAdmin ? (
                <Button asChild variant="ghost" size="sm" className="h-9 justify-start rounded-xl px-3">
                  <AppLink to="/admin/new" onClick={() => onOpenChange(false)}>
                    <PencilLine className="h-4 w-4" />
                    Новая новость
                  </AppLink>
                </Button>
              ) : null}
              {isAuthed ? (
                <>
                  <Button asChild variant="ghost" size="sm" className="h-9 justify-start rounded-xl px-3">
                    <AppLink to="/profile" onClick={() => onOpenChange(false)}>
                      <UserRound className="h-4 w-4" />
                      Профиль
                    </AppLink>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 justify-start rounded-xl px-3"
                    onClick={async () => {
                      try {
                        await signOut();
                        onOpenChange(false);
                        toast.success('Вы вышли из аккаунта.');
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : 'Не удалось выйти.');
                      }
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                    Выйти
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 justify-start rounded-xl px-3"
                  onClick={() => {
                    onOpenChange(false);
                    setAuthDialogOpen(true);
                  }}
                >
                  <UserRound className="h-4 w-4" />
                  Войти
                </Button>
              )}
            </div>
          </div>
          <div className="mb-3 mt-6 flex items-center justify-between px-1">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Темы</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2.5 text-xs"
              onClick={() => {
                onSelect('all');
                onOpenChange(false);
              }}
            >
              Все темы
            </Button>
          </div>
          {topicsError ? (
            <StateCard title="Темы недоступны" description={topicsError} onAction={onRetry} />
          ) : isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="rounded-xl border border-border/70 bg-secondary/40 px-3 py-3">
                  <Skeleton className="h-5 w-full rounded-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {topics.map((topic) => {
                const isActive = activeTopic === topic.slug;

                return (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => {
                      onSelect(topic.slug);
                      onOpenChange(false);
                    }}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition',
                      isActive ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'bg-secondary/60 text-foreground hover:bg-secondary',
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <Hash className="h-4 w-4" />
                      {topic.name}
                    </span>
                    <span className={cn('rounded-full px-2.5 py-1 text-[11px]', isActive ? 'bg-white/15 text-white' : 'bg-background/70 text-muted-foreground')}>
                      {topic.count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </SheetContent>
      </Sheet>
      <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
    </>
  );
}
