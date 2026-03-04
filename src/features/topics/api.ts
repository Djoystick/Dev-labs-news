import { getSupabaseClient } from '@/lib/supabase';
import type { Topic, UserTopicPreferenceRow } from '@/types/db';

let cachedTopics: Topic[] | null = null;
let topicsRequest: Promise<Topic[]> | null = null;

export async function fetchTopics(signal?: AbortSignal, options?: { force?: boolean }) {
  if (cachedTopics && !options?.force) {
    return cachedTopics;
  }

  if (topicsRequest && !options?.force) {
    return topicsRequest;
  }

  topicsRequest = (async () => {
    const supabase = getSupabaseClient();
    let query = supabase.from('topics').select('id, slug, name, created_at').order('name', { ascending: true });

    if (signal) {
      query = query.abortSignal(signal);
    }

    const { data, error } = await query;

    if (error) {
      topicsRequest = null;
      throw new Error(`Failed to load topics. ${error.message}`);
    }

    cachedTopics = (data ?? []) as Topic[];
    topicsRequest = null;
    return cachedTopics;
  })();

  return topicsRequest;
}

export async function listTopics(signal?: AbortSignal, options?: { force?: boolean }) {
  return fetchTopics(signal, options);
}

export async function fetchMyTopicIds(userId: string, signal?: AbortSignal) {
  const supabase = getSupabaseClient();
  let query = supabase.from('user_topic_preferences').select('topic_id').eq('user_id', userId);

  if (signal) {
    query = query.abortSignal(signal);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load topic preferences. ${error.message}`);
  }

  return (data ?? []).map((item) => (item as Pick<UserTopicPreferenceRow, 'topic_id'>).topic_id);
}

export async function setMyTopics(topicIds: string[]) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('set_my_topics', { topic_ids: topicIds });

  if (error) {
    throw new Error(`Failed to save topic preferences. ${error.message}`);
  }

  return Number(data ?? 0);
}

export function clearTopicsCache() {
  cachedTopics = null;
  topicsRequest = null;
}
