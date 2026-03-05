import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { toggleReaction, fetchReactionSummaries, type ReactionSummary, type ReactionValue } from '@/features/reactions/api';
import { useAuth } from '@/providers/auth-provider';

const summariesCache = new Map<string, ReactionSummary>();
const loadedBatchKeys = new Set<string>();
const listeners = new Set<() => void>();
let failedUntil = 0;

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

function ensureSummary(postId: string): ReactionSummary {
  return (
    summariesCache.get(postId) ?? {
      post_id: postId,
      likes: 0,
      dislikes: 0,
      my_reaction: 0,
    }
  );
}

function applyOptimistic(summary: ReactionSummary, value: -1 | 1): ReactionSummary {
  const nextReaction: ReactionValue = summary.my_reaction === value ? 0 : value;
  let likes = summary.likes;
  let dislikes = summary.dislikes;

  if (summary.my_reaction === 1) {
    likes = Math.max(0, likes - 1);
  } else if (summary.my_reaction === -1) {
    dislikes = Math.max(0, dislikes - 1);
  }

  if (nextReaction === 1) {
    likes += 1;
  } else if (nextReaction === -1) {
    dislikes += 1;
  }

  return {
    ...summary,
    likes,
    dislikes,
    my_reaction: nextReaction,
  };
}

export function useReactions(postIds: string[]) {
  const { isAuthed } = useAuth();
  const [tick, setTick] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingPostIds, setPendingPostIds] = useState<Record<string, true>>({});

  const normalizedIds = useMemo(
    () =>
      [...new Set(postIds.filter(Boolean))]
        .sort(),
    [postIds],
  );
  const batchKey = normalizedIds.join(',');

  useEffect(() => {
    const rerender = () => setTick((value) => value + 1);
    listeners.add(rerender);

    if (normalizedIds.length === 0) {
      setIsLoading(false);
      setError(null);
      return () => {
        listeners.delete(rerender);
      };
    }

    const controller = new AbortController();
    const hasAllInCache = normalizedIds.every((postId) => summariesCache.has(postId));

    if ((loadedBatchKeys.has(batchKey) && hasAllInCache) || Date.now() < failedUntil) {
      setIsLoading(false);
      if (Date.now() >= failedUntil) {
        setError(null);
      }

      return () => {
        controller.abort();
        listeners.delete(rerender);
      };
    }

    setIsLoading(true);
    setError(null);

    void fetchReactionSummaries(normalizedIds, controller.signal)
      .then((map) => {
        if (controller.signal.aborted) {
          return;
        }

        normalizedIds.forEach((postId) => {
          summariesCache.set(postId, map.get(postId) ?? ensureSummary(postId));
        });

        loadedBatchKeys.add(batchKey);
        failedUntil = 0;
        setError(null);
        notifyListeners();
      })
      .catch((loadError) => {
        if (controller.signal.aborted) {
          return;
        }

        failedUntil = Date.now() + 60000;
        const message = loadError instanceof Error ? loadError.message : 'Не удалось загрузить реакции.';
        setError(message);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
      listeners.delete(rerender);
    };
  }, [batchKey, normalizedIds]);

  const summariesById = useMemo(() => {
    const map = new Map<string, ReactionSummary>();
    normalizedIds.forEach((postId) => {
      map.set(postId, ensureSummary(postId));
    });
    return map;
  }, [normalizedIds, tick]);

  const toggle = useCallback(
    async (postId: string, value: -1 | 1) => {
      if (!isAuthed) {
        toast.error('Войдите, чтобы поставить реакцию');
        return;
      }

      const previous = ensureSummary(postId);
      const optimistic = applyOptimistic(previous, value);
      summariesCache.set(postId, optimistic);
      setPendingPostIds((current) => ({ ...current, [postId]: true }));
      notifyListeners();

      try {
        const serverSummary = await toggleReaction(postId, value);
        summariesCache.set(postId, serverSummary);
        setError(null);
      } catch (toggleError) {
        summariesCache.set(postId, previous);
        const message = toggleError instanceof Error ? toggleError.message : 'Не удалось обновить реакцию.';
        setError(message);
        toast.error(message);
      } finally {
        setPendingPostIds((current) => {
          if (!current[postId]) {
            return current;
          }

          const next = { ...current };
          delete next[postId];
          return next;
        });
        notifyListeners();
      }
    },
    [isAuthed],
  );

  const isPending = useCallback((postId: string) => Boolean(pendingPostIds[postId]), [pendingPostIds]);

  return {
    summariesById,
    isLoading,
    error,
    toggle,
    isPending,
  };
}
