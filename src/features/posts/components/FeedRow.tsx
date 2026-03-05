import type { Post } from '@/types/db';
import { normalizeHandle } from '@/lib/author-label';
import { useAuthorHandles } from '@/features/profiles/use-author-handles';

function getReadingTime(content: string) {
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(wordCount / 200));
}

function getRelativeTime(createdAt: string) {
  const now = Date.now();
  const timestamp = new Date(createdAt).getTime();
  const diffMs = Math.max(0, now - timestamp);
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) {
    return 'только что';
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} мин назад`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours} ч назад`;
  }

  return new Date(createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export function FeedRow({
  post,
  onOpen,
}: {
  post: Post;
  onOpen: (post: Post) => void;
}) {
  const readingTime = post.content?.trim() ? getReadingTime(post.content) : null;
  const source = post.topic?.name ?? 'Источник';
  const { getName } = useAuthorHandles(post.author_id ? [post.author_id] : []);
  const authorLabel = normalizeHandle(getName(post.author_id)) ?? 'Автор';

  return (
    <button
      type="button"
      onClick={() => onOpen(post)}
      className="w-full px-0 py-4 text-left transition active:bg-secondary/10"
    >
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">{source}</p>
          <h3 className="mt-1 line-clamp-3 text-lg font-extrabold leading-tight sm:text-xl">{post.title}</h3>
          <p className="mt-2 text-xs text-muted-foreground">
            {getRelativeTime(post.created_at)}
            {readingTime ? ` • ${readingTime} мин чтения` : ''}
            {` • ${authorLabel}`}
          </p>
        </div>
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-secondary sm:h-24 sm:w-24">
          {post.cover_url ? <img src={post.cover_url} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
        </div>
      </div>
      <div className="mt-4 h-px bg-border/60" />
    </button>
  );
}
