import type { MouseEvent, PointerEvent } from 'react';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { cn } from '@/lib/utils';
import type { ReactionSummary } from '@/features/reactions/api';

type PostReactionsProps = {
  postId: string;
  summary?: ReactionSummary | null;
  disabled?: boolean;
  onToggle: (postId: string, value: -1 | 1) => void;
};

const emptySummary: ReactionSummary = {
  post_id: '',
  likes: 0,
  dislikes: 0,
  my_reaction: 0,
};

export function PostReactions({ postId, summary, disabled = false, onToggle }: PostReactionsProps) {
  const { isAuthed } = useAuth();
  const current = summary ?? { ...emptySummary, post_id: postId };

  const stopTapPropagation = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleToggle = (event: MouseEvent<HTMLButtonElement>, value: -1 | 1) => {
    event.preventDefault();
    event.stopPropagation();

    if (!isAuthed) {
      toast.error('Войдите, чтобы поставить реакцию');
      return;
    }

    onToggle(postId, value);
  };

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        aria-label="Лайк"
        aria-pressed={current.my_reaction === 1}
        disabled={disabled}
        onPointerDown={stopTapPropagation}
        onClick={(event) => handleToggle(event, 1)}
        className={cn(
          'inline-flex items-center gap-1 text-xs transition',
          current.my_reaction === 1 ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
        <span>{current.likes}</span>
      </button>

      <button
        type="button"
        aria-label="Дизлайк"
        aria-pressed={current.my_reaction === -1}
        disabled={disabled}
        onPointerDown={stopTapPropagation}
        onClick={(event) => handleToggle(event, -1)}
        className={cn(
          'inline-flex items-center gap-1 text-xs transition',
          current.my_reaction === -1 ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <ThumbsDown className="h-3.5 w-3.5" />
        <span>{current.dislikes}</span>
      </button>
    </div>
  );
}
