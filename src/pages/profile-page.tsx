import { Activity, ArrowLeft, Bookmark, Bug, ChevronRight, EyeOff, FilePenLine, History, Info, LifeBuoy, LogOut, MoonStar, Rss, ScrollText, Settings2, SlidersHorizontal, Sparkles, Trash2, Users } from 'lucide-react';
import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AuthDialog } from '@/components/auth/auth-dialog';
import { FlatPage, FlatSection } from '@/components/layout/flat';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StateCard } from '@/components/ui/state-card';
import { getProfileDisplayName, normalizeHandle, updateForYouDigestSettings } from '@/features/profile/api';
import { useReadingProgress } from '@/features/reading/reading-progress';
import { getTelegramAvatarProxyUrl, getTelegramPhotoUrlProxy } from '@/lib/telegram-avatar';
import { getTelegramWebApp, telegramFullscreenStorageKey } from '@/lib/telegram';
import { getTelegramDisplayName, getTelegramUser } from '@/lib/telegram-user';
import { getPostPath } from '@/lib/post-links';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import { useTheme } from '@/providers/theme-provider';

type DigestThreshold = 10 | 20 | 30;
const digestThresholdOptions: DigestThreshold[] = [10, 20, 30];

function normalizeDigestThreshold(value: number | null | undefined): DigestThreshold {
  return value === 20 || value === 30 ? value : 10;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message.trim();
    }
  }

  return fallback;
}

function getInitial(value: string | null | undefined) {
  if (!value) {
    return 'D';
  }

  return normalizeHandle(value).trim().charAt(0).toUpperCase() || 'D';
}

function formatContinueReadingDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
  });
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <p className="mb-2 mt-4 text-xs font-bold uppercase tracking-[0.24em] text-cyan-300/80">{children}</p>;
}

type ProfileRowProps = {
  icon: ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  onClick?: () => void;
  to?: string;
  right?: ReactNode;
  titleClassName?: string;
  iconClassName?: string;
};

function ProfileRow({ icon: Icon, title, subtitle, onClick, to, right, titleClassName, iconClassName }: ProfileRowProps) {
  const rowClassName = 'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5 active:bg-white/10';
  const content = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5">
        <Icon className={cn('h-5 w-5 text-white/80', iconClassName)} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn('text-base font-medium leading-tight text-white', titleClassName)}>{title}</p>
        {subtitle ? <p className="mt-0.5 truncate whitespace-nowrap text-xs leading-tight text-white/60">{subtitle}</p> : null}
      </div>
      {right ?? <ChevronRight className="h-5 w-5 shrink-0 text-white/35" />}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={rowClassName}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={rowClassName}>
      {content}
    </button>
  );
}

type ProfileActionCardProps = {
  icon: ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  onClick: () => void;
};

function ProfileActionCard({ icon: Icon, title, subtitle, onClick }: ProfileActionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[5.25rem] w-full items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-left transition-colors hover:bg-white/10 active:bg-white/15"
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white/85 transition-colors group-hover:bg-white/15">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold leading-tight text-white">{title}</span>
        {subtitle ? <span className="mt-1 block text-xs leading-snug text-white/60">{subtitle}</span> : null}
      </span>
    </button>
  );
}

