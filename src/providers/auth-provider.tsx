import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import {
  ensureProfile,
  exchangeTelegramAuth,
  getCurrentSession,
  resetPasswordForEmail,
  signInWithPassword,
  signOutUser,
  signUpWithPassword,
  subscribeToAuthChanges,
  syncProfileFromUser,
} from '@/features/auth/api';
import { hasSupabaseEnv } from '@/lib/env';
import type { Profile } from '@/types/db';

type AuthContextValue = {
  isAdmin: boolean;
  isAuthed: boolean;
  loading: boolean;
  profile: Profile | null;
  refreshProfile: () => Promise<Profile | null>;
  resetPassword: (email: string) => Promise<void>;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithTelegram: () => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ requiresEmailConfirmation: boolean }>;
  user: User | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function resolveProfileForUser(user: User | null) {
  if (!user) {
    return null;
  }

  return syncProfileFromUser(user);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    if (!user) {
      setProfile(null);
      return null;
    }

    const nextProfile = await ensureProfile(user);
    setProfile(nextProfile);
    return nextProfile;
  };

  useEffect(() => {
    if (!hasSupabaseEnv()) {
      setLoading(false);
      setSession(null);
      setUser(null);
      setProfile(null);
      return;
    }

    let active = true;

    void getCurrentSession()
      .then(async (currentSession) => {
        if (!active) {
          return;
        }

        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setProfile(await resolveProfileForUser(currentSession?.user ?? null));
      })
      .catch(() => {
        if (active) {
          setSession(null);
          setUser(null);
          setProfile(null);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    const { data } = subscribeToAuthChanges(async (nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(true);

      try {
        setProfile(await resolveProfileForUser(nextSession?.user ?? null));
      } finally {
        setLoading(false);
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAdmin: profile?.role === 'admin',
      isAuthed: Boolean(session?.user),
      loading,
      profile,
      refreshProfile,
      resetPassword: async (email: string) => {
        await resetPasswordForEmail(email);
      },
      session,
      signIn: async (email: string, password: string) => {
        setLoading(true);
        try {
          const result = await signInWithPassword(email, password);
          setSession(result.session);
          setUser(result.user);
          setProfile(await resolveProfileForUser(result.user));
        } finally {
          setLoading(false);
        }
      },
      signInWithTelegram: async () => {
        setLoading(true);
        try {
          const result = await exchangeTelegramAuth();
          setSession(result.session);
          setUser(result.user);
          setProfile(await resolveProfileForUser(result.user));
        } finally {
          setLoading(false);
        }
      },
      signOut: async () => {
        setLoading(true);
        try {
          await signOutUser();
          setSession(null);
          setUser(null);
          setProfile(null);
        } finally {
          setLoading(false);
        }
      },
      signUp: async (email: string, password: string) => {
        setLoading(true);
        try {
          const result = await signUpWithPassword(email, password);

          if (result.user && result.session) {
            setSession(result.session);
            setUser(result.user);
            setProfile(await resolveProfileForUser(result.user));
          }

          return {
            requiresEmailConfirmation: Boolean(result.user) && !result.session,
          };
        } finally {
          setLoading(false);
        }
      },
      user,
    }),
    [loading, profile, session, user],
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
