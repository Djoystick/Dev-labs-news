export type TelegramUser = {
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
};

function normalizeUsername(value: string | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().replace(/^@+/, '');
  return normalized || null;
}

export function getTelegramUser(): TelegramUser | null {
  return window.Telegram?.WebApp?.initDataUnsafe?.user ?? null;
}

export function getTelegramDisplayName(user: TelegramUser | null): string | null {
  if (!user) {
    return null;
  }

  const fullName = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim();

  if (fullName) {
    return fullName;
  }

  return normalizeUsername(user.username);
}

export function getTelegramAvatarUrl(user: TelegramUser | null): string | null {
  if (!user?.photo_url) {
    return null;
  }

  const url = user.photo_url.trim();
  return url || null;
}
