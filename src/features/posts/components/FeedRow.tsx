import type { KeyboardEvent } from 'react';
import type { Post } from '@/types/db';
import { normalizeHandle } from '@/lib/author-label';
import { useAuthorHandles } from '@/features/profiles/use-author-handles';
import { PostReactions } from '@/features/reactions/components/PostReactions';
import type { ReactionSummary } from '@/features/reactions/api';

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
    return 'С‚РѕР»СЊРєРѕ С‡С‚Рѕ';
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} РјРёРЅ РЅР°Р·Р°Рґ`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours} С‡ РЅР°Р·Р°Рґ`;
  }

  return new Date(createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export function FeedRow({
  post,
  onOpen,
  reactionSummary,
  reactionsDisabled = false,
  onToggleReaction,
}: {
  post: Post;
  onOpen: (post: Post) => void;
  reactionSummary?: ReactionSummary | null;
  reactionsDisabled?: boolean;
  onToggleReaction?: (postId: string, value: -1 | 1) => void;
}) {
  const readingTime = post.content?.trim() ? getReadingTime(post.content) : null;
  const source = post.topic?.name ?? 'РСЃС‚РѕС‡РЅРёРє';
  const { getName } = useAuthorHandles(post.author_id ? [post.author_id] : []);
  const authorLabel = normalizeHandle(getName(post.author_id)) ?? 'РђРІС‚РѕСЂ';

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen(post);
    }
  };

  return (
    <div className="w-full py-4">
      <button type="button" onKeyDown={handleKeyDown} onClick={() => onOpen(post)} className="w-full cursor-pointer text-left transition active:bg-secondary/10">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">{source}</p>
            <h3 className="mt-1 line-clamp-3 text-lg font-extrabold leading-tight sm:text-xl">{post.title}</h3>
            <p className="mt-2 text-xs text-muted-foreground">
              {getRelativeTime(post.created_at)}
              {readingTime ? ` вЂў ${readingTime} РјРёРЅ С‡С‚РµРЅРёСЏ` : ''}
              {` вЂў ${authorLabel}`}
            </p>
          </div>
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-secondary sm:h-24 sm:w-24">
            {post.cover_url ? <img src={post.cover_url} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
          </div>
        </div>
      </button>
      {onToggleReaction ? (
        <div className="mt-2">
          <PostReactions postId={post.id} summary={reactionSummary} disabled={reactionsDisabled} onToggle={onToggleReaction} />
        </div>
      ) : null}
    </div>
  );
}
