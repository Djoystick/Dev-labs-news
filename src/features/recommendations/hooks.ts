import { useEffect, useState } from 'react';
import { subscribeToPostsUpdated } from '@/features/posts/api';
import { getRecommendedPosts } from '@/features/recommendations/api';
import type { Post } from '@/types/db';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unexpected recommendations error.';
}

export function useRecommendedPosts(limit = 20) {
  const [data, setData] = useState<Post[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadRecommendations() {
      setIsLoading(true);
      setError(null);

      try {
        const items = await getRecommendedPosts(limit, controller.signal);

        if (controller.signal.aborted) {
          return;
        }

        setData(items);
      } catch (nextError) {
        if (controller.signal.aborted) {
          return;
        }

        setData([]);
        setError(getErrorMessage(nextError));
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadRecommendations();

    return () => {
      controller.abort();
    };
  }, [limit, reloadToken]);

  useEffect(() => subscribeToPostsUpdated(() => setReloadToken((currentToken) => currentToken + 1)), []);

  return {
    data,
    error,
    isLoading,
    retry: () => {
      setReloadToken((currentToken) => currentToken + 1);
    },
  };
}
