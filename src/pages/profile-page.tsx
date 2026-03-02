import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Container } from '@/components/layout/container';
import { AuthDialog } from '@/components/auth/auth-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { StateCard } from '@/components/ui/state-card';
import { useAuth } from '@/providers/auth-provider';

function getInitials(value: string | null | undefined) {
  if (!value) {
    return 'DL';
  }

  return value
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function ProfilePage() {
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const { isAuthed, loading, profile, session, user } = useAuth();

  if (loading) {
    return (
      <Container className="safe-pb py-10">
        <div className="mx-auto max-w-3xl space-y-4">
          <Skeleton className="h-12 w-40 rounded-full" />
          <Skeleton className="h-80 w-full rounded-[1.75rem]" />
        </div>
      </Container>
    );
  }

  if (!isAuthed || !user) {
    return (
      <Container className="safe-pb py-10">
        <StateCard title="Profile requires sign-in" description="Sign in with Email/Password for local development or use Telegram sign-in when the Mini App is opened inside Telegram." />
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={() => setAuthDialogOpen(true)}>Open auth</Button>
          <Button asChild variant="outline">
            <Link to="/">Back to feed</Link>
          </Button>
        </div>
        <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
      </Container>
    );
  }

  const displayName = profile?.full_name ?? profile?.username ?? user.email ?? 'User';

  return (
    <Container className="safe-pb py-10">
      <Card className="mx-auto max-w-4xl overflow-hidden">
        <CardHeader className="border-b border-border/70 bg-secondary/40">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={profile?.avatar_url ?? undefined} alt={displayName} />
                <AvatarFallback className="text-lg">{getInitials(displayName)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Profile</p>
                <CardTitle className="mt-2 text-3xl">{displayName}</CardTitle>
                <p className="mt-2 text-sm text-muted-foreground">{user.email ?? 'Telegram-only account'}</p>
              </div>
            </div>
            <div className="rounded-full border border-border bg-background/80 px-4 py-2 text-sm font-semibold">
              Role: {profile?.role ?? 'user'}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-[1.5rem] border border-border/70 bg-background/80 p-5">
              <h2 className="text-lg font-bold">Identity</h2>
              <Separator className="my-4" />
              <dl className="space-y-4 text-sm">
                <div>
                  <dt className="font-semibold text-muted-foreground">User ID</dt>
                  <dd className="mt-1 break-all">{user.id}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-muted-foreground">Email</dt>
                  <dd className="mt-1 break-all">{user.email ?? 'n/a'}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-muted-foreground">Created at</dt>
                  <dd className="mt-1">{profile?.created_at ? new Date(profile.created_at).toLocaleString() : 'n/a'}</dd>
                </div>
              </dl>
            </div>
            <div className="rounded-[1.5rem] border border-border/70 bg-background/80 p-5">
              <h2 className="text-lg font-bold">Profile row</h2>
              <Separator className="my-4" />
              <dl className="space-y-4 text-sm">
                <div>
                  <dt className="font-semibold text-muted-foreground">Role</dt>
                  <dd className="mt-1">{profile?.role ?? 'user'}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-muted-foreground">Telegram ID</dt>
                  <dd className="mt-1 break-all">{profile?.telegram_id ?? 'Not linked yet'}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-muted-foreground">Username</dt>
                  <dd className="mt-1">{profile?.username ?? 'n/a'}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-muted-foreground">Session expires at</dt>
                  <dd className="mt-1">{session?.expires_at ? new Date(session.expires_at * 1000).toLocaleString() : 'n/a'}</dd>
                </div>
              </dl>
            </div>
          </div>
        </CardContent>
      </Card>
    </Container>
  );
}
