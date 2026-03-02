import { useEffect, useMemo, useState } from 'react';
import { Cable, Eraser, Mail, PencilLine, Settings2, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { AuthDialog } from '@/components/auth/auth-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AppLink } from '@/components/ui/app-link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { StateCard } from '@/components/ui/state-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { clearFavoritePosts, clearReadingHistory, getProfileDisplayName, getProfileSubtitle, listFavoritePosts, listReadingHistory } from '@/features/profile/api';
import { ProfileEditor } from '@/features/profile/components/profile-editor';
import { ProfileEmptyState } from '@/features/profile/components/profile-empty-state';
import { ProfilePostRow } from '@/features/profile/components/profile-post-row';
import { useAuth } from '@/providers/auth-provider';
import { useLibrary } from '@/providers/library-provider';
import { useReadingPreferences } from '@/providers/preferences-provider';
import { Container } from '@/components/layout/container';
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
    <div className="rounded-[1.25rem] border border-border/70 bg-background/80 p-5">
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

export function ProfilePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [clearTarget, setClearTarget] = useState<ClearTarget>(null);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [history, setHistory] = useState<ReadingHistoryEntry[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [favoritesError, setFavoritesError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [clearLoading, setClearLoading] = useState(false);
  const { isAuthed, loading, profile, refreshProfile, user } = useAuth();
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
  const subtitle = getProfileSubtitle(profile);
  const readableName = profile.full_name?.trim() || 'Имя пока не заполнено';

  const handleTabChange = (value: string) => {
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);

      if (value === 'profile') {
        nextParams.delete('tab');
      } else {
        nextParams.set('tab', value);
      }

      return nextParams;
    }, { replace: true });
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

  return (
    <Container className="safe-pb py-6 sm:py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <Card className="overflow-hidden border-border/70 bg-card/85 shadow-[0_32px_80px_-42px_rgba(15,23,42,0.5)]">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-4 sm:gap-5">
                <Avatar className="h-20 w-20 rounded-[1.5rem] sm:h-24 sm:w-24">
                  <AvatarImage src={profile.avatar_url ?? undefined} alt={displayName} />
                  <AvatarFallback className="rounded-[1.5rem] text-xl">{getInitials(displayName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Dev-labs News</p>
                  <h1 className="mt-2 text-3xl font-extrabold leading-tight sm:text-4xl">{displayName}</h1>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">{subtitle}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-2.5 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1.5">
                      <UserRound className="h-4 w-4" />
                      {readableName}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1.5">
                      <Cable className="h-4 w-4" />
                      {profile.telegram_id ? 'Telegram подключён' : 'Telegram не подключён'}
                    </span>
                    {profile.role === 'admin' ? (
                      <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 font-semibold text-primary">
                        <ShieldCheck className="h-4 w-4" />
                        Администратор
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-sm">
                    <span className="rounded-full border border-border bg-background/80 px-3 py-1.5 text-muted-foreground">Избранное: {favorites.length}</span>
                    <span className="rounded-full border border-border bg-background/80 px-3 py-1.5 text-muted-foreground">История: {history.length}</span>
                  </div>
                </div>
              </div>
              <Button size="sm" className="h-10 rounded-full px-4 self-start" onClick={() => setEditorOpen(true)}>
                <PencilLine className="h-4 w-4" />
                Редактировать
              </Button>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-2 rounded-[1.5rem] p-1.5">
            <TabsTrigger value="profile">Профиль</TabsTrigger>
            <TabsTrigger value="favorites">Избранное</TabsTrigger>
            <TabsTrigger value="history">История</TabsTrigger>
            <TabsTrigger value="settings">Настройки</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-5">
            <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
              <Card className="border-border/70 bg-card/85">
                <CardContent className="p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">О себе</p>
                  <h2 className="mt-3 text-2xl font-bold">{displayName}</h2>
                  <p className="mt-4 text-sm leading-7 text-muted-foreground">{subtitle}</p>
                </CardContent>
              </Card>
              <Card className="border-border/70 bg-card/85">
                <CardContent className="p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Профиль</p>
                  <dl className="mt-4 space-y-4 text-sm">
                    <div>
                      <dt className="font-semibold text-muted-foreground">Псевдоним</dt>
                      <dd className="mt-1">{displayName}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-muted-foreground">Имя</dt>
                      <dd className="mt-1">{readableName}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-muted-foreground">Telegram username</dt>
                      <dd className="mt-1">{profile.username ? `@${profile.username}` : 'Не указан'}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="favorites" className="space-y-4">
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

          <TabsContent value="history" className="space-y-4">
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

          <TabsContent value="settings" className="space-y-5">
            <Card className="border-border/70 bg-card/85">
              <CardContent className="space-y-5 p-6">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h2 className="text-lg font-semibold">Настройки чтения</h2>
                </div>
                <div className="grid gap-4 lg:grid-cols-3">
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
              <CardContent className="grid gap-5 p-6 md:grid-cols-2">
                <div className="rounded-[1.25rem] border border-border/70 bg-background/80 p-5">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Mail className="h-4 w-4 text-primary" />
                    Email
                  </div>
                  <p className="mt-3 break-all text-sm leading-6 text-muted-foreground">{user.email ?? 'Не указан'}</p>
                </div>
                <div className="rounded-[1.25rem] border border-border/70 bg-background/80 p-5">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Settings2 className="h-4 w-4 text-primary" />
                    Доступ
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{profile.role === 'admin' ? 'У вас открыт доступ администратора.' : 'Стандартный пользовательский доступ.'}</p>
                </div>
                <div className="rounded-[1.25rem] border border-border/70 bg-background/80 p-5">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Eraser className="h-4 w-4 text-primary" />
                    История чтения
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">Удаляет все записи о просмотренных материалах только для вашего аккаунта.</p>
                  <Button type="button" variant="outline" className="mt-4 h-9" onClick={() => setClearTarget('history')}>
                    Очистить историю
                  </Button>
                </div>
                <div className="rounded-[1.25rem] border border-border/70 bg-background/80 p-5">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Eraser className="h-4 w-4 text-primary" />
                    Избранное
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">Удаляет все сохранённые материалы. Лента и сами посты при этом не затрагиваются.</p>
                  <Button type="button" variant="outline" className="mt-4 h-9" onClick={() => setClearTarget('favorites')}>
                    Очистить избранное
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
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

      <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
    </Container>
  );
}
