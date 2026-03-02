import { getSupabaseClient } from '@/lib/supabase';
import type { Topic } from '@/types/db';

export async function listTopics() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('topics').select('id, slug, name, created_at').order('name', { ascending: true });

  if (error) {
    throw new Error(`Failed to load topics. ${error.message}`);
  }

  return (data ?? []) as Topic[];
}
