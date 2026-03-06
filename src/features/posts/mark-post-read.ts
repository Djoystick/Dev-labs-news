import { getSupabaseClient } from '@/lib/supabase';
import { markPostRead as markPostReadLocal, type ReadingMarkMeta } from '@/features/reading/reading-progress';
import { recordTopicRead } from '@/features/recommendations/preferences';

const sentReadMarks = new Set<string>();
const recordedTopicMarks = new Set<string>();

export async function markPostRead(postId: string, meta?: ReadingMarkMeta): Promise<void> {
  if (!postId) {
    return;
  }

  const normalizedTopicKey = meta?.topicKey?.trim();
  if (normalizedTopicKey && !recordedTopicMarks.has(postId)) {
    recordTopicRead(normalizedTopicKey);
    recordedTopicMarks.add(postId);
  }

  if (sentReadMarks.has(postId)) {
    markPostReadLocal(postId, meta);
    return;
  }

  markPostReadLocal(postId, meta);
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
