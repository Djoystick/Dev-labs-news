import { Hash, House, PencilLine, Search, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent } from '@/components/ui/sheet';
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
  const { isAdmin, isAuthed } = useAuth();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="safe-pt">
        <div className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => onSearchChange(event.target.value)}
              className="h-10 rounded-2xl border-border/70 bg-background/85 pl-11"
              placeholder="Search"
            />
          </div>
          <div className="grid gap-2">
            <Button asChild variant="ghost" size="sm" className="h-9 justify-start rounded-xl px-3">
              <Link to="/" onClick={() => onOpenChange(false)}>
                <House className="h-4 w-4" />
                Home
              </Link>
            </Button>
            {isAdmin ? (
              <Button asChild variant="ghost" size="sm" className="h-9 justify-start rounded-xl px-3">
                <Link to="/admin/new" onClick={() => onOpenChange(false)}>
                  <PencilLine className="h-4 w-4" />
                  New post
                </Link>
              </Button>
            ) : null}
            {isAuthed ? (
              <Button asChild variant="ghost" size="sm" className="h-9 justify-start rounded-xl px-3">
                <Link to="/profile" onClick={() => onOpenChange(false)}>
                  <UserRound className="h-4 w-4" />
                  Profile
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
        <div className="mb-3 mt-6 flex items-center justify-between px-1">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Topics</p>
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
            All
          </Button>
        </div>
        {topicsError ? (
          <StateCard title="Topics unavailable" description={topicsError} onAction={onRetry} />
        ) : isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="rounded-2xl border border-border/70 bg-secondary/40 px-4 py-3">
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
  );
}
