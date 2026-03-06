import { getStoredProfileId } from '@/lib/auth-storage';
import { getSupabaseClient } from '@/lib/supabase';
import type { Post, PostSort } from '@/types/db';

const postsUpdatedEventName = 'dev-labs:posts-updated';

function logSupabaseMutationError(scope: string, error: { code?: string; details?: string | null; hint?: string | null; message: string; status?: number }) {
  if (!import.meta.env.DEV) {
    return;
  }

  console.error(`[posts-api:${scope}] supabase error`, {
    code: error.code,
    details: error.details ?? null,
    hint: error.hint ?? null,
    message: error.message,
    status: error.status ?? null,
  });
}

type GetPostsParams = {
  page: number;
  pageSize: number;
  publishedOnly?: boolean;
  query?: string;
  signal?: AbortSignal;
  sort?: PostSort;
  topicId?: string;
};

const postSelect =
  'id, topic_id, title, excerpt, content, cover_url, created_at, updated_at, author_id, is_published, scheduled_at, published_at, topic:topics(id, slug, name, created_at)';

export type GetPostsResult = {
  hasMore: boolean;
  items: Post[];
};

export type PostMutationInput = {
  author_id?: string | null;
  content: string;
  cover_url?: string | null;
  excerpt?: string | null;
  is_published?: boolean;
  scheduled_at?: string | null;
  title: string;
  topic_id: string;
};

export function notifyPostsUpdated() {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(postsUpdatedEventName));
}

export function subscribeToPostsUpdated(onUpdate: () => void) {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handler = () => onUpdate();
  window.addEventListener(postsUpdatedEventName, handler);

  return () => {
    window.removeEventListener(postsUpdatedEventName, handler);
  };
}

function escapeIlike(value: string) {
  return value.replace(/%/g, '\\%').replace(/_/g, '\\_').replace(/,/g, ' ');
}

export async function getPosts({
  page,
  pageSize,
  publishedOnly = false,
  query: searchQuery,
  signal,
  sort = 'newest',
  topicId,
}: GetPostsParams): Promise<GetPostsResult> {
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

  if (publishedOnly) {
    query = query.eq('is_published', true);
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

  // Ensure author_id is set for editor RLS (must equal auth.uid()).
  // Admin may still pass author_id explicitly; if not passed, we default to stored profile.id.
  const authorId = input.author_id ?? getStoredProfileId();
  const payload: PostMutationInput = {
    ...input,
    author_id: authorId,
  };

  if (!payload.author_id) {
    throw new Error('Not authenticated: missing profile id (author_id). Please sign in via Telegram.');
  }

  const { data, error } = await supabase.from('posts').insert(payload).select(postSelect).single();

  if (error) {
    logSupabaseMutationError('create', error);
    throw new Error(`Failed to create the post. ${error.message}`);
  }

  notifyPostsUpdated();
  return data as Post;
}

export async function updatePost(id: string, input: PostMutationInput) {
  const supabase = getSupabaseClient();

  // Prevent clients from attempting to change post ownership.
  // Ownership is enforced by RLS and should not be mutable from the client.
  const { author_id, ...payload } = input;
  void author_id;

  const { data, error } = await supabase.from('posts').update(payload).eq('id', id).select(postSelect).single();

  if (error) {
    logSupabaseMutationError('update', error);
    throw new Error(`Failed to update the post. ${error.message}`);
  }

  notifyPostsUpdated();
  return data as Post;
}

export async function deletePost(id: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('posts').delete().eq('id', id);

  if (error) {
    logSupabaseMutationError('delete', error);
    throw new Error(`Failed to delete the post. ${error.message}`);
  }

  notifyPostsUpdated();
}
