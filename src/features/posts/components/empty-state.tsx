import { SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';

type EmptyStateProps = {
  actionLabel?: string;
  description?: string;
  onReset: () => void;
  title?: string;
};

export function EmptyState({
  actionLabel = 'РЎР±СЂРѕСЃРёС‚СЊ С„РёР»СЊС‚СЂС‹',
  description = 'РЎР±СЂРѕСЃСЊС‚Рµ РїРѕРёСЃРє РёР»Рё РІРєР»СЋС‡РёС‚Рµ РґСЂСѓРіРёРµ С„РёР»СЊС‚СЂС‹, С‡С‚РѕР±С‹ СЃРЅРѕРІР° СѓРІРёРґРµС‚СЊ РјР°С‚РµСЂРёР°Р»С‹.',
  onReset,
  title = 'РќРёС‡РµРіРѕ РЅРµ РЅР°Р№РґРµРЅРѕ',
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
