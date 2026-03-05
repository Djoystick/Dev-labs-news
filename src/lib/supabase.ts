import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getStoredAuthState } from '@/lib/auth-storage';
import { getEnv } from '@/lib/env';
import type { Database } from '@/types/db';

let supabaseClient: SupabaseClient<Database> | null = null;
let currentAuthToken: string | null = null;

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

function resolveAuthToken(): string | null {
  if (currentAuthToken) {
    return currentAuthToken;
  }

  const stored = getStoredAuthState();
  return stored?.token ?? null;
}

function createAuthFetch(supabaseUrl: string): typeof fetch {
  const nativeFetch: typeof fetch = (...args) => fetch(...args);

  return async (input, init) => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
    const token = resolveAuthToken();
    const isSupabaseRequest = url.startsWith(supabaseUrl);

    const shouldAttach = Boolean(
      token
      && isSupabaseRequest
      && (url.includes('/rest/v1/') || url.includes('/storage/v1/') || url.includes('/functions/v1/')),
    );

    if (!shouldAttach) {
      return nativeFetch(input, init);
    }

    const request = input instanceof Request ? input : new Request(input, init);
    const headers = new Headers(request.headers);

    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const nextRequest = new Request(request, { headers });
    return nativeFetch(nextRequest);
  };
}

export function setSupabaseAuthToken(token: string | null) {
  currentAuthToken = token;
}

export function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = globalScope.__devLabsSupabaseClient ?? null;
  }

  if (!supabaseClient) {
    const { supabaseAnonKey, supabaseUrl } = resolveSupabaseConfig();
    supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
      global: {
        fetch: createAuthFetch(supabaseUrl),
      },
    });
    globalScope.__devLabsSupabaseClient = supabaseClient;
  }

  return supabaseClient;
}
