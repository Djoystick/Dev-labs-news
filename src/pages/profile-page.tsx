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
      return 'РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ';
    }

    return normalizeHandle(profile.full_name?.trim() || getProfileDisplayName(profile, user?.email) || 'РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ');
  }, [profile, telegramUser, user?.email]);

  const avatarUrl = useMemo(() => getTelegramAvatarUrl(telegramUser) ?? profile?.avatar_url ?? null, [profile?.avatar_url, telegramUser]);
  const isAdminUser = profile?.role === 'admin';
  const canManageOwnPosts = profile?.role === 'admin' || profile?.role === 'editor';
  const isTeamMember = profile?.role === 'admin' || profile?.role === 'editor';
  const roleLabel = profile?.role === 'admin' ? 'РђРґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂ' : profile?.role === 'editor' ? 'Р РµРґР°РєС‚РѕСЂ' : 'Р§РёС‚Р°С‚РµР»СЊ';

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
            РќР°Р·Р°Рґ
          </Button>
          <StateCard title="РќСѓР¶РµРЅ РІС…РѕРґ" description="Р’РѕР№РґРёС‚Рµ, С‡С‚РѕР±С‹ СѓРїСЂР°РІР»СЏС‚СЊ Р°РєРєР°СѓРЅС‚РѕРј, СЃРѕС…СЂР°РЅС‘РЅРЅС‹РјРё РјР°С‚РµСЂРёР°Р»Р°РјРё Рё СЂР°Р·РґРµР»Р°РјРё." />
          <div className="flex gap-3">
            <Button onClick={() => setAuthDialogOpen(true)}>Р’РѕР№С‚Рё</Button>
            <Button variant="outline" onClick={() => navigate('/')}>
              РќР° РіР»Р°РІРЅСѓСЋ
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
                <span className="sr-only">РќР°Р·Р°Рґ</span>
              </Button>
              <h1 className="text-3xl font-extrabold">РђРєРєР°СѓРЅС‚</h1>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => navigate('/topic-preferences')}>
              <Settings className="h-5 w-5" />
              <span className="sr-only">РќР°СЃС‚СЂРѕР№РєРё СЂР°Р·РґРµР»РѕРІ</span>
            </Button>
          </div>
          <div className="mt-4 flex items-center justify-between gap-4 py-2">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Р—РґСЂР°РІСЃС‚РІСѓР№С‚Рµ,</p>
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
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Р’Р°С€Рµ</p>
          <div className="mt-2 divide-y divide-border/60">
            <AccountRow icon={<Bookmark className="h-4 w-4" />} label="РЎРѕС…СЂР°РЅС‘РЅРЅС‹Рµ СЃС‚Р°С‚СЊРё" onClick={() => navigate('/saved-articles')} />
            {canManageOwnPosts ? <AccountRow icon={<FilePenLine className="h-4 w-4" />} label="РњРѕРё РїСѓР±Р»РёРєР°С†РёРё" onClick={() => navigate('/my-posts')} /> : null}
          </div>
        </FlatSection>

        <FlatSection className="pt-2">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">РќР°СЃС‚СЂРѕР№РєРё</p>
          <div className="mt-2 divide-y divide-border/60">
            <AccountRow icon={<Settings2 className="h-4 w-4" />} label="РќР°СЃС‚СЂРѕР№РєРё СЂР°Р·РґРµР»РѕРІ" onClick={() => navigate('/topic-preferences')} />
            <AccountRow
              icon={<MoonStar className="h-4 w-4" />}
              label="Р¦РІРµС‚РѕРІР°СЏ СЃС…РµРјР°"
              value={theme === 'dark' ? 'РЎРІРµС‚Р»Р°СЏ' : 'РўС‘РјРЅР°СЏ'}
              onClick={toggleTheme}
            />
          </div>
        </FlatSection>

        {isAdminUser ? (
          <FlatSection className="pt-2">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">РђР”РњРРќ</p>
            <div className="mt-2 divide-y divide-border/60">
              <AccountRow icon={<Users className="h-4 w-4" />} label="Р РѕР»Рё РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№" onClick={() => navigate('/admin/users')} />
              <AccountRow icon={<ScrollText className="h-4 w-4" />} label="РџСЂР°РІРёР»Р° РїСѓР±Р»РёРєР°С†РёР№" onClick={() => navigate('/admin/publication-rules')} />
            </div>
          </FlatSection>
        ) : null}

        <FlatSection className="pt-2 border-b-0">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">РђРєРєР°СѓРЅС‚</p>
          <div className="mt-2 divide-y divide-border/60">
            <AccountRow
              icon={<LogOut className="h-4 w-4" />}
              label={signOutBusy ? 'Р’С‹С…РѕРґРёРј...' : 'Р’С‹Р№С‚Рё'}
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
