import { normalizeHandle } from '@/lib/author-label';
import { getSupabaseClient } from '@/lib/supabase';

export type AuthorMap = Map<string, string>;

type AuthorRow = {
  id: string;
  handle: string | null;
};

export async function fetchAuthorHandles(authorIds: string[], signal?: AbortSignal): Promise<AuthorMap> {
  const uniqueIds = [...new Set(authorIds.filter(Boolean))];

  if (uniqueIds.length === 0) {
    return new Map();
  }

  const supabase = getSupabaseClient();
  let query = supabase.from('profiles').select('id, handle').in('id', uniqueIds);

  if (signal) {
    query = query.abortSignal(signal);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load author handles. ${error.message}`);
  }

  const result: AuthorMap = new Map();

  for (const row of (data ?? []) as AuthorRow[]) {
    const normalized = normalizeHandle(row.handle);

    if (normalized) {
      result.set(row.id, normalized);
    }
  }

  return result;
}
