export type TelegramEnvironment = 'telegram' | 'browser';
export type TelegramWebAppUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
};

type TelegramSafeAreaInsets = {
  bottom?: number;
  left?: number;
  right?: number;
  top?: number;
};

type TelegramEventHandler = (...args: unknown[]) => void;

export const telegramFullscreenStorageKey = 'tma_fullscreen_enabled';

declare global {
  interface Window {
    __devLabsTmaRuntimeInitialized?: boolean;
    Telegram?: {
      WebApp?: {
        ready?: () => void;
        expand?: () => void;
        colorScheme?: 'light' | 'dark';
        contentSafeAreaInset?: TelegramSafeAreaInsets;
        safeAreaInset?: TelegramSafeAreaInsets;
        isFullscreen?: boolean;
        initData?: string;
        initDataUnsafe?: {
          auth_date?: number;
          hash?: string;
          start_param?: string;
          user?: TelegramWebAppUser;
        };
        onEvent?: (eventName: string, handler: TelegramEventHandler) => void;
        offEvent?: (eventName: string, handler: TelegramEventHandler) => void;
        requestFullscreen?: () => void | Promise<void>;
        exitFullscreen?: () => void | Promise<void>;
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

function normalizeStartParam(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
}

export function getTelegramStartParam() {
  const fromInitData = normalizeStartParam(getTelegramWebApp()?.initDataUnsafe?.start_param);
  if (fromInitData) {
    return fromInitData;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  const query = new URLSearchParams(window.location.search);
  return normalizeStartParam(query.get('tgWebAppStartParam'));
}

export function getPostIdFromTelegramStartParam(startParam: string | null | undefined) {
  const normalized = normalizeStartParam(startParam);
  if (!normalized) {
    return null;
  }

  const match = /^post_([^/?#]+)$/u.exec(normalized);
  return match?.[1] ?? null;
}

export function getPathFromTelegramStartParam(startParam: string | null | undefined) {
  const normalized = normalizeStartParam(startParam);
  if (!normalized) {
    return null;
  }

  if (normalized === 'for_you') {
    return '/for-you';
  }

  const postId = getPostIdFromTelegramStartParam(normalized);
  if (!postId) {
    return null;
  }

  return `/post/${postId}`;
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

function setCssVar(name: string, value: number | undefined) {
  const root = document.documentElement;
  const normalizedValue = Number.isFinite(value) ? `${Math.max(0, value ?? 0)}px` : '0px';
  root.style.setProperty(name, normalizedValue);
}

function applyTelegramSafeAreaVars() {
  const webApp = getTelegramWebApp();
  const safeInset = webApp?.safeAreaInset;
  const contentSafeInset = webApp?.contentSafeAreaInset;

  setCssVar('--tma-safe-top', safeInset?.top);
  setCssVar('--tma-safe-bottom', safeInset?.bottom);
  setCssVar('--tma-content-safe-top', contentSafeInset?.top ?? safeInset?.top);
  setCssVar('--tma-content-safe-bottom', contentSafeInset?.bottom ?? safeInset?.bottom);
  document.documentElement.style.setProperty('--tma-header-extra', webApp?.isFullscreen ? '24px' : '0px');
}

function isFullscreenPreferenceEnabled() {
  if (typeof window === 'undefined') {
    return true;
  }

  return window.localStorage.getItem(telegramFullscreenStorageKey) !== '0';
}

export function initTelegramWebAppRuntime() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  if (window.__devLabsTmaRuntimeInitialized) {
    return;
  }

  window.__devLabsTmaRuntimeInitialized = true;
  applyTelegramSafeAreaVars();

  const webApp = getTelegramWebApp();
  if (!webApp) {
    return;
  }

  const handleSafeAreaChanged: TelegramEventHandler = () => {
    applyTelegramSafeAreaVars();
  };
  const handleContentSafeAreaChanged: TelegramEventHandler = () => {
    applyTelegramSafeAreaVars();
  };
  const handleFullscreenChanged: TelegramEventHandler = () => {
    applyTelegramSafeAreaVars();
  };

  webApp.onEvent?.('safeAreaChanged', handleSafeAreaChanged);
  webApp.onEvent?.('contentSafeAreaChanged', handleContentSafeAreaChanged);
  webApp.onEvent?.('fullscreenChanged', handleFullscreenChanged);

  if (isFullscreenPreferenceEnabled() && webApp.requestFullscreen) {
    try {
      const maybePromise = webApp.requestFullscreen();
      if (maybePromise && typeof (maybePromise as Promise<void>).then === 'function') {
        void (maybePromise as Promise<void>).catch(() => undefined);
      }
    } catch {
      // no-op: fullscreen is optional and depends on Telegram client support
    }
  }

  window.setTimeout(() => {
    applyTelegramSafeAreaVars();
  }, 100);
}
