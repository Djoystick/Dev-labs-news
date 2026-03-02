import { normalizeProfileHandle, normalizeProfileHandleNorm } from '@/features/profile/validation';
import { getSupabaseClient } from '@/lib/supabase';
import type { Favorite, Post, Profile, ReadingHistoryEntry } from '@/types/db';

const postSelect = 'id, topic_id, title, excerpt, content, cover_url, created_at, updated_at, author_id, topic:topics(id, slug, name, created_at)';
const profileSelect = 'id, role, handle, handle_norm, bio, telegram_id, username, full_name, avatar_url, created_at';
const favoriteSelect = `id, user_id, post_id, created_at, post:posts(${postSelect})`;
const historySelect = `id, user_id, post_id, last_read_at, read_count, post:posts(${postSelect})`;

function getProfileErrorMessage(error: { code?: string; message: string }) {
  if (error.code === '23505') {
    return 'Псевдоним уже занят.';
  }

  return 'Не удалось сохранить профиль.';
}

export async function updateProfileDetails(
  userId: string,
  values: {
    avatar_url: string | null;
    bio: string | null;
    full_name: string | null;
    handle: string;
  },
) {
  const supabase = getSupabaseClient();
  const normalizedHandle = normalizeProfileHandle(values.handle);
  const handleNorm = normalizeProfileHandleNorm(values.handle);

  const { data: handleConflict, error: handleConflictError } = await supabase
    .from('profiles')
    .select('id')
    .eq('handle_norm', handleNorm)
    .neq('id', userId)
    .limit(1);

  if (handleConflictError) {
    throw new Error(getProfileErrorMessage(handleConflictError));
  }

  if ((handleConflict ?? []).length > 0) {
    throw new Error('Псевдоним уже занят.');
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({
      avatar_url: values.avatar_url,
      bio: values.bio,
      full_name: values.full_name,
      handle: normalizedHandle,
      handle_norm: handleNorm,
    })
    .eq('id', userId)
    .select(profileSelect)
    .single();

  if (error) {
    throw new Error(getProfileErrorMessage(error));
  }

  return data as Profile;
}

export async function listFavoriteIds(userId: string, signal?: AbortSignal) {
  const supabase = getSupabaseClient();
  let query = supabase.from('favorites').select('post_id').eq('user_id', userId);

  if (signal) {
    query = query.abortSignal(signal);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Не удалось загрузить избранное. ${error.message}`);
  }

  return (data ?? []).map((item) => item.post_id as string);
}

export async function addFavorite(userId: string, postId: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('favorites').insert({
    post_id: postId,
    user_id: userId,
  });

  if (error) {
    throw new Error(`Не удалось добавить в избранное. ${error.message}`);
  }
}

export async function removeFavorite(userId: string, postId: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('favorites').delete().eq('user_id', userId).eq('post_id', postId);

  if (error) {
    throw new Error(`Не удалось убрать из избранного. ${error.message}`);
  }
}

export async function listFavoritePosts(userId: string, signal?: AbortSignal) {
  const supabase = getSupabaseClient();
  let query = supabase.from('favorites').select(favoriteSelect).eq('user_id', userId).order('created_at', { ascending: false });

  if (signal) {
    query = query.abortSignal(signal);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Не удалось загрузить избранное. ${error.message}`);
  }

  return (data ?? []) as Favorite[];
}

export async function listReadingHistory(userId: string, signal?: AbortSignal) {
  const supabase = getSupabaseClient();
  let query = supabase.from('reading_history').select(historySelect).eq('user_id', userId).order('last_read_at', { ascending: false }).limit(30);

  if (signal) {
    query = query.abortSignal(signal);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Не удалось загрузить историю. ${error.message}`);
  }

  return (data ?? []) as ReadingHistoryEntry[];
}

export async function clearFavoritePosts(userId: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('favorites').delete().eq('user_id', userId);

  if (error) {
    throw new Error(`Не удалось очистить избранное. ${error.message}`);
  }
}

export async function clearReadingHistory(userId: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('reading_history').delete().eq('user_id', userId);

  if (error) {
    throw new Error(`Не удалось очистить историю. ${error.message}`);
  }
}

export async function recordPostView(userId: string, postId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('reading_history').select('id, read_count').eq('user_id', userId).eq('post_id', postId).limit(1);

  if (error) {
    throw new Error(`Не удалось записать историю просмотра. ${error.message}`);
  }

  const existingRecord = (data ?? [])[0];

  if (!existingRecord) {
    const { error: insertError } = await supabase.from('reading_history').insert({
      post_id: postId,
      read_count: 1,
      user_id: userId,
    });

    if (insertError) {
      throw new Error(`Не удалось записать историю просмотра. ${insertError.message}`);
    }

    return;
  }

  const { error: updateError } = await supabase
    .from('reading_history')
    .update({
      last_read_at: new Date().toISOString(),
      read_count: Number(existingRecord.read_count ?? 0) + 1,
    })
    .eq('id', existingRecord.id);

  if (updateError) {
    throw new Error(`Не удалось обновить историю просмотра. ${updateError.message}`);
  }
}

export function getProfileDisplayName(profile: Profile | null, fallbackEmail?: string | null) {
  if (profile?.handle) {
    return `@${profile.handle}`;
  }

  if (profile?.username) {
    return `@${profile.username}`;
  }

  if (fallbackEmail) {
    return `@${fallbackEmail.split('@')[0]}`;
  }

  return '@reader';
}

export function getProfileSubtitle(profile: Profile | null) {
  return profile?.bio?.trim() || 'Коротко о себе пока ничего не добавлено.';
}

export function getCompactPostMeta(post: Post) {
  return {
    createdAt: new Date(post.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
    topicName: post.topic?.name ?? 'Новости',
  };
}
