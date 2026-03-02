import { Hash } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { StateCard } from '@/components/ui/state-card';
import { cn } from '@/lib/utils';
import type { Topic } from '@/types/db';

type TopicDrawerProps = {
  activeTopic: string;
  isLoading: boolean;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
  onSelect: (slug: string) => void;
  open: boolean;
  topics: Array<Topic & { count: number }>;
  topicsError: string | null;
};

export function TopicDrawer({ activeTopic, isLoading, onOpenChange, onRetry, onSelect, open, topics, topicsError }: TopicDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="safe-pt">
        <div className="mb-8 rounded-[1.75rem] border border-border/70 bg-card/80 p-5 shadow-[0_24px_60px_-36px_rgba(8,145,209,0.65)]">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">Topics</p>
          <h2 className="mt-2 text-2xl font-extrabold">Focus the feed</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Switch between editorial streams instantly. Topics are loaded from Supabase and filtered locally in the feed UI.</p>
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
                    'flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition',
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
