import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TOPIC_LABELS, topicKeys, topicLabels, type TopicFilterState, type TopicKey } from '@/features/topics/model';

type TopicsFilterProps = {
  selectedTopics: TopicFilterState;
  enabledCount: number;
  onToggle: (key: TopicKey, value: boolean) => void;
  onReset: () => void;
};

function FilterSwitch({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'flex min-h-11 w-full items-center justify-between gap-3 rounded-[1.25rem] border border-border/70 bg-background/80 px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background',
        checked ? 'shadow-[0_16px_36px_-28px_rgba(8,145,209,0.8)]' : 'opacity-90',
      )}
    >
      <span className="pr-2 text-sm font-semibold leading-5 text-foreground">{label}</span>
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
    </button>
  );
}

export function TopicsFilter({ selectedTopics, enabledCount, onToggle, onReset }: TopicsFilterProps) {
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
            {enabledCount} из {TOPIC_LABELS.length} включено
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid gap-3 md:grid-cols-2">
          {topicKeys.map((key) => (
            <FilterSwitch key={key} checked={selectedTopics[key]} label={topicLabels[key]} onChange={(value) => onToggle(key, value)} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
