import type { Session, User } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase';
import { getTelegramInitData, getTelegramUser } from '@/lib/telegram';
import type { Profile } from '@/types/db';

function getProfileDefaults(user: User) {
  return {
    avatar_url: typeof user.user_metadata.avatar_url === 'string' ? user.user_metadata.avatar_url : null,
    bio: null,
    full_name:
      typeof user.user_metadata.full_name === 'string'
        ? user.user_metadata.full_name
        : typeof user.user_metadata.name === 'string'
          ? user.user_metadata.name
          : null,
    handle: null,
    handle_norm: null,
    telegram_id: typeof user.user_metadata.telegram_id === 'string' ? user.user_metadata.telegram_id : null,
    username: typeof user.user_metadata.username === 'string' ? user.user_metadata.username : null,
  };
}

export async function getCurrentSession() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw new Error(error.message);
  }

  return data.session;
}

export async function signInWithPassword(email: string, password: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function signUpWithPassword(email: string, password: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function signOutUser() {
  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error(error.message);
  }
}

export async function resetPasswordForEmail(email: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/profile`,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function fetchProfile(userId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, handle, handle_norm, bio, telegram_id, username, full_name, avatar_url, created_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as Profile | null) ?? null;
}

export async function createProfileForUser(user: User) {
  const supabase = getSupabaseClient();
  const payload = {
    id: user.id,
    role: 'user' as const,
    ...getProfileDefaults(user),
  };
  const { data, error } = await supabase
    .from('profiles')
    .upsert(payload, {
      onConflict: 'id',
    })
    .select('id, role, handle, handle_norm, bio, telegram_id, username, full_name, avatar_url, created_at')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Profile;
}

export async function updateOwnProfile(
  userId: string,
  values: Partial<Pick<Profile, 'avatar_url' | 'bio' | 'full_name' | 'handle' | 'handle_norm' | 'telegram_id' | 'username'>>,
) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('profiles')
    .update(values)
    .eq('id', userId)
    .select('id, role, handle, handle_norm, bio, telegram_id, username, full_name, avatar_url, created_at')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Profile;
}

export async function ensureProfile(user: User) {
  const existingProfile = await fetchProfile(user.id);

  if (existingProfile) {
    return existingProfile;
  }

  return createProfileForUser(user);
}

export async function syncProfileFromUser(user: User) {
  const profile = await ensureProfile(user);
  const defaults = getProfileDefaults(user);

  if (
    profile.full_name !== defaults.full_name ||
    profile.avatar_url !== defaults.avatar_url ||
    profile.username !== defaults.username ||
    profile.telegram_id !== defaults.telegram_id
  ) {
    try {
      return await updateOwnProfile(user.id, defaults);
    } catch {
      return profile;
    }
  }

  return profile;
}

export async function exchangeTelegramAuth() {
  const supabase = getSupabaseClient();
  const initData = getTelegramInitData();
  const telegramUser = getTelegramUser();

  if (!initData || !telegramUser) {
    throw new Error('Open the app inside Telegram to use Telegram sign-in, or use Email/Password instead.');
  }

  const { data, error } = await supabase.functions.invoke<{ email: string; password: string }>('telegram-auth', {
    body: { initData },
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.email || !data.password) {
    throw new Error('Telegram auth returned an incomplete payload.');
  }

  return signInWithPassword(data.email, data.password);
}

export function subscribeToAuthChanges(callback: (session: Session | null) => void) {
  const supabase = getSupabaseClient();
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
}
