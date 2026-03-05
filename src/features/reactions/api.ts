import { getSupabaseClient } from '@/lib/supabase';

export type ReactionValue = -1 | 0 | 1;

export type ReactionSummary = {
  post_id: string;
  likes: number;
  dislikes: number;
  my_reaction: ReactionValue;
};

function toSummary(row: Partial<ReactionSummary> & { post_id: string }): ReactionSummary {
  const reaction = Number(row.my_reaction ?? 0);
  const normalizedReaction: ReactionValue = reaction === 1 ? 1 : reaction === -1 ? -1 : 0;

  return {
    post_id: row.post_id,
    likes: Number(row.likes ?? 0),
    dislikes: Number(row.dislikes ?? 0),
    my_reaction: normalizedReaction,
  };
}

export async function fetchReactionSummaries(postIds: string[], signal?: AbortSignal): Promise<Map<string, ReactionSummary>> {
  const uniqueIds = [...new Set(postIds.filter(Boolean))];

  if (uniqueIds.length === 0) {
    return new Map();
  }

  const supabase = getSupabaseClient();
  let query = supabase.rpc('get_post_reaction_summaries', { p_post_ids: uniqueIds });

  if (signal) {
    query = query.abortSignal(signal);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load reactions. ${error.message}`);
  }

  const map = new Map<string, ReactionSummary>();
  for (const row of (data ?? []) as Array<Partial<ReactionSummary> & { post_id: string }>) {
    const summary = toSummary(row);
    map.set(summary.post_id, summary);
  }

  for (const postId of uniqueIds) {
    if (!map.has(postId)) {
      map.set(postId, {
        post_id: postId,
        likes: 0,
        dislikes: 0,
        my_reaction: 0,
      });
    }
  }

  return map;
}

export async function toggleReaction(postId: string, value: -1 | 1, signal?: AbortSignal): Promise<ReactionSummary> {
  const supabase = getSupabaseClient();
  let query = supabase.rpc('toggle_post_reaction', {
    p_post_id: postId,
    p_value: value,
  });

  if (signal) {
    query = query.abortSignal(signal);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to update reaction. ${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : null;

  if (!row || !row.post_id) {
    return {
      post_id: postId,
      likes: 0,
      dislikes: 0,
      my_reaction: 0,
    };
  }

  return toSummary(row as Partial<ReactionSummary> & { post_id: string });
}
