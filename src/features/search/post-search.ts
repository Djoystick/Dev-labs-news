import { useEffect, useMemo, useState } from 'react';
import type { Post } from '@/types/db';

export const feedSearchStorageKey = 'devlabs.search.feed.v1';
export const forYouSearchStorageKey = 'devlabs.search.for-you.v1';

function normalize(value: string) {
  return value.trim().toLocaleLowerCase();
}

function getText(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function buildSearchText(post: Post) {
  const withOptionalFields = post as Post & { description?: string | null; summary?: string | null };

  return normalize([post.title, post.excerpt, withOptionalFields.summary, withOptionalFields.description].filter(Boolean).join(' '));
}

export function useDebouncedValue<T>(value: T, delayMs = 250) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [delayMs, value]);

  return debouncedValue;
}

function readStoredQuery(storageKey: string) {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    return window.sessionStorage.getItem(storageKey) ?? '';
  } catch {
    return '';
  }
}

export function usePersistentSearchQuery(storageKey: string) {
  const [query, setQuery] = useState(() => readStoredQuery(storageKey));

  useEffect(() => {
    try {
      if (query.trim()) {
        window.sessionStorage.setItem(storageKey, query);
      } else {
        window.sessionStorage.removeItem(storageKey);
      }
    } catch {
      // no-op: sessionStorage can fail in restricted mode
    }
  }, [query, storageKey]);

  return [query, setQuery] as const;
}

export function filterPostsByQuery(posts: Post[], rawQuery: string) {
  const query = normalize(rawQuery);
  if (!query) {
    return posts;
  }

  return posts.filter((post) => {
    const title = normalize(getText(post.title));
    if (title.includes(query)) {
      return true;
    }

    return buildSearchText(post).includes(query);
  });
}

export function usePostSearch(posts: Post[], rawQuery: string) {
  const debouncedQuery = useDebouncedValue(rawQuery, 250);
  const filteredPosts = useMemo(() => filterPostsByQuery(posts, debouncedQuery), [debouncedQuery, posts]);
  const normalizedDebouncedQuery = normalize(debouncedQuery);

  return {
    debouncedQuery: normalizedDebouncedQuery,
    filteredPosts,
    hasQuery: normalizedDebouncedQuery.length > 0,
  };
}
