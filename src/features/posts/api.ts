import { getSupabaseClient } from '@/lib/supabase';
import type { Post, PostSort } from '@/types/db';

type GetPostsParams = {
  page: number;
  pageSize: number;
  query?: string;
  signal?: AbortSignal;
  sort?: PostSort;
  topicId?: string;
};

const postSelect = 'id, topic_id, title, excerpt, content, cover_url, created_at, updated_at, author_id, topic:topics(id, slug, name, created_at)';

export type GetPostsResult = {
  hasMore: boolean;
  items: Post[];
};

export type PostMutationInput = {
  author_id?: string | null;
  content: string;
  cover_url?: string | null;
  excerpt?: string | null;
  title: string;
  topic_id: string;
};

function escapeIlike(value: string) {
  return value.replace(/%/g, '\\%').replace(/_/g, '\\_').replace(/,/g, ' ');
}

export async function getPosts({ page, pageSize, query: searchQuery, signal, sort = 'newest', topicId }: GetPostsParams): Promise<GetPostsResult> {
  const supabase = getSupabaseClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let query = supabase
    .from('posts')
    .select(postSelect)
    .order('created_at', { ascending: sort === 'oldest' })
    .range(from, to);

  if (signal) {
    query = query.abortSignal(signal);
  }

  if (topicId) {
    query = query.eq('topic_id', topicId);
  }

  const normalizedQuery = searchQuery?.trim();

  if (normalizedQuery) {
    const pattern = `%${escapeIlike(normalizedQuery)}%`;
    query = query.or(`title.ilike.${pattern},excerpt.ilike.${pattern},content.ilike.${pattern}`);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load posts. ${error.message}`);
  }

  const items = (data ?? []) as Post[];

  return {
    hasMore: items.length === pageSize,
    items,
  };
}

export async function getPost(id: string, signal?: AbortSignal) {
  const supabase = getSupabaseClient();
  let query = supabase.from('posts').select(postSelect).eq('id', id);

  if (signal) {
    query = query.abortSignal(signal);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(`Failed to load the post. ${error.message}`);
  }

  if (!data) {
    throw new Error('Post not found.');
  }

  return data as Post;
}

export async function createPost(input: PostMutationInput) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('posts').insert(input).select(postSelect).single();

  if (error) {
    throw new Error(`Failed to create the post. ${error.message}`);
  }

  return data as Post;
}

export async function updatePost(id: string, input: PostMutationInput) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('posts').update(input).eq('id', id).select(postSelect).single();

  if (error) {
    throw new Error(`Failed to update the post. ${error.message}`);
  }

  return data as Post;
}

export async function deletePost(id: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('posts').delete().eq('id', id);

  if (error) {
    throw new Error(`Failed to delete the post. ${error.message}`);
  }
}
