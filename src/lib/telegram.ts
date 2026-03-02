export type TelegramEnvironment = 'telegram' | 'browser';
export type TelegramWebAppUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready?: () => void;
        expand?: () => void;
        colorScheme?: 'light' | 'dark';
        initData?: string;
        initDataUnsafe?: {
          auth_date?: number;
          hash?: string;
          user?: TelegramWebAppUser;
        };
        themeParams?: Record<string, string>;
      };
    };
  }
}

export function getTelegramWebApp() {
  return window.Telegram?.WebApp;
}

export function getTelegramEnvironment(): TelegramEnvironment {
  return getTelegramWebApp() ? 'telegram' : 'browser';
}

export function getTelegramInitData() {
  return getTelegramWebApp()?.initData ?? '';
}

export function getTelegramUser() {
  return getTelegramWebApp()?.initDataUnsafe?.user ?? null;
}

export function initTelegramWebApp() {
  const webApp = getTelegramWebApp();

  webApp?.ready?.();
  webApp?.expand?.();

  return {
    colorScheme: webApp?.colorScheme ?? 'light',
    initData: webApp?.initData ?? '',
    user: webApp?.initDataUnsafe?.user ?? null,
    themeParams: webApp?.themeParams ?? null,
  };
}
