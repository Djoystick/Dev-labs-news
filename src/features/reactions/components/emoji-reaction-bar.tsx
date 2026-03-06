import { cn } from '@/lib/utils';
import { usePostEmojiReaction, type EmojiReaction } from '@/features/reactions/emoji-reactions';

type EmojiReactionBarProps = {
  className?: string;
  postId: string;
};

export function EmojiReactionBar({ className, postId }: EmojiReactionBarProps) {
  const { currentReaction, emojiReactions, togglePostReaction } = usePostEmojiReaction(postId);

  const onToggle = (reaction: EmojiReaction) => {
    togglePostReaction(postId, reaction);
  };

  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-xs text-muted-foreground">Как вам материал?</p>
      <div className="flex flex-wrap items-center gap-2">
        {emojiReactions.map((reaction) => {
          const isActive = currentReaction === reaction;

          return (
            <button
              key={reaction}
              type="button"
              aria-label={`Реакция ${reaction}`}
              aria-pressed={isActive}
              onClick={() => onToggle(reaction)}
              className={cn(
                'inline-flex h-9 min-w-9 items-center justify-center rounded-full border px-2 text-lg transition-colors',
                isActive
                  ? 'border-primary/60 bg-primary/15 text-foreground'
                  : 'border-border/70 bg-background/40 text-muted-foreground hover:text-foreground',
              )}
            >
              <span role="img" aria-hidden="true">
                {reaction}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
