import { getSupabaseClient } from '@/lib/supabase';
import { requireEnv } from '@/lib/env';
import { getTelegramInitData } from '@/lib/telegram';
import type { Profile } from '@/types/db';

const profileSelect = 'id, role, handle, handle_norm, bio, telegram_id, username, full_name, avatar_url, created_at';

export type TelegramAuthResult = {
  ok: true;
  profile: Pick<Profile, 'id' | 'role' | 'telegram_id' | 'username'> & Partial<Profile>;
  token: string;
};

export async function fetchOwnProfile(userId: string, token?: string) {
  const supabase = getSupabaseClient(token);
  const { data, error } = await supabase.from('profiles').select(profileSelect).eq('id', userId).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as Profile | null) ?? null;
}

export async function exchangeTelegramAuth(initDataOverride?: string) {
  const initData = initDataOverride ?? getTelegramInitData();

  if (!initData) {
    throw new Error('Open the mini app inside Telegram and try Telegram sign-in again.');
  }

  const { supabaseUrl } = requireEnv();
  const response = await fetch(`${supabaseUrl}/functions/v1/telegram-auth`, {
    body: JSON.stringify({ initData }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  let payload: { error?: string } & Partial<TelegramAuthResult> | null = null;

  try {
    payload = (await response.json()) as ({ error?: string } & Partial<TelegramAuthResult>) | null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(payload?.error ?? 'Telegram sign-in failed.');
  }

  if (!payload?.ok || !payload.token || !payload.profile?.id || !payload.profile.role) {
    throw new Error('Telegram auth returned an incomplete payload.');
  }

  return payload as TelegramAuthResult;
}
