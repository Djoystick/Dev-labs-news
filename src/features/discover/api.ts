import { getSupabaseClient } from '@/lib/supabase';
import type { Post } from '@/types/db';

const postSelect =
  'id, topic_id, title, excerpt, content, cover_url, created_at, updated_at, author_id, topic:topics(id, slug, name, created_at)';

export async function fetchPostsByTopic(topicId: string, limit: number, signal?: AbortSignal): Promise<Post[]> {
  const supabase = getSupabaseClient();
  let query = supabase.from('posts').select(postSelect).eq('topic_id', topicId).order('created_at', { ascending: false }).limit(limit);

  if (signal) {
    query = query.abortSignal(signal);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load posts for topic. ${error.message}`);
  }

  return (data ?? []) as Post[];
}
