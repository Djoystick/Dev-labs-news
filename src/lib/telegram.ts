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

export type TelegramLaunchIntent = {
  startParam: string | null;
  startParamFromHash: string | null;
  startParamFromHref: string | null;
  startParamFromInitData: string | null;
  startParamFromQuery: string | null;
  startParamFromUnsafe: string | null;
  targetPath: string | null;
};

export type TelegramEarlyLaunchDebug = {
  earlyCapturedLaunchTarget: string | null;
  rawHash: string;
  rawSearch: string;
};

export const telegramFullscreenStorageKey = 'tma_fullscreen_enabled';
export const telegramLaunchTargetStorageKey = 'telegram_launch_target';

declare global {
  interface Window {
    __devLabsEarlyLaunchDebug?: TelegramEarlyLaunchDebug;
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

function getStartParamFromSearchParams(params: URLSearchParams) {
  const fromTelegram = normalizeStartParam(params.get('tgWebAppStartParam'));
  if (fromTelegram) {
    return fromTelegram;
  }

  return normalizeStartParam(params.get('start_param'));
}

function getStartParamFromUnsafe() {
  return normalizeStartParam(getTelegramWebApp()?.initDataUnsafe?.start_param);
}

function getStartParamFromInitData() {
  const initData = normalizeStartParam(getTelegramWebApp()?.initData);
  if (!initData) {
    return null;
  }

  try {
    const params = new URLSearchParams(initData);
    return normalizeStartParam(params.get('start_param'));
  } catch {
    return null;
  }
}

function getStartParamFromQuery() {
  if (typeof window === 'undefined') {
    return null;
  }

  const query = new URLSearchParams(window.location.search);
  return getStartParamFromSearchParams(query);
}

function getStartParamFromHash() {
  if (typeof window === 'undefined') {
    return null;
  }

  const rawHash = window.location.hash;
  if (!rawHash) {
    return null;
  }

  const normalizedHash = rawHash.replace(/^#/u, '');
  if (!normalizedHash) {
    return null;
  }

  const fromHashParams = getStartParamFromSearchParams(new URLSearchParams(normalizedHash));
  if (fromHashParams) {
    return fromHashParams;
  }

  const queryIndex = normalizedHash.indexOf('?');
  if (queryIndex >= 0 && queryIndex + 1 < normalizedHash.length) {
    const fromHashQuery = getStartParamFromSearchParams(new URLSearchParams(normalizedHash.slice(queryIndex + 1)));
    if (fromHashQuery) {
      return fromHashQuery;
    }
  }

  return null;
}

function getStartParamFromHref() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const hrefUrl = new URL(window.location.href);
    const fromSearch = getStartParamFromSearchParams(hrefUrl.searchParams);
    if (fromSearch) {
      return fromSearch;
    }

    const hashValue = hrefUrl.hash.replace(/^#/u, '');
    if (!hashValue) {
      return null;
    }

    const fromHash = getStartParamFromSearchParams(new URLSearchParams(hashValue));
    if (fromHash) {
      return fromHash;
    }

    const queryIndex = hashValue.indexOf('?');
    if (queryIndex >= 0 && queryIndex + 1 < hashValue.length) {
      return getStartParamFromSearchParams(new URLSearchParams(hashValue.slice(queryIndex + 1)));
    }
  } catch {
    return null;
  }

  return null;
}

export function getTelegramStartParam() {
  const fromUnsafe = getStartParamFromUnsafe();
  if (fromUnsafe) {
    return fromUnsafe;
  }

  const fromInitData = getStartParamFromInitData();
  if (fromInitData) {
    return fromInitData;
  }

  const fromQuery = getStartParamFromQuery();
  if (fromQuery) {
    return fromQuery;
  }

  const fromHash = getStartParamFromHash();
  if (fromHash) {
    return fromHash;
  }

  return getStartParamFromHref();
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

export function resolveTelegramLaunchIntent(): TelegramLaunchIntent {
  const startParamFromUnsafe = getStartParamFromUnsafe();
  const startParamFromInitData = getStartParamFromInitData();
  const startParamFromQuery = getStartParamFromQuery();
  const startParamFromHash = getStartParamFromHash();
  const startParamFromHref = getStartParamFromHref();
  const startParam = startParamFromUnsafe ?? startParamFromInitData ?? startParamFromQuery ?? startParamFromHash ?? startParamFromHref;

  return {
    startParam,
    startParamFromHash,
    startParamFromHref,
    startParamFromInitData,
    startParamFromQuery,
    startParamFromUnsafe,
    targetPath: getPathFromTelegramStartParam(startParam),
  };
}

export function captureTelegramLaunchTargetEarly() {
  if (typeof window === 'undefined') {
    return null;
  }

  const launchIntent = resolveTelegramLaunchIntent();
  const snapshot: TelegramEarlyLaunchDebug = {
    earlyCapturedLaunchTarget: launchIntent.targetPath,
    rawHash: window.location.hash ?? '',
    rawSearch: window.location.search ?? '',
  };

  window.__devLabsEarlyLaunchDebug = snapshot;

  if (!launchIntent.targetPath) {
    return snapshot;
  }

  try {
    window.sessionStorage.setItem(telegramLaunchTargetStorageKey, launchIntent.targetPath);
  } catch {
    // no-op: launch target persistence is best-effort only
  }

  return snapshot;
}

export function getStoredTelegramLaunchTarget() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const value = window.sessionStorage.getItem(telegramLaunchTargetStorageKey);
    return normalizeStartParam(value);
  } catch {
    return null;
  }
}

export function clearStoredTelegramLaunchTarget() {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.removeItem(telegramLaunchTargetStorageKey);
  } catch {
    // no-op
  }
}

export function getTelegramEarlyLaunchDebug() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.__devLabsEarlyLaunchDebug ?? null;
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
