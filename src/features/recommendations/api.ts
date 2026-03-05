import { getSupabaseClient } from '@/lib/supabase';
import type { Post } from '@/types/db';

export async function getRecommendedPosts(limit = 20, signal?: AbortSignal): Promise<Post[]> {
  const supabase = getSupabaseClient();
  let query = supabase.rpc('get_recommended_posts', { p_limit: limit });

  if (signal) {
    query = query.abortSignal(signal);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load recommendations. ${error.message}`);
  }

  return (data ?? []) as Post[];
}
