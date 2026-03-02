import type { Topic } from '@/types/topic';

export type Post = {
  id: string;
  topic_id: string;
  title: string;
  excerpt: string;
  content: string;
  cover_url: string | null;
  created_at: string;
  updated_at: string;
  author_id: string | null;
  topic?: Topic;
};
