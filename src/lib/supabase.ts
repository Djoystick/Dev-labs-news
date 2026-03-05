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

function createAuthFetch(supabaseUrl: string, supabaseAnonKey: string): typeof fetch {
  const nativeFetch: typeof fetch = (...args) => fetch(...args);
  const supabaseHost = new URL(supabaseUrl).host;

  return async (input, init) => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
    let parsedUrl: URL | null = null;

    try {
      parsedUrl = new URL(url, supabaseUrl);
    } catch {
      parsedUrl = null;
    }

    const isSupabaseRequest = Boolean(parsedUrl && parsedUrl.host === supabaseHost);
    const pathname = parsedUrl?.pathname ?? '';
    const shouldAttach = isSupabaseRequest
      && (
        pathname.includes('/rest/v1/')
        || pathname.includes('/storage/v1/')
        || pathname.includes('/functions/v1/')
        || pathname.includes('/auth/v1/')
      );

    if (!shouldAttach) {
      return nativeFetch(input, init);
    }

    const merged = new Headers();

    if (input instanceof Request) {
      input.headers.forEach((value, key) => {
        merged.set(key, value);
      });
    }

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => {
        merged.set(key, value);
      });
    }

    if (!merged.has('apikey')) {
      merged.set('apikey', supabaseAnonKey);
    }

    const token = resolveAuthToken();
    if (token && !merged.has('authorization')) {
      merged.set('Authorization', `Bearer ${token}`);
    }

    if (import.meta.env.DEV && pathname.includes('/rest/v1/')) {
      console.debug('[supabase authFetch]', {
        hasApiKey: merged.has('apikey'),
        hasAuth: merged.has('authorization'),
        path: pathname,
        tokenPresent: Boolean(token),
      });
    }

    return nativeFetch(input, { ...(init ?? {}), headers: merged });
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
        fetch: createAuthFetch(supabaseUrl, supabaseAnonKey),
      },
    });
    globalScope.__devLabsSupabaseClient = supabaseClient;
  }

  return supabaseClient;
}
