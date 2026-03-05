import { SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';

type EmptyStateProps = {
  actionLabel?: string;
  description?: string;
  onReset: () => void;
  title?: string;
};

export function EmptyState({
  actionLabel = '\u0421\u0431\u0440\u043E\u0441\u0438\u0442\u044C \u0444\u0438\u043B\u044C\u0442\u0440\u044B',
  description = '\u0421\u0431\u0440\u043E\u0441\u044C\u0442\u0435 \u043F\u043E\u0438\u0441\u043A \u0438\u043B\u0438 \u0432\u043A\u043B\u044E\u0447\u0438\u0442\u0435 \u0434\u0440\u0443\u0433\u0438\u0435 \u0444\u0438\u043B\u044C\u0442\u0440\u044B, \u0447\u0442\u043E\u0431\u044B \u0441\u043D\u043E\u0432\u0430 \u0443\u0432\u0438\u0434\u0435\u0442\u044C \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u044B.',
  onReset,
  title = '\u041D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E',
}: EmptyStateProps) {
  return (
    <div className="border-y border-border/60 py-6">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center text-muted-foreground">
          <SearchX className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-2xl font-extrabold">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
          <Button variant="ghost" className="mt-3 h-8 px-2" onClick={onReset}>
            {actionLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
