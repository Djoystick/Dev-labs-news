import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchAuthorHandles } from '@/features/profiles/authors';

const authorCache = new Map<string, string>();
const lookedUpAuthorIds = new Set<string>();
const pendingAuthorIds = new Set<string>();
const listeners = new Set<() => void>();
let failedUntil = 0;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let inFlight = false;
let activeController: AbortController | null = null;

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

function scheduleFetch() {
  if (inFlight || flushTimer !== null || Date.now() < failedUntil || pendingAuthorIds.size === 0) {
    return;
  }

  flushTimer = setTimeout(() => {
    flushTimer = null;

    if (inFlight || Date.now() < failedUntil || pendingAuthorIds.size === 0) {
      return;
    }

    const idsToFetch = [...pendingAuthorIds];
    pendingAuthorIds.clear();

    inFlight = true;
    activeController = new AbortController();

    void fetchAuthorHandles(idsToFetch, activeController.signal)
      .then((authorMap) => {
        idsToFetch.forEach((id) => {
          const handle = authorMap.get(id);
          if (handle) {
            authorCache.set(id, handle);
          }
          lookedUpAuthorIds.add(id);
        });
        failedUntil = 0;
      })
      .catch(() => {
        if (!activeController?.signal.aborted) {
          failedUntil = Date.now() + 60000;
        }
      })
      .finally(() => {
        inFlight = false;
        activeController = null;
        notifyListeners();

        if (pendingAuthorIds.size > 0 && Date.now() >= failedUntil) {
          scheduleFetch();
        }
      });
  }, 0);
}

export function useAuthorHandles(authorIds: string[]) {
  const [, setTick] = useState(0);

  const idsKey = useMemo(
    () =>
      [...new Set(authorIds.filter((id): id is string => Boolean(id)))]
        .sort()
        .join(','),
    [authorIds],
  );

  const uniqueIds = useMemo(() => (idsKey ? idsKey.split(',') : []), [idsKey]);

  useEffect(() => {
    const rerender = () => setTick((value) => value + 1);
    listeners.add(rerender);

    const missingIds = uniqueIds.filter((id) => !authorCache.has(id) && !lookedUpAuthorIds.has(id));

    if (missingIds.length > 0 && Date.now() >= failedUntil) {
      missingIds.forEach((id) => pendingAuthorIds.add(id));
      scheduleFetch();
    }

    return () => {
      listeners.delete(rerender);

      if (listeners.size === 0 && activeController) {
        activeController.abort();
        activeController = null;
      }

      if (listeners.size === 0 && flushTimer !== null) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
    };
  }, [idsKey, uniqueIds]);

  const getName = useCallback((authorId?: string | null) => {
    if (!authorId) {
      return null;
    }

    return authorCache.get(authorId) ?? null;
  }, []);

  const isLoading = useMemo(() => {
    if (Date.now() < failedUntil) {
      return false;
    }

    return uniqueIds.some((id) => !authorCache.has(id) && (pendingAuthorIds.has(id) || inFlight));
  }, [uniqueIds]);

  return { getName, isLoading };
}
