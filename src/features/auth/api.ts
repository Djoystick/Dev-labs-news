import { getSupabaseClient } from '@/lib/supabase';
import { getEnv } from '@/lib/env';
import { getTelegramInitData } from '@/lib/telegram';
import type { Profile } from '@/types/db';

const profileSelect = 'id, role, handle, handle_norm, bio, telegram_id, username, full_name, avatar_url, created_at';

export type TelegramAuthResult = {
  ok: true;
  profile: Pick<Profile, 'id' | 'role' | 'telegram_id' | 'username'> & Partial<Profile>;
  token: string;
};

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

  const payload = data as ({ error?: string } & Partial<TelegramAuthResult>) | null;

  if (!payload?.ok || !payload.token || !payload.profile?.id || !payload.profile.role) {
    throw new Error('Telegram auth returned an incomplete payload.');
  }

  return payload as TelegramAuthResult;
}
