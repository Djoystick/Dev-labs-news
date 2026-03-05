import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { exchangeTelegramAuth, fetchOwnProfile } from '@/features/auth/api';
import { clearStoredAuthState, getStoredAuthState, setStoredAuthState } from '@/lib/auth-storage';
import { hasSupabaseEnv } from '@/lib/env';
import { getSupabaseClient, setSupabaseAuthToken } from '@/lib/supabase';
import { getTelegramInitData } from '@/lib/telegram';
import type { Profile, UserRole } from '@/types/db';

export type AuthUser = {
  email: string | null;
  id: string;
};

type AuthContextValue = {
  authReady: boolean;
  isAdmin: boolean;
  isAuthed: boolean;
  loading: boolean;
  profile: Profile | null;
  refreshProfile: () => Promise<Profile | null>;
  role: UserRole | null;
  session: Session | null;
  signInWithTelegram: () => Promise<void>;
  signOut: () => Promise<void>;
  token: string | null;
  user: AuthUser | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function parseJwtExp(token: string): number | null {
  const payload = token.split('.')[1];

  if (!payload) {
    return null;
  }

  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(normalized)) as { exp?: number };
    return typeof decoded.exp === 'number' ? decoded.exp : null;
  } catch {
    return null;
  }
}

function isTokenExpired(token: string, skewSec = 60): boolean {
  const exp = parseJwtExp(token);

  if (!exp) {
    return true;
  }

  const now = Math.floor(Date.now() / 1000);
  return exp <= now + skewSec;
}

function buildSessionFromToken(token: string, authUser: User): Session {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = parseJwtExp(token) ?? now + 60 * 60 * 24;
  const expiresIn = Math.max(1, expiresAt - now);

  return {
    access_token: token,
    expires_at: expiresAt,
    expires_in: expiresIn,
    refresh_token: '',
    token_type: 'bearer',
    user: authUser,
  };
}

function buildSessionFromProfile(token: string, profileId: string): Session {
  return buildSessionFromToken(token, {
    app_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
    id: profileId,
    role: 'authenticated',
    user_metadata: {},
  } as User);
}

function toAuthUser(session: Session | null): AuthUser | null {
  const authUser = session?.user;

  if (!authUser) {
    return null;
  }

  return {
    email: authUser.email ?? null,
    id: authUser.id,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const applyAuthState = (nextToken: string | null, nextProfile: Profile | null) => {
    setToken(nextToken);
    setSupabaseAuthToken(nextToken);
    setProfile(nextProfile);
  };

  const refreshProfile = async () => {
    if (!token || !profile?.id) {
      applyAuthState(null, null);
      setSession(null);
      return null;
    }

    const nextProfile = await fetchOwnProfile(profile.id, token);

    if (!nextProfile) {
      clearStoredAuthState();
      applyAuthState(null, null);
      setSession(null);
      return null;
    }

    setStoredAuthState({ profile: nextProfile, token });
    applyAuthState(token, nextProfile);
    return nextProfile;
  };

  useEffect(() => {
    if (!hasSupabaseEnv()) {
      setSession(null);
      applyAuthState(null, null);
      setAuthReady(true);
      setLoading(false);
      return;
    }

    const supabase = getSupabaseClient();
    const storedAuth = getStoredAuthState();
    const validStoredAuth =
      storedAuth && !isTokenExpired(storedAuth.token)
        ? storedAuth
        : null;

    if (storedAuth && !validStoredAuth) {
      clearStoredAuthState();
      applyAuthState(null, null);
      setSupabaseAuthToken(null);
    } else if (validStoredAuth) {
      applyAuthState(validStoredAuth.token, validStoredAuth.profile);
    } else {
      applyAuthState(null, null);
    }

    let active = true;

    const hydrateSessionFromToken = async (authToken: string) => {
      const { data, error } = await supabase.auth.getUser(authToken);

      if (error || !data.user) {
        return null;
      }

      return buildSessionFromToken(authToken, data.user);
    };

    const bootstrapAuth = async () => {
      setLoading(true);
      setAuthReady(false);

      let nextSession: Session | null = null;

      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      nextSession = currentSession ?? null;

      if (!nextSession && validStoredAuth?.token) {
        nextSession = await hydrateSessionFromToken(validStoredAuth.token);
        if (!nextSession && validStoredAuth.profile.id) {
          nextSession = buildSessionFromProfile(validStoredAuth.token, validStoredAuth.profile.id);
        }
      }

      const initData = getTelegramInitData().trim();

      if (!nextSession && initData) {
        try {
          const result = await exchangeTelegramAuth(initData);
          const nextProfile = result.profile as Profile;
          setStoredAuthState({ profile: nextProfile, token: result.token });

          if (active) {
            applyAuthState(result.token, nextProfile);
          }

          nextSession = await hydrateSessionFromToken(result.token);
          if (!nextSession) {
            nextSession = buildSessionFromProfile(result.token, nextProfile.id);
          }
        } catch {
          // no-op: keep existing stored auth state
        }
      }

      if (!active) {
        return;
      }

      setSession(nextSession);
      setAuthReady(true);
      setLoading(false);
    };

    void bootstrapAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) {
        return;
      }

      setSession(nextSession);
      setAuthReady(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => {
      const user = toAuthUser(session);
      const isAuthed = authReady && Boolean(session?.user);

      return {
        authReady,
        isAdmin: profile?.role === 'admin',
        isAuthed,
        loading: loading || !authReady,
        profile,
        refreshProfile,
        role: profile?.role ?? null,
        session,
        signInWithTelegram: async () => {
          const supabase = getSupabaseClient();
          setLoading(true);
          setAuthReady(false);

          try {
            const result = await exchangeTelegramAuth();
            const nextProfile = result.profile as Profile;
            setStoredAuthState({ profile: nextProfile, token: result.token });
            applyAuthState(result.token, nextProfile);

            const { data, error } = await supabase.auth.getUser(result.token);
            const nextSession = !error && data.user
              ? buildSessionFromToken(result.token, data.user)
              : buildSessionFromProfile(result.token, nextProfile.id);
            setSession(nextSession);
          } finally {
            setAuthReady(true);
            setLoading(false);
          }
        },
        signOut: async () => {
          const supabase = getSupabaseClient();
          await supabase.auth.signOut();
          clearStoredAuthState();
          setSession(null);
          applyAuthState(null, null);
          setSupabaseAuthToken(null);
          setAuthReady(true);
        },
        token,
        user,
      };
    },
    [authReady, loading, profile, session, token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
