import { ArrowLeft, Bookmark, ChevronRight, FilePenLine, LogOut, MoonStar, Settings, Settings2 } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthDialog } from '@/components/auth/auth-dialog';
import { Container } from '@/components/layout/container';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { StateCard } from '@/components/ui/state-card';
import { getProfileDisplayName, normalizeHandle } from '@/features/profile/api';
import { getTelegramAvatarUrl, getTelegramDisplayName, getTelegramUser } from '@/lib/telegram-user';
import { useAuth } from '@/providers/auth-provider';
import { useTheme } from '@/providers/theme-provider';

function getInitial(value: string | null | undefined) {
  if (!value) {
    return 'D';
  }

  return normalizeHandle(value).trim().charAt(0).toUpperCase() || 'D';
}

function AccountRow({
  icon,
  label,
  onClick,
  value,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  value?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-[1.25rem] px-1 py-3 text-left transition hover:bg-secondary/50"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-background/80 text-foreground">
        {icon}
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="font-semibold leading-tight">{label}</p>
        {value ? <p className="truncate whitespace-nowrap text-sm leading-tight text-muted-foreground">{value}</p> : null}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

export function ProfilePage() {
  const navigate = useNavigate();
  const { isAuthed, loading, profile, signOut, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [signOutBusy, setSignOutBusy] = useState(false);
  const telegramUser = useMemo(() => getTelegramUser(), []);

  const displayName = useMemo(() => {
    const telegramName = getTelegramDisplayName(telegramUser);

    if (telegramName) {
      return telegramName;
    }

    if (!profile) {
      return 'Пользователь';
    }

    return normalizeHandle(profile.full_name?.trim() || getProfileDisplayName(profile, user?.email) || 'Пользователь');
  }, [profile, telegramUser, user?.email]);

  const avatarUrl = useMemo(() => getTelegramAvatarUrl(telegramUser) ?? profile?.avatar_url ?? null, [profile?.avatar_url, telegramUser]);
  const canManageOwnPosts = profile?.role === 'admin' || profile?.role === 'editor';
  const isTeamMember = profile?.role === 'admin' || profile?.role === 'editor';
  const roleLabel = profile?.role === 'admin' ? 'Администратор' : profile?.role === 'editor' ? 'Редактор' : 'Читатель';

  if (loading) {
    return (
      <Container className="safe-pb py-6 sm:py-8">
        <div className="mx-auto max-w-3xl space-y-5">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-8 w-32 rounded-full" />
          </div>
          <Skeleton className="h-44 w-full rounded-[2rem]" />
          <Skeleton className="h-64 w-full rounded-[2rem]" />
        </div>
      </Container>
    );
  }

  if (!isAuthed || !user || !profile) {
    return (
      <Container className="safe-pb py-6 sm:py-8">
        <div className="mx-auto max-w-3xl space-y-4">
          <Button type="button" variant="ghost" className="rounded-full" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
            Назад
          </Button>
          <StateCard title="Нужен вход" description="Войдите, чтобы управлять аккаунтом, сохранёнными материалами и темами." />
          <div className="flex gap-3">
            <Button onClick={() => setAuthDialogOpen(true)}>Войти</Button>
            <Button variant="outline" onClick={() => navigate('/')}>
              На главную
            </Button>
          </div>
          <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
        </div>
      </Container>
    );
  }

  return (
    <Container className="safe-pb py-6 sm:py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button type="button" variant="ghost" size="icon" className="rounded-full" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Назад</span>
            </Button>
            <h1 className="text-3xl font-extrabold">Аккаунт</h1>
          </div>
          <Button type="button" variant="ghost" size="icon" className="rounded-full" onClick={() => navigate('/topic-preferences')}>
            <Settings className="h-5 w-5" />
            <span className="sr-only">Настройки разделов</span>
          </Button>
        </div>

        <Card className="overflow-hidden border-border/70 bg-card/85 shadow-[0_30px_80px_-46px_rgba(15,23,42,0.5)]">
          <CardContent className="flex items-center justify-between gap-4 p-6">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Здравствуйте,</p>
              <h2 className="mt-1 text-2xl font-extrabold">{displayName}</h2>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {isTeamMember ? (
                  <span className="rounded-full border border-primary/30 bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">DevLabs Team</span>
                ) : null}
                <span className="rounded-full border border-border/70 bg-secondary/60 px-3 py-1 text-xs font-semibold text-foreground">{roleLabel}</span>
              </div>
            </div>
            <Avatar className="h-16 w-16 rounded-full border-border/70 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.55)]">
              <AvatarImage src={avatarUrl ?? undefined} alt={displayName} />
              <AvatarFallback className="text-xl">{getInitial(displayName)}</AvatarFallback>
            </Avatar>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/85">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Ваше</p>
                <div className="mt-3 space-y-1">
                  <AccountRow icon={<Bookmark className="h-4 w-4" />} label="Сохранённые статьи" onClick={() => navigate('/saved-articles')} />
                  {canManageOwnPosts ? <AccountRow icon={<FilePenLine className="h-4 w-4" />} label="Мои публикации" onClick={() => navigate('/my-posts')} /> : null}
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Настройки</p>
                <div className="mt-3 space-y-1">
                  <AccountRow icon={<Settings2 className="h-4 w-4" />} label="Настройки разделов" onClick={() => navigate('/topic-preferences')} />
                  <AccountRow
                    icon={<MoonStar className="h-4 w-4" />}
                    label="Цветовая схема"
                    value={theme === 'dark' ? 'Светлая' : 'Тёмная'}
                    onClick={toggleTheme}
                  />
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Аккаунт</p>
                <div className="mt-3">
                  <AccountRow
                    icon={<LogOut className="h-4 w-4" />}
                    label={signOutBusy ? 'Выходим...' : 'Выйти'}
                    onClick={async () => {
                      if (signOutBusy) {
                        return;
                      }

                      setSignOutBusy(true);
                      try {
                        await signOut();
                        navigate('/', { replace: true });
                      } finally {
                        setSignOutBusy(false);
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
