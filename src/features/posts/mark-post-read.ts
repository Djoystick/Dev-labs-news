import { getSupabaseClient } from '@/lib/supabase';

const sentReadMarks = new Set<string>();

export async function markPostRead(postId: string): Promise<void> {
  if (!postId || sentReadMarks.has(postId)) {
    return;
  }

  sentReadMarks.add(postId);

  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('mark_post_read', { p_post_id: postId });

  if (error) {
    sentReadMarks.delete(postId);

    if (import.meta.env.DEV) {
      console.debug('[markPostRead] failed', error);
    }
  }
}
