import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { PublicationRule } from '@/types/db';

type PublicationRulesModalProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  rules: PublicationRule | null;
};

export function PublicationRulesModal({ onOpenChange, open, rules }: PublicationRulesModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Правила публикаций</DialogTitle>
          <DialogDescription>
            {rules ? `Версия ${rules.version}, обновлено ${new Date(rules.updated_at).toLocaleString('ru-RU')}` : 'Правила недоступны.'}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto rounded-[1.25rem] border border-border/70 bg-background/70 px-4 py-4 text-sm leading-7 whitespace-pre-wrap">
          {rules?.content_md?.trim() || 'Правила пока не заполнены.'}
        </div>
        <div className="flex justify-end">
          <Button type="button" onClick={() => onOpenChange(false)}>
            Понятно
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
