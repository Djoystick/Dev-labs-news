import { getSupabaseClient } from '@/lib/supabase';
import type { Post } from '@/types/db';

const postSelect =
  'id, topic_id, title, excerpt, content, cover_url, created_at, updated_at, author_id, topic:topics(id, slug, name, created_at), author:profiles!posts_author_id_fkey(handle, username, full_name)';

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

  const recommendedRows = (data ?? []) as Array<Pick<Post, 'id'>>;

  if (recommendedRows.length === 0) {
    return [];
  }

  const orderedIds = recommendedRows.map((post) => post.id);
  let postsQuery = supabase.from('posts').select(postSelect).in('id', orderedIds);

  if (signal) {
    postsQuery = postsQuery.abortSignal(signal);
  }

  const { data: hydratedPosts, error: hydrationError } = await postsQuery;

  if (hydrationError) {
    throw new Error(`Failed to load recommendations. ${hydrationError.message}`);
  }

  const postsById = new Map((hydratedPosts ?? []).map((post) => [post.id as string, post as Post]));
  return orderedIds.map((id) => postsById.get(id)).filter((post): post is Post => Boolean(post));
}
