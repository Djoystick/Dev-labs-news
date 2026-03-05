import { FlatPage } from '@/components/layout/flat';

export function SupportPage() {
  return (
    <FlatPage className="py-6 sm:py-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold">Поддержка</h1>
        <p className="text-sm text-muted-foreground">В разработке</p>
      </div>
    </FlatPage>
  );
}
