import { useMemo, useState } from 'react';
import { postSeeds } from '@/features/posts/data';
import { topicSeeds } from '@/features/topics/data';

const pageSize = 12;

export function usePostFeed() {
  const [query, setQuery] = useState('');
  const [activeTopic, setActiveTopic] = useState('all');
  const [page, setPage] = useState(1);

  const posts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return postSeeds
      .map((post) => ({
        ...post,
        topic: topicSeeds.find((topic) => topic.id === post.topic_id),
      }))
      .filter((post) => {
        const matchesTopic = activeTopic === 'all' || post.topic?.slug === activeTopic;
        const matchesQuery = normalizedQuery.length === 0 || post.title.toLowerCase().includes(normalizedQuery);

        return matchesTopic && matchesQuery;
      });
  }, [activeTopic, query]);

  return {
    activeTopic,
    hasMore: posts.length > page * pageSize,
    posts: posts.slice(0, page * pageSize),
    query,
    setActiveTopic,
    setPage,
    setQuery,
    topics: topicSeeds,
  };
}
