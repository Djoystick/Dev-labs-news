import { useEffect, type ReactNode } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Container } from '@/components/layout/container';
import { AppLink } from '@/components/ui/app-link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StateCard } from '@/components/ui/state-card';
import { useAuth } from '@/providers/auth-provider';

type AdminGuardProps = {
  allowEditor?: boolean;
  children: ReactNode;
};

export function AdminGuard({ allowEditor = false, children }: AdminGuardProps) {
  const { isAdmin, isAuthed, loading, profile } = useAuth();
  const hasAccess = isAdmin || (allowEditor && profile?.role === 'editor');
  const accessTitle = allowEditor ? 'Editor access required' : 'Admin access required';
  const accessDescription = allowEditor ? 'This page is available to editors and admins.' : 'This page is available only to admins.';

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    console.debug('[AdminGuard] role check', {
      allowEditor,
      hasAccess,
      isAdmin,
      isAuthed,
      profileRole: profile?.role ?? null,
      source: 'profile.role',
    });
  }, [allowEditor, hasAccess, isAdmin, isAuthed, profile?.role]);

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

  if (!isAuthed || !hasAccess) {
    return (
      <Container className="safe-pb py-10">
        <StateCard title={accessTitle} description={accessDescription} icon={<ShieldAlert className="h-5 w-5" />} />
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
