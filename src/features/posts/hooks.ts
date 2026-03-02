import { useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { listPosts } from '@/features/posts/api';
import { listTopics } from '@/features/topics/api';
import type { Post, Topic } from '@/types/db';

const pageSize = 12;
const allTopicsEntry: Topic = {
  id: 'all',
  slug: 'all',
  name: 'All Topics',
  created_at: '',
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unexpected error.';
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
  const [queryInput, setQueryInput] = useState(urlSearch);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [postsReloadToken, setPostsReloadToken] = useState(0);
  const [topicsReloadToken, setTopicsReloadToken] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isPostsLoading, setIsPostsLoading] = useState(true);
  const [isTopicsLoading, setIsTopicsLoading] = useState(true);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [topicsError, setTopicsError] = useState<string | null>(null);
  const [pendingTopicSlug, setPendingTopicSlug] = useState<string | null>(null);
  const currentParamsString = location.search.startsWith('?') ? location.search.slice(1) : location.search;
  const debouncedQuery = useDebouncedValue(queryInput, 300);

  const selectedTopicRecord = useMemo(() => topics.find((topic) => topic.slug === activeTopic) ?? null, [activeTopic, topics]);

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
    const normalizedQuery = debouncedQuery.trim();

    if (activeTopic !== 'all') {
      nextParams.set('topic', activeTopic);
    }

    if (normalizedQuery) {
      nextParams.set('search', normalizedQuery);
    }

    const nextParamsString = nextParams.toString();

    if (nextParamsString === currentParamsString) {
      return;
    }

    setSearchParams(nextParams, { replace: true });
  }, [activeTopic, currentParamsString, debouncedQuery, location.pathname, setSearchParams]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadTopics() {
      setIsTopicsLoading(true);
      setTopicsError(null);

      try {
        const loadedTopics = await listTopics(controller.signal);

        setTopics(loadedTopics);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

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
    if (activeTopic !== 'all' && (isTopicsLoading || !selectedTopicRecord)) {
      return;
    }

    const controller = new AbortController();

    async function loadPosts() {
      setIsPostsLoading(true);
      setPostsError(null);

      try {
        const loadedPosts = await listPosts({
          limit: pageSize,
          offset: (page - 1) * pageSize,
          signal: controller.signal,
          topicId: selectedTopicRecord?.id,
        });

        if (controller.signal.aborted) {
          return;
        }

        setPosts((currentPosts) => (page === 1 ? loadedPosts : [...currentPosts, ...loadedPosts.filter((post) => !currentPosts.some((currentPost) => currentPost.id === post.id))]));
        setHasMore(loadedPosts.length === pageSize);
        setPendingTopicSlug(null);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setPostsError(getErrorMessage(error));
        setHasMore(false);
        setPendingTopicSlug(null);
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
  }, [activeTopic, isTopicsLoading, page, postsReloadToken, selectedTopicRecord]);

  const filteredPosts = useMemo(() => {
    const normalizedQuery = debouncedQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return posts;
    }

    return posts.filter((post) => post.title.toLowerCase().includes(normalizedQuery));
  }, [debouncedQuery, posts]);

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
    isLoadingMore: isPostsLoading && posts.length > 0,
    isRefreshing: pendingTopicSlug !== null || (isPostsLoading && posts.length > 0 && page === 1),
    isTopicsLoading,
    loadMore: () => {
      if (isPostsLoading || !hasMore) {
        return;
      }

      setPage((currentPage) => currentPage + 1);
    },
    posts: filteredPosts,
    postsError,
    query: queryInput,
    resultsCount: filteredPosts.length,
    retryPosts: () => {
      setHasMore(true);
      setPostsError(null);
      setPendingTopicSlug(activeTopic);
      setPage(1);
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
      setPendingTopicSlug(nextSlug ?? 'all');
      setPage(1);

      setSearchParams((currentParams) => {
        const nextParams = new URLSearchParams(currentParams);

        if (nextSlug) {
          nextParams.set('topic', nextSlug);
        } else {
          nextParams.delete('topic');
        }

        return nextParams;
      }, { replace: true });
    },
    setQuery: (value: string) => {
      setQueryInput(value);
    },
    topics: topicOptions,
    topicsError,
  };
}
