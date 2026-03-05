import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { topicKeys, topicLabels, type TopicFilterState, type TopicKey } from '@/features/topics/model';

type TopicsFilterProps = {
  selectedTopics: TopicFilterState;
  enabledCount: number;
  onToggle: (key: TopicKey, value: boolean) => void;
  onReset: () => void;
  topics?: Array<{ key: TopicKey; label: string }>;
  totalCount?: number;
  variant?: 'card' | 'compact';
};

function FilterSwitch({ checked, compact = false, label, onChange }: { checked: boolean; compact?: boolean; label: string; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'flex min-h-11 w-full items-center gap-3 border border-border/70 bg-background/80 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background',
        compact ? 'h-auto min-h-[56px] rounded-[1rem] px-3 py-2' : 'h-auto min-h-[56px] rounded-[1.25rem] px-4 py-3',
        checked ? 'shadow-[0_16px_36px_-28px_rgba(8,145,209,0.8)]' : 'opacity-90',
      )}
    >
      <span className="min-w-0 flex-1 pr-1">
        <span className={cn('block font-semibold text-foreground', compact ? 'text-[13px] leading-snug break-words line-clamp-2' : 'text-sm leading-snug break-words line-clamp-2')}>
          {label}
        </span>
      </span>
      <span className="flex shrink-0 items-center justify-end">
        <span
          aria-hidden
          className={cn(
            'relative h-7 w-12 shrink-0 rounded-full border transition',
            checked ? 'border-primary/30 bg-primary/20' : 'border-border bg-secondary',
          )}
        >
          <span
            className={cn(
              'absolute top-1 h-5 w-5 rounded-full shadow-sm transition',
              checked ? 'left-6 bg-primary' : 'left-1 bg-muted-foreground/70',
            )}
          />
        </span>
      </span>
    </button>
  );
}

export function TopicsFilter({ selectedTopics, enabledCount, onToggle, onReset, topics, totalCount, variant = 'card' }: TopicsFilterProps) {
  const filterItems = topics ?? topicKeys.map((key) => ({ key, label: topicLabels[key] }));
  const enabledTotal = totalCount ?? filterItems.length;

  if (variant === 'compact') {
    return (
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-2">
          <span className="flex h-11 items-center justify-center rounded-full border border-border bg-background/80 px-3 py-2 text-center text-[12px] font-semibold leading-none">
            {enabledCount} из {enabledTotal} включено
          </span>
          <Button type="button" variant="outline" className="h-11 px-3 py-2 text-[12px]" onClick={onReset}>
            <RotateCcw className="h-4 w-4" />
            Сбросить
          </Button>
        </div>
        <div className="grid auto-rows-fr grid-cols-2 gap-2">
          {filterItems.map(({ key, label }) => (
            <FilterSwitch key={key} checked={selectedTopics[key]} compact label={label} onChange={(value) => onToggle(key, value)} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <Card className="border-border/70 bg-card/85">
      <CardHeader className="gap-4 pb-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Topics Filter</p>
            <CardTitle className="mt-2 text-2xl sm:text-3xl">Технологические темы</CardTitle>
          </div>
          <Button type="button" variant="outline" className="min-h-11 px-4" onClick={onReset}>
            <RotateCcw className="h-4 w-4" />
            Сбросить
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded-full border border-border bg-background/80 px-3 py-1.5 font-semibold">
            {enabledCount} из {enabledTotal} включено
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid gap-3 md:grid-cols-2">
          {filterItems.map(({ key, label }) => (
            <FilterSwitch key={key} checked={selectedTopics[key]} label={label} onChange={(value) => onToggle(key, value)} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
