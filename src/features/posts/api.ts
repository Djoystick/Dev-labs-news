import { getSupabaseClient } from '@/lib/supabase';
import type { Post } from '@/types/db';

type ListPostsParams = {
  topicId?: string;
  search?: string;
  limit: number;
  offset: number;
  signal?: AbortSignal;
};

const postSelect = 'id, topic_id, title, excerpt, content, cover_url, created_at, updated_at, author_id, topic:topics(id, slug, name, created_at)';

export type PostMutationInput = {
  author_id?: string | null;
  content: string;
  cover_url?: string | null;
  excerpt?: string | null;
  title: string;
  topic_id: string;
};

export async function listPosts({ topicId, search, limit, offset, signal }: ListPostsParams) {
  const supabase = getSupabaseClient();
  let query = supabase.from('posts').select(postSelect).order('created_at', { ascending: false }).range(offset, offset + limit - 1);

  if (signal) {
    query = query.abortSignal(signal);
  }

  if (topicId) {
    query = query.eq('topic_id', topicId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load posts. ${error.message}`);
  }

  const posts = (data ?? []) as Post[];

  if (!search?.trim()) {
    return posts;
  }

  const normalizedSearch = search.trim().toLowerCase();

  return posts.filter((post) => post.title.toLowerCase().includes(normalizedSearch));
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
