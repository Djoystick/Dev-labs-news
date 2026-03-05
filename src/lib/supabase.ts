import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getStoredAuthToken } from '@/lib/auth-storage';
import { getEnv } from '@/lib/env';
import type { Database } from '@/types/db';

let supabaseClient: SupabaseClient<Database> | null = null;
const globalScope = globalThis as typeof globalThis & {
  __devLabsSupabaseClient?: SupabaseClient<Database>;
};

function resolveSupabaseConfig() {
  const { supabaseAnonKey, supabaseUrl } = getEnv();

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase env: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
    return {
      supabaseAnonKey: supabaseAnonKey || 'missing-anon-key',
      supabaseUrl: supabaseUrl || 'https://invalid.supabase.local',
    };
  }

  return { supabaseAnonKey, supabaseUrl };
}

function setAuthorizationHeader(client: SupabaseClient<Database>, token?: string) {
  const resolvedToken = typeof token === 'string' ? token : getStoredAuthToken() ?? '';
  const rest = (client as unknown as { rest?: { headers?: Record<string, string> } }).rest;

  if (!rest?.headers) {
    return;
  }

  if (resolvedToken) {
    rest.headers.Authorization = `Bearer ${resolvedToken}`;
    return;
  }

  delete rest.headers.Authorization;
}

export function getSupabaseClient(token?: string) {
  if (!supabaseClient) {
    supabaseClient = globalScope.__devLabsSupabaseClient ?? null;
  }

  if (!supabaseClient) {
    const { supabaseAnonKey, supabaseUrl } = resolveSupabaseConfig();
    supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: false,
        persistSession: true,
      },
    });
    globalScope.__devLabsSupabaseClient = supabaseClient;
  }

  setAuthorizationHeader(supabaseClient, token);
  return supabaseClient;
}
