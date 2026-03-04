import { useEffect, useState } from 'react';
import { fetchPostsByTopic } from '@/features/discover/api';
import type { Post } from '@/types/db';

type TopicPostsCacheEntry = {
  items: Post[];
  limit: number;
};

const topicPostsCache = new Map<string, TopicPostsCacheEntry>();

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unexpected discover feed error.';
}

export function useTopicPosts(topicId: string, limit: number, enabled: boolean) {
  const cacheKey = topicId;
  const cachedEntry = topicPostsCache.get(cacheKey);
  const [data, setData] = useState<Post[]>(cachedEntry?.items.slice(0, limit) ?? []);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(enabled && (!cachedEntry || cachedEntry.limit < limit));
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!enabled || !topicId) {
      return;
    }

    const currentCache = topicPostsCache.get(cacheKey);

    if (currentCache && currentCache.limit >= limit) {
      setData(currentCache.items.slice(0, limit));
      setError(null);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    void fetchPostsByTopic(topicId, limit, controller.signal)
      .then((items) => {
        if (controller.signal.aborted) {
          return;
        }

        topicPostsCache.set(cacheKey, {
          items,
          limit,
        });
        setData(items);
      })
      .catch((nextError) => {
        if (controller.signal.aborted) {
          return;
        }

        setData(currentCache?.items.slice(0, limit) ?? []);
        setError(getErrorMessage(nextError));
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [cacheKey, enabled, limit, reloadToken, topicId]);

  return {
    data,
    error,
    isLoading,
    retry: () => {
      topicPostsCache.delete(cacheKey);
      setReloadToken((current) => current + 1);
    },
  };
}
