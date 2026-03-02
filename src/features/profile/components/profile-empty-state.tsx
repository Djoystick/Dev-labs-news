import { Bookmark, Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

type ProfileEmptyStateProps = {
  description: string;
  mode: 'favorites' | 'history';
};

export function ProfileEmptyState({ description, mode }: ProfileEmptyStateProps) {
  return (
    <div className="rounded-[1.75rem] border border-dashed border-border bg-card/70 px-6 py-12 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        {mode === 'favorites' ? <Bookmark className="h-6 w-6" /> : <Clock3 className="h-6 w-6" />}
      </div>
      <h3 className="mt-4 text-xl font-bold">{mode === 'favorites' ? 'В избранном пока пусто' : 'История пока пуста'}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      <Button asChild variant="secondary" className="mt-5">
        <Link to="/">Перейти к новостям</Link>
      </Button>
    </div>
  );
}
