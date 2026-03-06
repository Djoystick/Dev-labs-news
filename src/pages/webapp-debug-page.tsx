import { X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FlatPage, FlatSection } from '@/components/layout/flat';
import { Button } from '@/components/ui/button';
import { StateCard } from '@/components/ui/state-card';
import { getTelegramAvatarProxyUrl } from '@/lib/telegram-avatar';
import { getTelegramUser } from '@/lib/telegram-user';

type Insets = {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
};

type TelegramWebAppDebug = {
  version?: string;
  platform?: string;
  isFullscreen?: boolean;
  colorScheme?: string;
  headerColor?: string;
  backgroundColor?: string;
  safeAreaInset?: Insets;
  contentSafeAreaInset?: Insets;
  requestFullscreen?: () => void | Promise<void>;
  exitFullscreen?: () => void | Promise<void>;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  checkHomeScreenStatus?: ((callback: (status: string) => void) => void | Promise<string>) | (() => Promise<string>);
  addToHomeScreen?: ((callback?: (status: string) => void) => void | Promise<string | void>) | (() => Promise<string | void>);
};

type DebugSnapshot = {
  version: string;
  platform: string;
  isFullscreen: string;
  colorScheme: string;
  headerColor: string;
  backgroundColor: string;
  safeAreaInset: string;
  contentSafeAreaInset: string;
};

const unsupportedText = '—';

function getWebApp(): TelegramWebAppDebug | null {
  return (window.Telegram?.WebApp as TelegramWebAppDebug | undefined) ?? null;
}

function formatInsets(value: Insets | undefined) {
  if (!value) {
    return unsupportedText;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return unsupportedText;
  }
}

function toSnapshot(webApp: TelegramWebAppDebug | null): DebugSnapshot {
  return {
    version: webApp?.version ?? unsupportedText,
    platform: webApp?.platform ?? unsupportedText,
    isFullscreen: typeof webApp?.isFullscreen === 'boolean' ? (webApp.isFullscreen ? 'true' : 'false') : unsupportedText,
    colorScheme: webApp?.colorScheme ?? unsupportedText,
    headerColor: webApp?.headerColor ?? unsupportedText,
    backgroundColor: webApp?.backgroundColor ?? unsupportedText,
    safeAreaInset: formatInsets(webApp?.safeAreaInset),
    contentSafeAreaInset: formatInsets(webApp?.contentSafeAreaInset),
  };
}

function isPromiseLike(value: unknown): value is Promise<unknown> {
  return Boolean(value && typeof value === 'object' && 'then' in value && typeof (value as { then?: unknown }).then === 'function');
}

