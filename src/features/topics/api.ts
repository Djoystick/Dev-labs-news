import { getSupabaseClient } from '@/lib/supabase';
import type { Topic } from '@/types/db';

export async function listTopics(signal?: AbortSignal) {
  const supabase = getSupabaseClient();
  let query = supabase.from('topics').select('id, slug, name, created_at').order('name', { ascending: true });

  if (signal) {
    query = query.abortSignal(signal);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load topics. ${error.message}`);
  }

  return (data ?? []) as Topic[];
}
