import { getSupabaseClient } from '@/lib/supabase';
import type { Topic } from '@/types/db';

let cachedTopics: Topic[] | null = null;
let topicsRequest: Promise<Topic[]> | null = null;

export async function listTopics(signal?: AbortSignal, options?: { force?: boolean }) {
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

export function clearTopicsCache() {
  cachedTopics = null;
  topicsRequest = null;
}