export function WebAppDebugPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [snapshot, setSnapshot] = useState<DebugSnapshot>(() => toSnapshot(getWebApp()));
  const [lastAction, setLastAction] = useState('—');
  const [homeScreenStatus, setHomeScreenStatus] = useState('—');
  const telegramUser = useMemo(() => getTelegramUser(), []);
  const telegramAvatarProxyUrl = useMemo(() => {
    if (typeof telegramUser?.id !== 'number') {
      return null;
    }

    return getTelegramAvatarProxyUrl(telegramUser.id, 'small');
  }, [telegramUser]);

  const refreshSnapshot = useCallback(() => {
    setSnapshot(toSnapshot(getWebApp()));
  }, []);

  const runAction = useCallback(
    async (actionLabel: string, action: () => Promise<void> | void) => {
      try {
        await action();
        setLastAction(`${actionLabel}: выполнено`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'неизвестная ошибка';
        setLastAction(`${actionLabel}: ошибка (${message})`);
      } finally {
        refreshSnapshot();
        window.setTimeout(refreshSnapshot, 150);
      }
    },
    [refreshSnapshot],
  );

  const onClose = useCallback(() => {
    if (location.key && location.key !== 'default') {
      navigate(-1);
      return;
    }

    navigate('/profile', { replace: true });
  }, [location.key, navigate]);

  const rows = useMemo(
    () => [
      { label: 'Версия', value: snapshot.version },
      { label: 'Платформа', value: snapshot.platform },
      { label: 'Полный экран', value: snapshot.isFullscreen },
      { label: 'Схема', value: snapshot.colorScheme },
      { label: 'Цвет шапки', value: snapshot.headerColor },
      { label: 'Цвет фона', value: snapshot.backgroundColor },
      { label: 'SafeArea', value: snapshot.safeAreaInset },
      { label: 'ContentSafeArea', value: snapshot.contentSafeAreaInset },
    ],
    [snapshot],
  );

  const webAppAvailable = Boolean(getWebApp());

  return (
    <FlatPage className="py-6 sm:py-8">
      <div className="space-y-4">
        <FlatSection className="pt-0">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-3xl font-extrabold">Диагностика WebApp</h1>
            <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Закрыть">
              <X className="h-5 w-5" />
            </Button>
          </div>
          <p className="mt-1 text-sm text-white/65">Безопасные технические параметры окружения Telegram WebApp.</p>
        </FlatSection>

        {!webAppAvailable ? <StateCard title="Telegram WebApp не найден" description="Откройте страницу внутри Telegram для полной диагностики." /> : null}

        <FlatSection className="pt-2">
          <div className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-transparent">
            {rows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-4 px-4 py-3">
                <span className="text-sm text-white/70">{row.label}</span>
                <span className="max-w-[65%] truncate text-right text-sm text-white">{row.value}</span>
              </div>
            ))}
          </div>
        </FlatSection>

        <FlatSection className="pt-2">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-cyan-300/80">Telegram user</h2>
          <div className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-transparent">
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="text-sm text-white/70">id</span>
              <span className="max-w-[65%] truncate text-right text-sm text-white">{typeof telegramUser?.id === 'number' ? telegramUser.id : 'нет'}</span>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="text-sm text-white/70">photo_url</span>
              <span className="max-w-[65%] truncate text-right text-sm text-white">{telegramUser?.photo_url?.trim() ? 'есть' : 'нет'}</span>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="text-sm text-white/70">URL photo_url</span>
              <span className="max-w-[65%] truncate text-right text-sm text-white">{telegramUser?.photo_url?.trim() || '—'}</span>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="text-sm text-white/70">Proxy URL</span>
              <span className="max-w-[65%] truncate text-right text-sm text-white">{telegramAvatarProxyUrl ?? '—'}</span>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="mt-3"
            onClick={() => {
              if (!telegramAvatarProxyUrl) {
                window.alert('Нет telegram user id');
                return;
              }

              window.open(telegramAvatarProxyUrl, '_blank', 'noopener,noreferrer');
            }}
          >
            Открыть аватар (proxy)
          </Button>
        </FlatSection>

        <FlatSection className="pt-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                runAction('В полный экран', async () => {
                  const webApp = getWebApp();
                  if (!webApp?.requestFullscreen) {
                    window.alert('Не поддерживается');
                    return;
                  }

                  await webApp.requestFullscreen();
                })
              }
            >
              В полный экран
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                runAction('Выйти из полного экрана', async () => {
                  const webApp = getWebApp();
                  if (!webApp?.exitFullscreen) {
                    window.alert('Не поддерживается');
                    return;
                  }

                  await webApp.exitFullscreen();
                })
              }
            >
              Выйти из полного экрана
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                runAction('Сделать шапку темной', () => {
                  const webApp = getWebApp();
                  if (!webApp?.setHeaderColor || !webApp?.setBackgroundColor) {
                    window.alert('Не поддерживается');
                    return;
                  }

                  webApp.setHeaderColor('#111827');
                  webApp.setBackgroundColor('#0b1220');
                })
              }
            >
              Сделать шапку темной
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                runAction('Сделать шапку светлой', () => {
                  const webApp = getWebApp();
                  if (!webApp?.setHeaderColor || !webApp?.setBackgroundColor) {
                    window.alert('Не поддерживается');
                    return;
                  }

                  webApp.setHeaderColor('#f8fafc');
                  webApp.setBackgroundColor('#ffffff');
                })
              }
            >
              Сделать шапку светлой
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                runAction('Проверить ярлык', async () => {
                  const webApp = getWebApp();
                  const checkFn = webApp?.checkHomeScreenStatus;

                  if (!checkFn) {
                    window.alert('Не поддерживается');
                    return;
                  }

                  let callbackStatus: string | null = null;
                  const maybeResult = checkFn((status) => {
                    callbackStatus = status;
                  });

                  if (isPromiseLike(maybeResult)) {
                    const promiseStatus = await maybeResult;
                    if (typeof promiseStatus === 'string') {
                      callbackStatus = promiseStatus;
                    }
                  }

                  const resolvedStatus = callbackStatus ?? 'unknown';
                  setHomeScreenStatus(resolvedStatus);
                  setLastAction(`Проверить ярлык: ${resolvedStatus}`);
                })
              }
            >
              Проверить ярлык
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                runAction('Создать ярлык', async () => {
                  const webApp = getWebApp();
                  const addFn = webApp?.addToHomeScreen;

                  if (!addFn) {
                    window.alert('Не поддерживается');
                    return;
                  }

                  let callbackStatus: string | null = null;
                  const maybeResult = addFn((status) => {
                    callbackStatus = status;
                  });

                  if (isPromiseLike(maybeResult)) {
                    const promiseStatus = await maybeResult;
                    if (typeof promiseStatus === 'string') {
                      callbackStatus = promiseStatus;
                    }
                  }

                  if (callbackStatus) {
                    setHomeScreenStatus(callbackStatus);
                    setLastAction(`Создать ярлык: ${callbackStatus}`);
                  }
                })
              }
            >
              Создать ярлык
            </Button>
          </div>
        </FlatSection>

        <FlatSection className="border-b-0 pt-2">
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75">
            <p className="truncate">Последнее действие: {lastAction}</p>
            <p className="mt-1 truncate">Статус ярлыка: {homeScreenStatus}</p>
          </div>
        </FlatSection>
      </div>
    </FlatPage>
  );
}
