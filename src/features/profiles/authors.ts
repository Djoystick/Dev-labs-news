import { normalizeHandle } from '@/lib/author-label';
import { getSupabaseClient } from '@/lib/supabase';

export type AuthorMap = Map<string, string>;

type AuthorRow = {
  id: string;
  nickname?: string | null;
  username?: string | null;
  handle: string | null;
  display_name?: string | null;
  full_name?: string | null;
};

export async function fetchAuthorHandles(authorIds: string[], signal?: AbortSignal): Promise<AuthorMap> {
  const uniqueIds = [...new Set(authorIds.filter(Boolean))];

  if (uniqueIds.length === 0) {
    return new Map();
  }

  const supabase = getSupabaseClient();
  let query = supabase.from('profiles').select('id, handle, username, full_name').in('id', uniqueIds);

  if (signal) {
    query = query.abortSignal(signal);
  }

  const result: AuthorMap = new Map();
  const { data, error } = await query;

  const pickHandle = (row: AuthorRow) =>
    normalizeHandle(row.nickname) ??
    normalizeHandle(row.username) ??
    normalizeHandle(row.handle) ??
    normalizeHandle(row.display_name) ??
    normalizeHandle(row.full_name);

  if (!error) {
    for (const row of (data ?? []) as AuthorRow[]) {
      const normalized = pickHandle(row);

      if (normalized) {
        result.set(row.id, normalized);
      }
    }
  }

  const unresolvedIds = uniqueIds.filter((id) => !result.has(id));

  if (!error && unresolvedIds.length === 0) {
    return result;
  }

  let rpcQuery = supabase.rpc('get_author_handles', { p_ids: unresolvedIds.length > 0 ? unresolvedIds : uniqueIds });

  if (signal) {
    rpcQuery = rpcQuery.abortSignal(signal);
  }

  const { data: rpcData, error: rpcError } = await rpcQuery;

  if (rpcError) {
    if (result.size > 0) {
      return result;
    }

    if (error) {
      throw new Error(`Failed to load author handles. ${error.message}`);
    }

    throw new Error(`Failed to load author handles. ${rpcError.message}`);
  }

  for (const row of (rpcData ?? []) as AuthorRow[]) {
    const normalized = pickHandle(row);

    if (normalized) {
      result.set(row.id, normalized);
    }
  }

  return result;
}
