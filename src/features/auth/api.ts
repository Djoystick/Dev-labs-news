import { getSupabaseClient } from '@/lib/supabase';
import { getEnv } from '@/lib/env';
import { getTelegramInitData } from '@/lib/telegram';
import type { Profile } from '@/types/db';

const profileSelect =
  'id, role, handle, handle_norm, bio, telegram_id, telegram_user_id, telegram_notifications_enabled, telegram_linked_at, for_you_digest_enabled, for_you_digest_threshold, username, full_name, avatar_url, created_at';

export type TelegramAuthResult = {
  ok: true;
  profile: Pick<Profile, 'id' | 'role' | 'telegram_id' | 'username'> & Partial<Profile>;
  token: string;
};

type TelegramAuthPayload = {
  access_token?: string;
  error?: string;
  ok?: boolean;
  profile?: (Pick<Profile, 'id' | 'role' | 'telegram_id' | 'username'> & Partial<Profile>) | null;
  refresh_token?: string;
  session?: {
    access_token?: string;
    refresh_token?: string;
  } | null;
  token?: string;
} | null;

export async function fetchOwnProfile(userId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('profiles').select(profileSelect).eq('id', userId).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as Profile | null) ?? null;
}

export async function exchangeTelegramAuth(initDataOverride?: string) {
  const { supabaseAnonKey, supabaseUrl } = getEnv();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing env');
  }

  const initData = (initDataOverride ?? getTelegramInitData()).trim();

  if (!initData) {
    throw new Error('Откройте приложение внутри Telegram');
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke('telegram-auth', {
    body: { initData },
  });

  if (error) {
    throw new Error(error.message || 'Telegram sign-in failed.');
  }

  const payload = data as TelegramAuthPayload;
  const accessToken = payload?.session?.access_token ?? payload?.access_token ?? null;
  const refreshToken = payload?.session?.refresh_token ?? payload?.refresh_token ?? null;
  const appToken = payload?.token ?? accessToken;

  if (!appToken && !accessToken) {
    throw new Error('Не удалось выполнить вход. Повторите попытку.');
  }

  // Mobile Telegram WebView may fail to persist Supabase session; keep login valid with app token.
  if (accessToken && refreshToken) {
    try {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (!sessionError) {
        await supabase.auth.getSession();
      }
    } catch {
      // Ignore session persistence failures and continue auth flow.
    }
  }

  if (!payload?.ok || !payload.profile?.id || !payload.profile.role) {
    throw new Error('Telegram auth returned an incomplete payload.');
  }

  return {
    ok: true,
    profile: payload.profile,
    token: appToken as string,
  } as TelegramAuthResult;
}
