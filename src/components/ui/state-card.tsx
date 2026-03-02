import type { ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type StateCardProps = {
  actionLabel?: string;
  description: string;
  icon?: ReactNode;
  onAction?: () => void;
  title: string;
};

export function StateCard({ actionLabel = 'Try again', description, icon, onAction, title }: StateCardProps) {
  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader className="items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          {icon ?? <AlertTriangle className="h-5 w-5" />}
        </div>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-center">
        <p className="mx-auto max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>
        {onAction ? (
          <Button variant="secondary" className="mt-6" onClick={onAction}>
            <RefreshCw className="h-4 w-4" />
            {actionLabel}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
