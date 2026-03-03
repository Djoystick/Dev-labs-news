import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Cable, ChevronDown, Eraser, LogOut, Mail, PencilLine, ScrollText, Settings2, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { AdminRoleManager } from '@/components/AdminRoleManager';
import { AdminRulesEditor } from '@/components/AdminRulesEditor';
import { AuthDialog } from '@/components/auth/auth-dialog';
import { Container } from '@/components/layout/container';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AppLink } from '@/components/ui/app-link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { StateCard } from '@/components/ui/state-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { clearFavoritePosts, clearReadingHistory, getProfileDisplayName, listFavoritePosts, listReadingHistory } from '@/features/profile/api';
import { ProfileEditor } from '@/features/profile/components/profile-editor';
import { ProfileEmptyState } from '@/features/profile/components/profile-empty-state';
import { ProfilePostRow } from '@/features/profile/components/profile-post-row';
import { useAuth } from '@/providers/auth-provider';
import { useLibrary } from '@/providers/library-provider';
import { useReadingPreferences } from '@/providers/preferences-provider';
import type { Favorite, ReadingHistoryEntry } from '@/types/db';

type ProfileTab = 'profile' | 'favorites' | 'history' | 'settings';
type ClearTarget = 'favorites' | 'history' | null;

const profileTabs: ProfileTab[] = ['profile', 'favorites', 'history', 'settings'];

