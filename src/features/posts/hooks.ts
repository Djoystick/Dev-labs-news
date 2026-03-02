import { useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { getPosts } from '@/features/posts/api';
import { clearTopicsCache, listTopics } from '@/features/topics/api';
import { saveFeedState } from '@/lib/feed-state';
import type { Post, PostSort, Topic } from '@/types/db';

const pageSize = 10;
const allTopicsEntry: Topic = {
  id: 'all',
  slug: 'all',
  name: 'Все темы',
  created_at: '',
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Неожиданная ошибка.';
}

function useDebouncedValue<T>(value: T, delayMs: number) {
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

export function usePostFeed() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTopic = searchParams.get('topic') ?? 'all';
  const urlSearch = searchParams.get('search') ?? '';
  const sortParam = searchParams.get('sort');
  const sort: PostSort = sortParam === 'oldest' ? 'oldest' : 'newest';
  const [queryInput, setQueryInput] = useState(urlSearch);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [pageState, setPageState] = useState<{ filterKey: string; page: number }>({ filterKey: '', page: 1 });
  const [postsReloadToken, setPostsReloadToken] = useState(0);
  const [topicsReloadToken, setTopicsReloadToken] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isPostsLoading, setIsPostsLoading] = useState(true);
  const [isTopicsLoading, setIsTopicsLoading] = useState(true);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [topicsError, setTopicsError] = useState<string | null>(null);
  const currentParamsString = location.search.startsWith('?') ? location.search.slice(1) : location.search;
  const debouncedQuery = useDebouncedValue(queryInput, 300);

  const selectedTopicRecord = useMemo(() => topics.find((topic) => topic.slug === activeTopic) ?? null, [activeTopic, topics]);
  const normalizedQuery = debouncedQuery.trim();
  const selectedTopicId = activeTopic === 'all' ? undefined : selectedTopicRecord?.id;
  const filterKey = `${selectedTopicId ?? 'all'}:${sort}:${normalizedQuery}`;
  const page = pageState.filterKey === filterKey ? pageState.page : 1;

  useEffect(() => {
    if (location.pathname !== '/' || urlSearch === queryInput) {
      return;
    }

    setQueryInput(urlSearch);
  }, [location.pathname, queryInput, urlSearch]);

  useEffect(() => {
    if (location.pathname !== '/') {
      return;
    }

    const nextParams = new URLSearchParams();

    if (activeTopic !== 'all') {
      nextParams.set('topic', activeTopic);
    }

    if (normalizedQuery) {
      nextParams.set('search', normalizedQuery);
    }

    if (sort === 'oldest') {
      nextParams.set('sort', 'oldest');
    }

    const nextParamsString = nextParams.toString();

    if (nextParamsString === currentParamsString) {
      return;
    }

    setSearchParams(nextParams, { replace: true });
  }, [activeTopic, currentParamsString, location.pathname, normalizedQuery, setSearchParams, sort]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadTopics() {
      setIsTopicsLoading(true);
      setTopicsError(null);

      try {
        const loadedTopics = await listTopics(controller.signal, { force: topicsReloadToken > 0 });
        setTopics(loadedTopics);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        clearTopicsCache();
        setTopics([]);
        setTopicsError(getErrorMessage(error));
      } finally {
        if (!controller.signal.aborted) {
          setIsTopicsLoading(false);
        }
      }
    }

    void loadTopics();

    return () => {
      controller.abort();
    };
  }, [topicsReloadToken]);

  useEffect(() => {
    if (isTopicsLoading || activeTopic === 'all') {
      return;
    }

    const topicExists = topics.some((topic) => topic.slug === activeTopic);

    if (topicExists) {
      return;
    }

    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);
      nextParams.delete('topic');
      return nextParams;
    }, { replace: true });
  }, [activeTopic, isTopicsLoading, setSearchParams, topics]);

  useEffect(() => {
    setHasMore(true);
    setPostsError(null);
    setPageState((currentState) => {
      if (currentState.filterKey === filterKey && currentState.page === 1) {
        return currentState;
      }

      return { filterKey, page: 1 };
    });
  }, [filterKey]);

  useEffect(() => {
    if (activeTopic !== 'all' && (isTopicsLoading || !selectedTopicId)) {
      return;
    }

    const controller = new AbortController();

    async function loadPosts() {
      setIsPostsLoading(true);
      setPostsError(null);

      try {
        const response = await getPosts({
          page,
          pageSize,
          query: normalizedQuery || undefined,
          signal: controller.signal,
          sort,
          topicId: selectedTopicId,
        });

        if (controller.signal.aborted) {
          return;
        }

        setPosts((currentPosts) =>
          page === 1 ? response.items : [...currentPosts, ...response.items.filter((post) => !currentPosts.some((currentPost) => currentPost.id === post.id))],
        );
        setHasMore(response.hasMore);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setPostsError(getErrorMessage(error));
        setHasMore(false);
      } finally {
        if (!controller.signal.aborted) {
          setIsPostsLoading(false);
        }
      }
    }

    void loadPosts();

    return () => {
      controller.abort();
    };
  }, [activeTopic, isTopicsLoading, normalizedQuery, page, postsReloadToken, selectedTopicId, sort]);

  const topicOptions = useMemo(
    () =>
      [allTopicsEntry, ...topics].map((topic) => ({
        ...topic,
        count: topic.slug === 'all' ? posts.length : posts.filter((post) => post.topic_id === topic.id).length,
      })),
    [posts, topics],
  );

  const selectedTopic = useMemo(
    () => topicOptions.find((topic) => topic.slug === activeTopic) ?? topicOptions[0],
    [activeTopic, topicOptions],
  );

  return {
    activeTopic,
    hasMore,
    isLoading: isPostsLoading && posts.length === 0,
    isLoadingMore: isPostsLoading && posts.length > 0 && page > 1,
    isRefreshing: isPostsLoading && posts.length > 0 && page === 1,
    isTopicsLoading,
    loadMore: () => {
      if (isPostsLoading || !hasMore) {
        return;
      }

      setPageState((currentState) => ({
        filterKey,
        page: (currentState.filterKey === filterKey ? currentState.page : 1) + 1,
      }));
    },
    posts,
    postsError,
    query: queryInput,
    resultsCount: posts.length,
    retryPosts: () => {
      setHasMore(true);
      setPostsError(null);
      setPageState({ filterKey, page: 1 });
      setPostsReloadToken((currentToken) => currentToken + 1);
    },
    retryTopics: () => {
      setTopicsError(null);
      setTopicsReloadToken((currentToken) => currentToken + 1);
    },
    selectedTopic,
    setActiveTopic: (slug: string) => {
      const nextSlug = slug === 'all' ? null : slug;

      if (nextSlug === activeTopic || (!nextSlug && activeTopic === 'all')) {
        return;
      }

      setHasMore(true);
      setPostsError(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });

      setSearchParams((currentParams) => {
        const nextParams = new URLSearchParams(currentParams);

        if (nextSlug) {
          nextParams.set('topic', nextSlug);
        } else {
          nextParams.delete('topic');
        }

        saveFeedState({
          scrollY: 0,
          search: nextParams.toString() ? `?${nextParams.toString()}` : '',
        });

        return nextParams;
      }, { replace: true });
    },
    setQuery: (value: string) => {
      setQueryInput(value);
    },
    setSort: (value: PostSort) => {
      if (value === sort) {
        return;
      }

      setHasMore(true);
      setPostsError(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });

      setSearchParams((currentParams) => {
        const nextParams = new URLSearchParams(currentParams);

        if (value === 'oldest') {
          nextParams.set('sort', value);
        } else {
          nextParams.delete('sort');
        }

        saveFeedState({
          scrollY: 0,
          search: nextParams.toString() ? `?${nextParams.toString()}` : '',
        });

        return nextParams;
      }, { replace: true });
    },
    sort,
    topics: topicOptions,
    topicsError,
  };
}
