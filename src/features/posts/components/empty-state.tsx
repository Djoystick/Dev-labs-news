import { SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="rounded-[2rem] border border-dashed border-border bg-card/70 px-6 py-16 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        <SearchX className="h-6 w-6" />
      </div>
      <h2 className="mt-5 text-2xl font-extrabold">No posts match the current filter</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
        Reset the query or switch topic to bring back the seeded feed. Real Supabase results replace this state in Stage 3.
      </p>
      <Button variant="secondary" className="mt-6" onClick={onReset}>
        Reset filters
      </Button>
    </div>
  );
}
