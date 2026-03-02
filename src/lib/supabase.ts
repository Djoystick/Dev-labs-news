import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getStoredAuthToken } from '@/lib/auth-storage';
import { requireEnv } from '@/lib/env';
import type { Database } from '@/types/db';

const supabaseClientCache = new Map<string, SupabaseClient<Database>>();

export function getSupabaseClient(token?: string) {
  const resolvedToken = typeof token === 'string' ? token : getStoredAuthToken() ?? '';
  const cacheKey = resolvedToken || '__anon__';
  const cachedClient = supabaseClientCache.get(cacheKey);

  if (cachedClient) {
    return cachedClient;
  }

  const { supabaseAnonKey, supabaseUrl } = requireEnv();
  const client = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
    global: {
      headers: resolvedToken ? { Authorization: `Bearer ${resolvedToken}` } : {},
    },
  });

  supabaseClientCache.set(cacheKey, client);
  return client;
}
