import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { addFavorite, listFavoriteIds, removeFavorite } from '@/features/profile/api';
import { useAuth } from '@/providers/auth-provider';

type LibraryContextValue = {
  favoritesLoading: boolean;
  isFavorite: (postId: string) => boolean;
  isFavoritePending: (postId: string) => boolean;
  refreshFavorites: () => Promise<void>;
  toggleFavorite: (postId: string) => Promise<boolean>;
};

const LibraryContext = createContext<LibraryContextValue | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);

  const refreshFavorites = async (signal?: AbortSignal) => {
    if (!user) {
      setFavoriteIds([]);
      setPendingIds([]);
      setFavoritesLoading(false);
      return;
    }

    const ids = await listFavoriteIds(user.id, signal);

    if (!signal?.aborted) {
      setFavoriteIds(ids);
    }
  };

  useEffect(() => {
    if (!user) {
      setFavoriteIds([]);
      setPendingIds([]);
      setFavoritesLoading(false);
      return;
    }

    const controller = new AbortController();
    setFavoritesLoading(true);

    void refreshFavorites(controller.signal)
      .catch(() => {
        if (!controller.signal.aborted) {
          setFavoriteIds([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setFavoritesLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [user]);

  const value = useMemo<LibraryContextValue>(
    () => ({
      favoritesLoading,
      isFavorite: (postId: string) => favoriteIds.includes(postId),
      isFavoritePending: (postId: string) => pendingIds.includes(postId),
      refreshFavorites: async () => {
        await refreshFavorites();
      },
      toggleFavorite: async (postId: string) => {
        if (!user) {
          throw new Error('Войдите в аккаунт, чтобы сохранять материалы.');
        }

        const currentlyFavorite = favoriteIds.includes(postId);
        setPendingIds((current) => [...current, postId]);

        try {
          if (currentlyFavorite) {
            await removeFavorite(user.id, postId);
            setFavoriteIds((current) => current.filter((id) => id !== postId));
            return false;
          }

          await addFavorite(user.id, postId);
          setFavoriteIds((current) => (current.includes(postId) ? current : [...current, postId]));
          return true;
        } finally {
          setPendingIds((current) => current.filter((id) => id !== postId));
        }
      },
    }),
    [favoriteIds, favoritesLoading, pendingIds, user],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const context = useContext(LibraryContext);

  if (!context) {
    throw new Error('useLibrary must be used within LibraryProvider');
  }

  return context;
}
