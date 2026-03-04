import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container } from '@/components/layout/container';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StateCard } from '@/components/ui/state-card';
import { listFavoritePosts } from '@/features/profile/api';
import { ProfileEmptyState } from '@/features/profile/components/profile-empty-state';
import { ProfilePostRow } from '@/features/profile/components/profile-post-row';
import { useAuth } from '@/providers/auth-provider';
import type { Favorite } from '@/types/db';

export function SavedArticlesPage() {
  const navigate = useNavigate();
  const { isAuthed, loading, user } = useAuth();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(true);
  const [favoritesError, setFavoritesError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (!user?.id) {
      setFavorites([]);
      setFavoritesLoading(false);
      return;
    }

    const controller = new AbortController();
    setFavoritesLoading(true);
    setFavoritesError(null);

    void listFavoritePosts(user.id, controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) {
          setFavorites(items.filter((item) => item.post));
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setFavoritesError(error instanceof Error ? error.message : 'Failed to load saved articles.');
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
  }, [retryToken, user?.id]);

  if (loading) {
    return (
      <Container className="safe-pb py-6 sm:py-8">
        <div className="mx-auto max-w-4xl space-y-4">
          <Skeleton className="h-10 w-32 rounded-full" />
          <Skeleton className="h-28 w-full rounded-[2rem]" />
          <Skeleton className="h-28 w-full rounded-[2rem]" />
        </div>
      </Container>
    );
  }

  if (!isAuthed || !user) {
    return (
      <Container className="safe-pb py-6 sm:py-8">
        <div className="mx-auto max-w-3xl space-y-4">
          <Button type="button" variant="ghost" className="rounded-full" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <StateCard title="Sign in required" description="Sign in to view your saved articles." />
        </div>
      </Container>
    );
  }

  return (
    <Container className="safe-pb py-6 sm:py-8">
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" className="rounded-full" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <h1 className="text-3xl font-extrabold">Saved articles</h1>
        </div>

        {favoritesLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full rounded-[1.5rem]" />
            <Skeleton className="h-28 w-full rounded-[1.5rem]" />
            <Skeleton className="h-28 w-full rounded-[1.5rem]" />
          </div>
        ) : favoritesError ? (
          <StateCard title="Saved articles unavailable" description={favoritesError} actionLabel="Retry" onAction={() => setRetryToken((current) => current + 1)} />
        ) : favorites.length === 0 ? (
          <ProfileEmptyState mode="favorites" description="Save stories from the feed or the article page to keep them here." />
        ) : (
          <div className="space-y-3">
            {favorites.map((item) =>
              item.post ? (
                <ProfilePostRow
                  key={item.id}
                  post={item.post}
                  metaLabel="Saved"
                  metaValue={new Date(item.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'long' })}
                  mode="favorites"
                />
              ) : null,
            )}
          </div>
        )}
      </div>
    </Container>
  );
}