function getInitials(value: string | null | undefined) {
  if (!value) {
    return 'DL';
  }

  return value
    .replace('@', '')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function getProfileHandle(handle: string | null | undefined, username: string | null | undefined, fallback: string) {
  const rawValue = handle?.trim() || username?.trim();

  if (!rawValue) {
    return fallback;
  }

  return rawValue.startsWith('@') ? rawValue : `@${rawValue}`;
}

function CollectionSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="rounded-[1.5rem] border border-border/70 bg-card/80 p-4">
          <div className="flex gap-4">
            <Skeleton className="h-20 w-20 rounded-2xl" />
            <div className="min-w-0 flex-1 space-y-3">
              <Skeleton className="h-4 w-32 rounded-full" />
              <Skeleton className="h-6 w-full rounded-full" />
              <Skeleton className="h-5 w-4/5 rounded-full" />
              <Skeleton className="h-4 w-40 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SettingGroup({
  description,
  label,
  options,
  value,
}: {
  description: string;
  label: string;
  options: Array<{ label: string; value: string; onSelect: () => void }>;
  value: string;
}) {
  return (
    <div className="rounded-[1.25rem] border border-border/70 bg-background/80 p-4">
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {options.map((option) => (
          <Button key={option.value} type="button" size="sm" variant={value === option.value ? 'default' : 'outline'} className="h-9" onClick={option.onSelect}>
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: 'admin' | 'editor' | 'user' }) {
  if (role === 'admin') {
    return (
      <span className="inline-flex h-10 items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 text-sm font-semibold text-primary">
        <ShieldCheck className="h-4 w-4" />
        Администратор
      </span>
    );
  }

  if (role === 'editor') {
    return (
      <span className="inline-flex h-10 items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 text-sm font-semibold text-primary">
        <ScrollText className="h-4 w-4" />
        Редактор
      </span>
    );
  }

  return (
    <span className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-background/80 px-4 text-sm font-semibold text-muted-foreground">
      <UserRound className="h-4 w-4" />
      Пользователь
    </span>
  );
}

export function ProfilePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [clearTarget, setClearTarget] = useState<ClearTarget>(null);
  const [signOutDialogOpen, setSignOutDialogOpen] = useState(false);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [history, setHistory] = useState<ReadingHistoryEntry[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [favoritesError, setFavoritesError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [clearLoading, setClearLoading] = useState(false);
  const [signOutLoading, setSignOutLoading] = useState(false);
  const { isAuthed, loading, profile, refreshProfile, signOut, user } = useAuth();
  const { refreshFavorites } = useLibrary();
  const { reduceMotion, setReadingWidth, setReduceMotion, setTextSize, textSize, textWidth } = useReadingPreferences();

  const activeTab = useMemo<ProfileTab>(() => {
    const tab = searchParams.get('tab');
    return profileTabs.includes(tab as ProfileTab) ? (tab as ProfileTab) : 'profile';
  }, [searchParams]);

  useEffect(() => {
    if (!user) {
      setFavorites([]);
      setHistory([]);
      setFavoritesLoading(false);
      setHistoryLoading(false);
      return;
    }

    const favoritesController = new AbortController();
    const historyController = new AbortController();

    setFavoritesLoading(true);
    setHistoryLoading(true);
    setFavoritesError(null);
    setHistoryError(null);

    void listFavoritePosts(user.id, favoritesController.signal)
      .then((items) => {
        if (!favoritesController.signal.aborted) {
          setFavorites(items.filter((item) => item.post));
        }
      })
      .catch((error) => {
        if (!favoritesController.signal.aborted) {
          setFavoritesError(error instanceof Error ? error.message : 'Не удалось загрузить избранное.');
        }
      })
      .finally(() => {
        if (!favoritesController.signal.aborted) {
          setFavoritesLoading(false);
        }
      });

    void listReadingHistory(user.id, historyController.signal)
      .then((items) => {
        if (!historyController.signal.aborted) {
          setHistory(items.filter((item) => item.post));
        }
      })
      .catch((error) => {
        if (!historyController.signal.aborted) {
          setHistoryError(error instanceof Error ? error.message : 'Не удалось загрузить историю.');
        }
      })
      .finally(() => {
        if (!historyController.signal.aborted) {
          setHistoryLoading(false);
        }
      });

    return () => {
      favoritesController.abort();
      historyController.abort();
    };
  }, [user]);

  if (loading) {
    return (
      <Container className="safe-pb py-10">
        <div className="mx-auto max-w-5xl space-y-5">
          <Skeleton className="h-64 w-full rounded-[2rem]" />
          <Skeleton className="h-12 w-80 rounded-full" />
          <Skeleton className="h-48 w-full rounded-[1.75rem]" />
        </div>
      </Container>
    );
  }

  if (!isAuthed || !user || !profile) {
    return (
      <Container className="safe-pb py-10">
        <StateCard title="Требуется вход" description="Войдите в аккаунт, чтобы открыть профиль, избранное и историю чтения." />
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={() => setAuthDialogOpen(true)}>Войти</Button>
          <Button asChild variant="outline">
            <AppLink to="/">На главную</AppLink>
          </Button>
        </div>
        <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
      </Container>
    );
  }

  const displayName = getProfileDisplayName(profile, user.email);
  const profileHandle = getProfileHandle(profile.handle, profile.username, displayName);
  const readableName = profile.full_name?.trim() || null;
  const bio = profile.bio?.trim() || null;
  const canWriteNews = profile.role === 'admin' || profile.role === 'editor';
  const isAdmin = profile.role === 'admin';
  const motionDuration = reduceMotion ? 0 : 0.22;

  const handleTabChange = (value: string) => {
    setSearchParams(
      (currentParams) => {
        const nextParams = new URLSearchParams(currentParams);

        if (value === 'profile') {
          nextParams.delete('tab');
        } else {
          nextParams.set('tab', value);
        }

        return nextParams;
      },
      { replace: true },
    );
  };

  const handleSettingsToggle = () => {
    handleTabChange(activeTab === 'settings' ? 'profile' : 'settings');
  };

  const handleClear = async () => {
    if (!clearTarget) {
      return;
    }

    setClearLoading(true);

    try {
      if (clearTarget === 'favorites') {
        await clearFavoritePosts(user.id);
        setFavorites([]);
        await refreshFavorites();
        toast.success('Избранное очищено.');
      } else {
        await clearReadingHistory(user.id);
        setHistory([]);
        toast.success('История очищена.');
      }

      setClearTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось очистить данные.');
    } finally {
      setClearLoading(false);
    }
  };

  const handleSignOut = async () => {
    setSignOutLoading(true);

    try {
      await signOut();
      setSignOutDialogOpen(false);
      toast.success('Вы вышли из аккаунта.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось выйти.');
    } finally {
      setSignOutLoading(false);
    }
  };

  return (
    <Container className="safe-pb py-4 sm:py-5">
      <div className="mx-auto max-w-5xl space-y-4">
        <Card className="overflow-hidden border-border/70 bg-card/85 shadow-[0_28px_70px_-40px_rgba(15,23,42,0.48)]">
          <CardContent className="relative p-4 sm:p-5">
            <div className="absolute right-4 top-4 sm:right-5 sm:top-5">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-11 w-11 rounded-full"
                aria-label={activeTab === 'settings' ? 'Закрыть настройки профиля' : 'Открыть настройки профиля'}
                onClick={handleSettingsToggle}
              >
                <Settings2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-col items-center gap-3 text-center sm:gap-4">
              <Avatar className="h-24 w-24 rounded-full border border-border/70 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.55)] sm:h-28 sm:w-28">
                <AvatarImage src={profile.avatar_url ?? undefined} alt={profileHandle} />
                <AvatarFallback className="rounded-full text-2xl">{getInitials(profileHandle)}</AvatarFallback>
              </Avatar>

              <div className="w-full max-w-2xl space-y-2">
                <h1 className="text-2xl font-extrabold leading-tight break-all whitespace-normal sm:text-3xl">{profileHandle}</h1>
                {readableName && readableName !== profileHandle ? <p className="text-sm break-words text-muted-foreground">{readableName}</p> : null}
                <div className="flex flex-wrap justify-center gap-2">
                  <RoleBadge role={profile.role} />
                  {canWriteNews ? (
                    <span className="inline-flex h-10 items-center rounded-full border border-border bg-background/80 px-4 text-sm font-semibold text-muted-foreground">
                      Dev-Lab Teams
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap justify-center gap-2 text-sm">
                  <span className="inline-flex h-10 items-center rounded-full border border-border bg-background/80 px-3 text-muted-foreground">
                    Избранное: {favorites.length}
                  </span>
                  <span className="inline-flex h-10 items-center rounded-full border border-border bg-background/80 px-3 text-muted-foreground">
                    История: {history.length}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <AnimatePresence mode="wait" initial={false}>
          {activeTab === 'settings' ? (
            <motion.section
              key="settings"
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: -10 }}
              transition={{ duration: motionDuration }}
              className="space-y-4"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Настройки</p>
                <h2 className="mt-1 text-2xl font-bold">Настройки и управление</h2>
              </div>

              <Card className="border-border/70 bg-card/85">
                <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-[1.25rem] border border-border/70 bg-background/80 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <PencilLine className="h-4 w-4 text-primary" />
                      Аккаунт
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">Обновите имя, username, аватар и короткое описание профиля.</p>
                    <Button type="button" className="mt-4 h-11 rounded-full px-4" onClick={() => setEditorOpen(true)}>
                      Редактировать
                    </Button>
                  </div>

                  <div className="rounded-[1.25rem] border border-border/70 bg-background/80 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Mail className="h-4 w-4 text-primary" />
                      Email
                    </div>
                    <p className="mt-2 break-all text-sm leading-6 text-muted-foreground">{user.email ?? 'Не указан'}</p>
                  </div>

                  <div className="rounded-[1.25rem] border border-border/70 bg-background/80 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Settings2 className="h-4 w-4 text-primary" />
                      Доступ
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {profile.role === 'admin'
                        ? 'У вас открыт доступ администратора.'
                        : profile.role === 'editor'
                          ? 'У вас открыт доступ редактора.'
                          : 'Стандартный пользовательский доступ.'}
                    </p>
                  </div>

                  <div className="rounded-[1.25rem] border border-border/70 bg-background/80 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <LogOut className="h-4 w-4 text-primary" />
                      Сеанс
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">Выйдите из аккаунта из профиля с коротким подтверждением.</p>
                    <Button type="button" variant="outline" className="mt-4 h-11 w-full justify-start rounded-full px-4" onClick={() => setSignOutDialogOpen(true)}>
                      <LogOut className="h-4 w-4" />
                      Выйти
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-card/85">
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <h2 className="text-lg font-semibold">Настройки чтения</h2>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-3">
                    <SettingGroup
                      label="Размер текста"
                      description="Выберите комфортный размер для чтения материалов."
                      value={textSize}
                      options={[
                        { label: 'S', value: 's', onSelect: () => setTextSize('s') },
                        { label: 'M', value: 'm', onSelect: () => setTextSize('m') },
                        { label: 'L', value: 'l', onSelect: () => setTextSize('l') },
                      ]}
                    />
                    <SettingGroup
                      label="Анимации"
                      description="Уменьшите движение интерфейса, если хотите более спокойный режим."
                      value={reduceMotion ? 'reduced' : 'full'}
                      options={[
                        { label: 'Обычные', value: 'full', onSelect: () => setReduceMotion(false) },
                        { label: 'Минимум', value: 'reduced', onSelect: () => setReduceMotion(true) },
                      ]}
                    />
                    <SettingGroup
                      label="Ширина текста"
                      description="Узкая колонка помогает сосредоточиться, широкая даёт больше воздуха."
                      value={textWidth}
                      options={[
                        { label: 'Узко', value: 'narrow', onSelect: () => setReadingWidth('narrow') },
                        { label: 'Широко', value: 'wide', onSelect: () => setReadingWidth('wide') },
                      ]}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-card/85">
                <CardContent className="grid gap-3 p-4 md:grid-cols-2">
                  <div className="rounded-[1.25rem] border border-border/70 bg-background/80 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Eraser className="h-4 w-4 text-primary" />
                      История чтения
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">Удаляет все записи о просмотренных материалах только для вашего аккаунта.</p>
                    <Button type="button" variant="outline" className="mt-4 h-11 rounded-full px-4" onClick={() => setClearTarget('history')}>
                      Очистить историю
                    </Button>
                  </div>

                  <div className="rounded-[1.25rem] border border-border/70 bg-background/80 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Eraser className="h-4 w-4 text-primary" />
                      Избранное
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">Удаляет все сохранённые материалы. Лента и сами посты при этом не затрагиваются.</p>
                    <Button type="button" variant="outline" className="mt-4 h-11 rounded-full px-4" onClick={() => setClearTarget('favorites')}>
                      Очистить избранное
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {isAdmin ? (
                <details className="rounded-[1.5rem] border border-border/70 bg-card/85 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.45)]">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 font-semibold">
                    <span>Инструменты администратора</span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition" />
                  </summary>
                  <div className="space-y-4 border-t border-border/70 p-4">
                    <AdminRoleManager />
                    <AdminRulesEditor />
                  </div>
                </details>
              ) : null}
            </motion.section>
          ) : (
            <motion.div
              key="main"
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: -10 }}
              transition={{ duration: motionDuration }}
              className="space-y-4"
            >
              {canWriteNews ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button asChild variant="outline" className="h-11 rounded-full px-4 sm:w-auto">
                    <AppLink to="/admin/new">
                      <ScrollText className="h-4 w-4" />
                      Написать новость
                    </AppLink>
                  </Button>
                </div>
              ) : null}

              <Tabs value={activeTab} onValueChange={handleTabChange}>
                <TabsList className="flex h-auto w-full flex-wrap justify-start gap-2 rounded-[1.5rem] p-1.5">
                  <TabsTrigger value="profile">Профиль</TabsTrigger>
                  <TabsTrigger value="favorites">Избранное</TabsTrigger>
                  <TabsTrigger value="history">История</TabsTrigger>
                  <TabsTrigger value="settings" className="hidden">
                    Настройки
                  </TabsTrigger>
                </TabsList>

                <AnimatePresence mode="wait" initial={false}>
                  {activeTab === 'profile' ? (
                    <motion.div
                      key="profile"
                      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: -8 }}
                      transition={{ duration: motionDuration }}
                    >
                      <TabsContent value="profile" forceMount className="mt-4 space-y-4">
                        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                          <Card className="border-border/70 bg-card/85">
                            <CardContent className="p-4">
                              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">О себе</p>
                              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                                {bio ?? 'Коротко о себе пока ничего не добавлено.'}
                              </p>
                            </CardContent>
                          </Card>

                          <Card className="border-border/70 bg-card/85">
                            <CardContent className="p-4">
                              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Профиль</p>
                              <dl className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
                                <div>
                                  <dt className="font-semibold text-muted-foreground">Имя</dt>
                                  <dd className="mt-1">{readableName ?? 'Не указано'}</dd>
                                </div>
                                <div>
                                  <dt className="font-semibold text-muted-foreground">Telegram username</dt>
                                  <dd className="mt-1 break-all">{profile.username ? `@${profile.username}` : 'Не указан'}</dd>
                                </div>
                                <div>
                                  <dt className="font-semibold text-muted-foreground">Telegram</dt>
                                  <dd className="mt-1 inline-flex items-center gap-2">
                                    <Cable className="h-4 w-4 text-primary" />
                                    {profile.telegram_id ? 'Подключён' : 'Не подключён'}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="font-semibold text-muted-foreground">Email</dt>
                                  <dd className="mt-1 break-all">{user.email ?? 'Не указан'}</dd>
                                </div>
                              </dl>
                            </CardContent>
                          </Card>
                        </div>
                      </TabsContent>
                    </motion.div>
                  ) : null}

                  {activeTab === 'favorites' ? (
                    <motion.div
                      key="favorites"
                      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: -8 }}
                      transition={{ duration: motionDuration }}
                    >
                      <TabsContent value="favorites" forceMount className="mt-4 space-y-4">
                        {favoritesLoading ? (
                          <CollectionSkeleton />
                        ) : favoritesError ? (
                          <StateCard title="Избранное недоступно" description={favoritesError} />
                        ) : favorites.length === 0 ? (
                          <ProfileEmptyState mode="favorites" description="Сохраняйте материалы из ленты или со страницы поста, чтобы быстро возвращаться к ним позже." />
                        ) : (
                          favorites.map((item) =>
                            item.post ? (
                              <ProfilePostRow
                                key={item.id}
                                post={item.post}
                                metaLabel="Сохранено"
                                metaValue={new Date(item.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                                mode="favorites"
                              />
                            ) : null,
                          )
                        )}
                      </TabsContent>
                    </motion.div>
                  ) : null}

                  {activeTab === 'history' ? (
                    <motion.div
                      key="history"
                      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: -8 }}
                      transition={{ duration: motionDuration }}
                    >
                      <TabsContent value="history" forceMount className="mt-4 space-y-4">
                        {historyLoading ? (
                          <CollectionSkeleton />
                        ) : historyError ? (
                          <StateCard title="История недоступна" description={historyError} />
                        ) : history.length === 0 ? (
                          <ProfileEmptyState mode="history" description="Откройте несколько материалов, и история чтения появится здесь автоматически." />
                        ) : (
                          history.map((item) =>
                            item.post ? (
                              <ProfilePostRow
                                key={item.id}
                                post={item.post}
                                metaLabel="Смотрели"
                                metaValue={`${new Date(item.last_read_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} · ${item.read_count} просмотров`}
                                mode="history"
                              />
                            ) : null,
                          )
                        )}
                      </TabsContent>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </Tabs>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ProfileEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        onSaved={() => {
          void refreshProfile();
        }}
        profile={profile}
        userEmail={user.email}
      />

      <Dialog open={clearTarget !== null} onOpenChange={(open) => !open && setClearTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{clearTarget === 'favorites' ? 'Очистить избранное?' : 'Очистить историю?'}</DialogTitle>
            <DialogDescription>
              {clearTarget === 'favorites'
                ? 'Все сохранённые материалы будут удалены из вашей персональной библиотеки.'
                : 'Все записи истории чтения будут удалены только для вашего аккаунта.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setClearTarget(null)}>
              Отмена
            </Button>
            <Button type="button" onClick={handleClear} disabled={clearLoading}>
              {clearLoading ? 'Очищаем...' : 'Подтвердить'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={signOutDialogOpen} onOpenChange={setSignOutDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Выйти из аккаунта?</DialogTitle>
            <DialogDescription>Текущий Telegram-сеанс будет очищен только на этом устройстве.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setSignOutDialogOpen(false)}>
              Отмена
            </Button>
            <Button type="button" onClick={handleSignOut} disabled={signOutLoading}>
              {signOutLoading ? 'Выходим...' : 'Выйти'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
    </Container>
  );
}