export function ProfilePage() {
  const navigate = useNavigate();
  const { isAuthed, loading, profile, refreshProfile, signOut, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { clearReadingHistory, continueReading, hiddenReadEnabled, setHiddenReadEnabled } = useReadingProgress();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [digestEnabled, setDigestEnabled] = useState(false);
  const [digestSaving, setDigestSaving] = useState(false);
  const [digestThreshold, setDigestThreshold] = useState<DigestThreshold>(10);
  const [fullscreenSupported, setFullscreenSupported] = useState(false);
  const [fullscreenEnabled, setFullscreenEnabled] = useState(() => {
    if (typeof window === 'undefined') {
      return true;
    }

    return window.localStorage.getItem(telegramFullscreenStorageKey) !== '0';
  });
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

  const avatarUrl = useMemo(() => {
    const photoUrl = telegramUser?.photo_url ?? null;
    const isSvgUserpic = Boolean(photoUrl && photoUrl.toLowerCase().endsWith('.svg'));

    if (photoUrl && !isSvgUserpic && !avatarFailed) {
      return getTelegramPhotoUrlProxy(photoUrl, 'small');
    }

    if (typeof telegramUser?.id === 'number') {
      return getTelegramAvatarProxyUrl(telegramUser.id, 'small');
    }

    return null;
  }, [avatarFailed, telegramUser]);
  const isAdminUser = profile?.role === 'admin';
  const canManageOwnPosts = profile?.role === 'admin' || profile?.role === 'editor';
  const isTeamMember = profile?.role === 'admin' || profile?.role === 'editor';
  const roleLabel = profile?.role === 'admin' ? 'Администратор' : profile?.role === 'editor' ? 'Редактор' : 'Пользователь';
  const roleBadgeClass = profile?.role === 'admin' ? 'bg-cyan-500/15 text-cyan-200' : profile?.role === 'editor' ? 'bg-emerald-500/15 text-emerald-200' : 'bg-white/10 text-white/80';
  const continueReadingPath = continueReading.path?.trim() || (continueReading.postId ? getPostPath(continueReading.postId) : null);
  const continueReadingSubtitleValue = formatContinueReadingDate(continueReading.updatedAt);
  const continueReadingSubtitle = continueReadingSubtitleValue ? `Обновлено ${continueReadingSubtitleValue}` : undefined;

  useEffect(() => {
    if (!profile) {
      return;
    }

    setDigestEnabled(Boolean(profile.for_you_digest_enabled));
    setDigestThreshold(normalizeDigestThreshold(profile.for_you_digest_threshold));
  }, [profile]);

  useEffect(() => {
    const webApp = getTelegramWebApp();
    const supportsFullscreen = Boolean(webApp?.requestFullscreen && webApp?.exitFullscreen);
    setFullscreenSupported(supportsFullscreen);
    setFullscreenEnabled(window.localStorage.getItem(telegramFullscreenStorageKey) !== '0');

    if (!supportsFullscreen || !webApp?.onEvent) {
      return;
    }

    const handleFullscreenChanged = () => {
      if (typeof webApp.isFullscreen === 'boolean') {
        setFullscreenEnabled(webApp.isFullscreen);
      }
    };

    webApp.onEvent('fullscreenChanged', handleFullscreenChanged);

    return () => {
      webApp.offEvent?.('fullscreenChanged', handleFullscreenChanged);
    };
  }, []);

  const persistDigestSettings = async (nextEnabled: boolean, nextThreshold: DigestThreshold, successMessage: string) => {
    if (!user?.id || digestSaving) {
      return;
    }

    const previousEnabled = digestEnabled;
    const previousThreshold = digestThreshold;
    const normalizedThreshold = normalizeDigestThreshold(nextThreshold);

    setDigestEnabled(nextEnabled);
    setDigestThreshold(normalizedThreshold);
    setDigestSaving(true);

    try {
      await updateForYouDigestSettings(user.id, {
        for_you_digest_enabled: nextEnabled,
        for_you_digest_threshold: normalizedThreshold,
      });
      await refreshProfile();
      toast.success(successMessage);
    } catch (error) {
      setDigestEnabled(previousEnabled);
      setDigestThreshold(previousThreshold);
      toast.error(getErrorMessage(error, 'Не удалось сохранить настройки умной ленты.'));
    } finally {
      setDigestSaving(false);
    }
  };

  const toggleFullscreen = async () => {
    const webApp = getTelegramWebApp();

    if (!webApp?.requestFullscreen || !webApp?.exitFullscreen) {
      window.alert('Не поддерживается');
      return;
    }

    const previousEnabled = fullscreenEnabled;
    const nextEnabled = !previousEnabled;

    setFullscreenEnabled(nextEnabled);
    window.localStorage.setItem(telegramFullscreenStorageKey, nextEnabled ? '1' : '0');

    try {
      const maybePromise = nextEnabled ? webApp.requestFullscreen() : webApp.exitFullscreen();
      if (maybePromise && typeof (maybePromise as Promise<void>).then === 'function') {
        await maybePromise;
      }
    } catch {
      window.localStorage.setItem(telegramFullscreenStorageKey, previousEnabled ? '1' : '0');
      setFullscreenEnabled(previousEnabled);
      window.alert('Не поддерживается');
    }
  };

  if (loading) {
    return (
      <FlatPage className="py-6 sm:py-8">
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
      <FlatPage className="py-6 sm:py-8">
        <div className="space-y-4">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
            {'Назад'}
          </Button>
          <StateCard title="Нужен вход" description="Войдите, чтобы управлять аккаунтом, сохранёнными материалами и разделами." />
          <div className="flex gap-3">
            <Button onClick={() => setAuthDialogOpen(true)}>{'Войти'}</Button>
            <Button variant="outline" onClick={() => navigate('/')}>
              {'На главную'}
            </Button>
          </div>
          <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
        </div>
      </FlatPage>
    );
  }

  return (
    <FlatPage className="py-6 sm:py-8">
      <div className="space-y-1">
        <FlatSection className="pt-0">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-500/10 via-white/0 to-white/0 px-4 pb-4 pt-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm text-white/60">{'Здравствуйте,'}</p>
                <h1 className="mt-1 text-3xl font-semibold leading-tight text-white">{displayName}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {isTeamMember ? <span className="text-sm text-cyan-300/90">DevLabs Team</span> : null}
                  <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium', roleBadgeClass)}>{roleLabel}</span>
                </div>
              </div>
              <Avatar className="h-14 w-14 shrink-0 rounded-full ring-1 ring-white/10">
                <AvatarImage
                  src={avatarUrl ?? undefined}
                  alt={displayName}
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                  onError={() => {
                    setAvatarFailed(true);
                  }}
                />
                <AvatarFallback className="flex h-full w-full items-center justify-center bg-cyan-500/20 text-lg font-semibold text-cyan-100">
                  {getInitial(displayName)}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </FlatSection>

        {continueReading.postId && continueReadingPath ? (
          <FlatSection className="pt-2">
            <SectionTitle>{'ПРОДОЛЖИТЬ ЧТЕНИЕ'}</SectionTitle>
            <div className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-transparent">
              <ProfileRow
                icon={History}
                title={continueReading.title?.trim() || 'Открыть публикацию'}
                subtitle={continueReadingSubtitle}
                onClick={() => navigate(continueReadingPath)}
              />
            </div>
          </FlatSection>
        ) : null}

        <FlatSection className="pt-2">
          <SectionTitle>{'Аккаунт'}</SectionTitle>
          <div className="space-y-3">
            <div className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-transparent">
              <ProfileRow icon={Bookmark} title="Сохранённые статьи" onClick={() => navigate('/saved-articles')} />
              <ProfileRow icon={History} title="История чтения" onClick={() => navigate('/reading-history')} />
              <ProfileRow icon={Activity} title="Активность" onClick={() => navigate('/activity')} />
            </div>

            <div className="rounded-xl border border-white/10 bg-transparent px-4 py-4">
              <p className="text-xs text-white/60">Здесь вы выбираете разделы и уведомления, а персональная подборка открывается на экране «Умная лента».</p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">Уведомления о подборке</p>
                  <p className="mt-1 text-xs text-white/60">Сообщим в Telegram, когда в Умной ленте накопится нужное число новых материалов.</p>
                </div>
                <button
                  type="button"
                  className={cn(
                    'inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-xs font-semibold transition',
                    digestEnabled ? 'border-cyan-300/60 bg-cyan-400/15 text-cyan-100' : 'border-white/15 bg-white/5 text-white/70',
                  )}
                  onClick={() => {
                    void persistDigestSettings(
                      !digestEnabled,
                      digestThreshold,
                      !digestEnabled ? 'Уведомления о подборке включены.' : 'Уведомления о подборке отключены.',
                    );
                  }}
                  disabled={digestSaving}
                >
                  {digestSaving ? 'Сохранение...' : digestEnabled ? 'Включено' : 'Выключено'}
                </button>
              </div>

              <div className="mt-4 border-t border-white/10 pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigate('/topic-preferences')}
                    className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-sm text-white/90 transition-colors hover:bg-white/10 active:bg-white/15"
                  >
                    <Settings2 className="h-4 w-4" />
                    {'Разделы'}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/for-you')}
                    className="inline-flex items-center gap-2 rounded-full bg-cyan-400/10 px-3 py-1.5 text-sm text-cyan-100 transition-colors hover:bg-cyan-400/20 active:bg-cyan-400/25"
                  >
                    <Sparkles className="h-4 w-4" />
                    {'Открыть Умную ленту'}
                  </button>
                </div>
                <p className="mt-2 text-xs text-white/60">Разделы задают темы для Умной ленты и уведомлений о подборке.</p>
              </div>

              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/50">Когда отправлять уведомление</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {digestThresholdOptions.map((option) => {
                    const selected = digestThreshold === option;

                    return (
                      <button
                        key={option}
                        type="button"
                        className={cn(
                          'h-10 rounded-lg border text-sm font-semibold transition',
                          selected ? 'border-cyan-300/70 bg-cyan-400/15 text-cyan-100' : 'border-white/10 bg-white/5 text-white/75 hover:bg-white/10',
                        )}
                        onClick={() => {
                          if (option === digestThreshold) {
                            return;
                          }

                          void persistDigestSettings(digestEnabled, option, 'Порог уведомлений о подборке обновлён.');
                        }}
                        disabled={digestSaving}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 text-xs text-white/55">Уведомление придёт, когда в Умной ленте накопится выбранное количество новых материалов.</p>
              </div>
            </div>

            <div className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-transparent">
              {fullscreenSupported ? (
                <ProfileRow
                  icon={Settings2}
                  title="Полный экран"
                  subtitle={fullscreenEnabled ? 'Включен' : 'Выключен'}
                  onClick={() => {
                    void toggleFullscreen();
                  }}
                />
              ) : null}
              <ProfileRow
                icon={EyeOff}
                title="Скрывать прочитанное"
                subtitle={hiddenReadEnabled ? 'Включено' : 'Выключено'}
                onClick={() => setHiddenReadEnabled(!hiddenReadEnabled)}
              />
              <ProfileRow
                icon={MoonStar}
                title="Цветовая схема"
                subtitle={theme === 'dark' ? 'Тёмная' : 'Светлая'}
                onClick={toggleTheme}
              />
              <ProfileRow icon={Bug} title="Диагностика WebApp" onClick={() => navigate('/webapp-debug')} />
              <ProfileRow icon={Trash2} title="Сбросить историю чтения" onClick={clearReadingHistory} />
              <ProfileRow icon={LifeBuoy} title="Поддержка" onClick={() => navigate('/support')} />
              <ProfileRow icon={Info} title="О приложении" onClick={() => navigate('/about')} />
              {isAdminUser ? <ProfileRow icon={Users} title="Роли пользователей" onClick={() => navigate('/admin/users')} /> : null}
            </div>

            <div className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-transparent">
              <ProfileRow
                icon={LogOut}
                iconClassName="text-red-300/80"
                title={signOutBusy ? 'Выходим...' : 'Выйти'}
                titleClassName="text-red-300/90"
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
        </FlatSection>

        {canManageOwnPosts ? (
          <FlatSection className="pt-2">
            <SectionTitle>{'Редакторка'}</SectionTitle>
            <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(10.5rem,1fr))]">
              <ProfileActionCard icon={FilePenLine} title="Новая новость" subtitle="Создать материал" onClick={() => navigate('/admin/new')} />
              <ProfileActionCard
                icon={FilePenLine}
                title="Панель автора"
                subtitle="Черновики и публикации"
                onClick={() => navigate('/author')}
              />
              <ProfileActionCard icon={Sparkles} title="Импорт в черновик" subtitle="Ручной URL-импорт" onClick={() => navigate('/admin/import')} />
              <ProfileActionCard icon={History} title="Список материалов" subtitle="Все ваши публикации" onClick={() => navigate('/my-posts')} />
              {isAdminUser ? (
                <ProfileActionCard icon={ScrollText} title="Правила публикаций" subtitle="Редакторский контур" onClick={() => navigate('/admin/publication-rules')} />
              ) : null}
            </div>
          </FlatSection>
        ) : null}

        {isAdminUser ? (
          <FlatSection className="border-b-0 pt-2">
            <SectionTitle>{'AI и импорт'}</SectionTitle>
            <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(10.5rem,1fr))]">
              <ProfileActionCard icon={SlidersHorizontal} title="AI-настройки импорта" subtitle="Основная/резервная модель и режимы" onClick={() => navigate('/admin/ai-settings')} />
              <ProfileActionCard icon={Rss} title="Источники" subtitle="RSS-реестр и запуск импорта" onClick={() => navigate('/admin/sources')} />
            </div>
          </FlatSection>
        ) : null}

        <div className="mt-6 pb-6 text-center text-xs text-white/40">
          {'Разработано '}
          <a href="https://t.me/Tvoy_Kosmonavt" target="_blank" rel="noreferrer" className="font-semibold text-white/60 transition hover:text-white/80">
            {'Твой Космонавт'}
          </a>
        </div>
      </div>
    </FlatPage>
  );
}
