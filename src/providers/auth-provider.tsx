import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { exchangeTelegramAuth, fetchOwnProfile } from '@/features/auth/api';
import { clearStoredAuthState, getStoredAuthState, setStoredAuthState } from '@/lib/auth-storage';
import { hasSupabaseEnv } from '@/lib/env';
import { getTelegramInitData } from '@/lib/telegram';
import type { Profile } from '@/types/db';

export type AuthUser = {
  email: string | null;
  id: string;
};

type AuthContextValue = {
  isAdmin: boolean;
  isAuthed: boolean;
  loading: boolean;
  profile: Profile | null;
  refreshProfile: () => Promise<Profile | null>;
  signInWithTelegram: () => Promise<void>;
  signOut: () => Promise<void>;
  token: string | null;
  user: AuthUser | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function toAuthUser(profile: Profile | null): AuthUser | null {
  if (!profile) {
    return null;
  }

  return {
    email: null,
    id: profile.id,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const applyAuthState = (nextToken: string | null, nextProfile: Profile | null) => {
    setToken(nextToken);
    setProfile(nextProfile);
    setUser(toAuthUser(nextProfile));
  };

  const refreshProfile = async () => {
    if (!token || !profile?.id) {
      applyAuthState(null, null);
      return null;
    }

    const nextProfile = await fetchOwnProfile(profile.id, token);

    if (!nextProfile) {
      clearStoredAuthState();
      applyAuthState(null, null);
      return null;
    }

    setStoredAuthState({ profile: nextProfile, token });
    applyAuthState(token, nextProfile);
    return nextProfile;
  };

  useEffect(() => {
    if (!hasSupabaseEnv()) {
      setLoading(false);
      applyAuthState(null, null);
      return;
    }

    const storedAuth = getStoredAuthState();

    if (storedAuth) {
      applyAuthState(storedAuth.token, storedAuth.profile);
    }

    let active = true;
    const initData = getTelegramInitData().trim();

    if (!initData) {
      setLoading(false);
      return;
    }

    setLoading(true);

    void exchangeTelegramAuth(initData)
      .then((result) => {
        if (!active) {
          return;
        }

        const nextProfile = result.profile as Profile;
        setStoredAuthState({ profile: nextProfile, token: result.token });
        applyAuthState(result.token, nextProfile);
      })
      .catch(() => {
        if (!active && !storedAuth) {
          return;
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAdmin: profile?.role === 'admin',
      isAuthed: Boolean(token && profile),
      loading,
      profile,
      refreshProfile,
      signInWithTelegram: async () => {
        setLoading(true);
        try {
          const result = await exchangeTelegramAuth();
          const nextProfile = result.profile as Profile;
          setStoredAuthState({ profile: nextProfile, token: result.token });
          applyAuthState(result.token, nextProfile);
        } finally {
          setLoading(false);
        }
      },
      signOut: async () => {
        clearStoredAuthState();
        applyAuthState(null, null);
      },
      token,
      user,
    }),
    [loading, profile, token, user],
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
