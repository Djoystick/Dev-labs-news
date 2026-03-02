export type TelegramEnvironment = 'telegram' | 'browser';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready?: () => void;
        expand?: () => void;
        colorScheme?: 'light' | 'dark';
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

export function initTelegramWebApp() {
  const webApp = getTelegramWebApp();

  webApp?.ready?.();
  webApp?.expand?.();

  return {
    colorScheme: webApp?.colorScheme ?? 'light',
    themeParams: webApp?.themeParams ?? null,
  };
}
