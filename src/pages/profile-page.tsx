import { ArrowLeft, Bookmark, ChevronRight, FilePenLine, LogOut, MoonStar, ScrollText, Settings, Settings2, Users } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthDialog } from '@/components/auth/auth-dialog';
import { FlatPage, FlatSection } from '@/components/layout/flat';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
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
    <button type="button" onClick={onClick} className="flex w-full items-center gap-4 py-3 text-left transition hover:bg-secondary/30">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center text-foreground">{icon}</span>
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
      return '\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C';
    }

    return normalizeHandle(profile.full_name?.trim() || getProfileDisplayName(profile, user?.email) || '\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C');
  }, [profile, telegramUser, user?.email]);

  const avatarUrl = useMemo(() => getTelegramAvatarUrl(telegramUser) ?? profile?.avatar_url ?? null, [profile?.avatar_url, telegramUser]);
  const isAdminUser = profile?.role === 'admin';
  const canManageOwnPosts = profile?.role === 'admin' || profile?.role === 'editor';
  const isTeamMember = profile?.role === 'admin' || profile?.role === 'editor';
  const roleLabel = profile?.role === 'admin' ? '\u0410\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440' : profile?.role === 'editor' ? '\u0420\u0435\u0434\u0430\u043A\u0442\u043E\u0440' : '\u0427\u0438\u0442\u0430\u0442\u0435\u043B\u044C';

  if (loading) {
    return (
      <FlatPage className="safe-pb py-6 sm:py-8">
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-8 w-32 rounded-full" />
          </div>
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </FlatPage>
    );
  }

  if (!isAuthed || !user || !profile) {
    return (
      <FlatPage className="safe-pb py-6 sm:py-8">
        <div className="space-y-4">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
            {'\u041D\u0430\u0437\u0430\u0434'}
          </Button>
          <StateCard title="\u041D\u0443\u0436\u0435\u043D \u0432\u0445\u043E\u0434" description="\u0412\u043E\u0439\u0434\u0438\u0442\u0435, \u0447\u0442\u043E\u0431\u044B \u0443\u043F\u0440\u0430\u0432\u043B\u044F\u0442\u044C \u0430\u043A\u043A\u0430\u0443\u043D\u0442\u043E\u043C, \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u043C\u0438 \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u0430\u043C\u0438 \u0438 \u0440\u0430\u0437\u0434\u0435\u043B\u0430\u043C\u0438." />
          <div className="flex gap-3">
            <Button onClick={() => setAuthDialogOpen(true)}>{'\u0412\u043E\u0439\u0442\u0438'}</Button>
            <Button variant="outline" onClick={() => navigate('/')}>
              {'\u041D\u0430 \u0433\u043B\u0430\u0432\u043D\u0443\u044E'}
            </Button>
          </div>
          <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
        </div>
      </FlatPage>
    );
  }

  return (
    <FlatPage className="safe-pb py-6 sm:py-8">
      <div className="space-y-2">
        <FlatSection className="pt-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button type="button" variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-5 w-5" />
                <span className="sr-only">{'\u041D\u0430\u0437\u0430\u0434'}</span>
              </Button>
              <h1 className="text-3xl font-extrabold">{'\u0410\u043A\u043A\u0430\u0443\u043D\u0442'}</h1>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => navigate('/topic-preferences')}>
              <Settings className="h-5 w-5" />
              <span className="sr-only">{'\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u0440\u0430\u0437\u0434\u0435\u043B\u043E\u0432'}</span>
            </Button>
          </div>
          <div className="mt-4 flex items-center justify-between gap-4 py-2">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">{'\u0417\u0434\u0440\u0430\u0432\u0441\u0442\u0432\u0443\u0439\u0442\u0435,'}</p>
              <h2 className="mt-1 text-2xl font-extrabold">{displayName}</h2>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {isTeamMember ? <span className="px-3 py-1 text-xs font-semibold text-primary">DevLabs Team</span> : null}
                <span className="px-3 py-1 text-xs font-semibold text-foreground">{roleLabel}</span>
              </div>
            </div>
            <Avatar className="h-16 w-16 rounded-full">
              <AvatarImage src={avatarUrl ?? undefined} alt={displayName} />
              <AvatarFallback className="text-xl">{getInitial(displayName)}</AvatarFallback>
            </Avatar>
          </div>
        </FlatSection>

        <FlatSection className="pt-2">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">{'\u0412\u0430\u0448\u0435'}</p>
          <div className="mt-2 divide-y divide-border/60">
            <AccountRow icon={<Bookmark className="h-4 w-4" />} label="\u0421\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0435 \u0441\u0442\u0430\u0442\u044C\u0438" onClick={() => navigate('/saved-articles')} />
            {canManageOwnPosts ? <AccountRow icon={<FilePenLine className="h-4 w-4" />} label="\u041C\u043E\u0438 \u043F\u0443\u0431\u043B\u0438\u043A\u0430\u0446\u0438\u0438" onClick={() => navigate('/my-posts')} /> : null}
          </div>
        </FlatSection>

        <FlatSection className="pt-2">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">{'\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438'}</p>
          <div className="mt-2 divide-y divide-border/60">
            <AccountRow icon={<Settings2 className="h-4 w-4" />} label="\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u0440\u0430\u0437\u0434\u0435\u043B\u043E\u0432" onClick={() => navigate('/topic-preferences')} />
            <AccountRow
              icon={<MoonStar className="h-4 w-4" />}
              label="\u0426\u0432\u0435\u0442\u043E\u0432\u0430\u044F \u0441\u0445\u0435\u043C\u0430"
              value={theme === 'dark' ? '\u0421\u0432\u0435\u0442\u043B\u0430\u044F' : '\u0422\u0451\u043C\u043D\u0430\u044F'}
              onClick={toggleTheme}
            />
          </div>
        </FlatSection>

        {isAdminUser ? (
          <FlatSection className="pt-2">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">{'\u0410\u0414\u041C\u0418\u041D'}</p>
            <div className="mt-2 divide-y divide-border/60">
              <AccountRow icon={<Users className="h-4 w-4" />} label="\u0420\u043E\u043B\u0438 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u0435\u0439" onClick={() => navigate('/admin/users')} />
              <AccountRow icon={<ScrollText className="h-4 w-4" />} label="\u041F\u0440\u0430\u0432\u0438\u043B\u0430 \u043F\u0443\u0431\u043B\u0438\u043A\u0430\u0446\u0438\u0439" onClick={() => navigate('/admin/publication-rules')} />
            </div>
          </FlatSection>
        ) : null}

        <FlatSection className="pt-2 border-b-0">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">{'\u0410\u043A\u043A\u0430\u0443\u043D\u0442'}</p>
          <div className="mt-2 divide-y divide-border/60">
            <AccountRow
              icon={<LogOut className="h-4 w-4" />}
              label={signOutBusy ? '\u0412\u044B\u0445\u043E\u0434\u0438\u043C...' : '\u0412\u044B\u0439\u0442\u0438'}
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
        </FlatSection>
      </div>
    </FlatPage>
  );
}
