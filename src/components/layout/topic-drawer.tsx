import { Hash } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { Topic } from '@/types/topic';

type TopicDrawerProps = {
  activeTopic: string;
  onOpenChange: (open: boolean) => void;
  onSelect: (slug: string) => void;
  open: boolean;
  topics: Topic[];
};

export function TopicDrawer({ activeTopic, onOpenChange, onSelect, open, topics }: TopicDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="safe-pt">
        <div className="mb-8 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">Topics</p>
          <h2 className="text-2xl font-extrabold">Focus the feed</h2>
          <p className="text-sm text-muted-foreground">Quick client-side filtering for the MVP feed. Supabase topics replace this seed set in Stage 3.</p>
        </div>
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
                  'flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition',
                  isActive ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'bg-secondary/60 text-foreground hover:bg-secondary',
                )}
              >
                <Hash className="h-4 w-4" />
                {topic.name}
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
