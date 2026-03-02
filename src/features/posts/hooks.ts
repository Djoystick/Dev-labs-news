import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react';
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

export function usePostFeed() {
  const [query, setQueryState] = useState('');
  const [activeTopic, setActiveTopicState] = useState('all');
  const [topics, setTopics] = useState<Topic[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isPostsLoading, setIsPostsLoading] = useState(true);
  const [isTopicsLoading, setIsTopicsLoading] = useState(true);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [topicsError, setTopicsError] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);

  const selectedTopicRecord = useMemo(() => topics.find((topic) => topic.slug === activeTopic) ?? null, [activeTopic, topics]);

  useEffect(() => {
    let ignore = false;

    async function loadTopics() {
      setIsTopicsLoading(true);
      setTopicsError(null);

      try {
        const loadedTopics = await listTopics();

        if (ignore) {
          return;
        }

        setTopics(loadedTopics);
      } catch (error) {
        if (!ignore) {
          setTopics([]);
          setTopicsError(getErrorMessage(error));
        }
      } finally {
        if (!ignore) {
          setIsTopicsLoading(false);
        }
      }
    }

    void loadTopics();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadPosts() {
      setIsPostsLoading(true);
      setPostsError(null);

      try {
        const loadedPosts = await listPosts({
          limit: pageSize,
          offset: (page - 1) * pageSize,
          topicId: selectedTopicRecord?.id,
        });

        if (ignore) {
          return;
        }

        setPosts((currentPosts) => (page === 1 ? loadedPosts : [...currentPosts, ...loadedPosts.filter((post) => !currentPosts.some((currentPost) => currentPost.id === post.id))]));
        setHasMore(loadedPosts.length === pageSize);
      } catch (error) {
        if (!ignore) {
          if (page === 1) {
            setPosts([]);
          }

          setPostsError(getErrorMessage(error));
          setHasMore(false);
        }
      } finally {
        if (!ignore) {
          setIsPostsLoading(false);
        }
      }
    }

    void loadPosts();

    return () => {
      ignore = true;
    };
  }, [page, reloadToken, selectedTopicRecord?.id]);

  const filteredPosts = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return posts;
    }

    return posts.filter((post) => post.title.toLowerCase().includes(normalizedQuery));
  }, [deferredQuery, posts]);

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
    isTopicsLoading,
    loadMore: () => {
      if (isPostsLoading || !hasMore) {
        return;
      }

      setPage((currentPage) => currentPage + 1);
    },
    posts: filteredPosts,
    postsError,
    query,
    resultsCount: filteredPosts.length,
    retryPosts: () => {
      setPosts([]);
      setHasMore(true);
      setPostsError(null);
      setPage(1);
      setReloadToken((currentToken) => currentToken + 1);
    },
    retryTopics: () => {
      setTopics([]);
      setTopicsError(null);
      setIsTopicsLoading(true);

      startTransition(() => {
        setActiveTopicState('all');
      });

      void listTopics()
        .then((loadedTopics) => {
          setTopics(loadedTopics);
          setTopicsError(null);
        })
        .catch((error) => {
          setTopicsError(getErrorMessage(error));
        })
        .finally(() => {
          setIsTopicsLoading(false);
        });
    },
    selectedTopic,
    setActiveTopic: (slug: string) => {
      startTransition(() => {
        setActiveTopicState(slug);
        setPosts([]);
        setHasMore(true);
        setPage(1);
        setPostsError(null);
        setReloadToken((currentToken) => currentToken + 1);
      });
    },
    setQuery: (value: string) => {
      startTransition(() => {
        setQueryState(value);
      });
    },
    topics: topicOptions,
    topicsError,
  };
}
