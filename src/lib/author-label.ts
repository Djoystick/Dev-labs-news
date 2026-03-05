import type { Post } from '@/types/db';

type AuthorLike = {
  full_name?: string | null;
  handle?: string | null;
  username?: string | null;
};

export function normalizeHandle(value?: string | null) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
}

export function getAuthorLabel(post: Pick<Post, 'author'>) {
  const author = post.author as AuthorLike | null | undefined;

  return normalizeHandle(author?.handle) ?? normalizeHandle(author?.full_name) ?? normalizeHandle(author?.username) ?? 'Автор';
}
