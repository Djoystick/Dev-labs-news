import type { ReactNode } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Container } from '@/components/layout/container';
import { AppLink } from '@/components/ui/app-link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StateCard } from '@/components/ui/state-card';
import { useAuth } from '@/providers/auth-provider';

export function AdminGuard({ children }: { children: ReactNode }) {
  const { isAdmin, isAuthed, loading } = useAuth();

  if (loading) {
    return (
      <Container className="safe-pb py-10">
        <div className="mx-auto max-w-3xl space-y-4">
          <Skeleton className="h-12 w-52 rounded-full" />
          <Skeleton className="h-56 w-full rounded-[1.75rem]" />
        </div>
      </Container>
    );
  }

  if (!isAuthed || !isAdmin) {
    return (
      <Container className="safe-pb py-10">
        <StateCard
          title="No admin access"
          description="Эта страница доступна только администраторам."
          icon={<ShieldAlert className="h-5 w-5" />}
        />
        <div className="mt-6 flex justify-center">
          <Button asChild variant="outline">
            <AppLink to="/">Back to feed</AppLink>
          </Button>
        </div>
      </Container>
    );
  }

  return <>{children}</>;
}
