import type { ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

type StateCardProps = {
  actionLabel?: string;
  description: string;
  icon?: ReactNode;
  onAction?: () => void;
  title: string;
};

export function StateCard({ actionLabel = 'РџРѕРІС‚РѕСЂРёС‚СЊ', description, icon, onAction, title }: StateCardProps) {
  return (
    <div className="border-y border-border/60 py-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center text-muted-foreground">
          {icon ?? <AlertTriangle className="h-5 w-5" />}
        </div>
        <div className="min-w-0">
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
          {onAction ? (
            <Button variant="ghost" className="mt-3 h-8 px-2" onClick={onAction}>
              <RefreshCw className="h-4 w-4" />
              {actionLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
