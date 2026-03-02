import { Bookmark, BookmarkCheck, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button, type ButtonProps } from '@/components/ui/button';
import { useLibrary } from '@/providers/library-provider';

type BookmarkButtonProps = {
  postId: string;
  showLabel?: boolean;
} & Omit<ButtonProps, 'children' | 'onClick'>;

export function BookmarkButton({ postId, showLabel = false, size = 'icon', variant = 'outline', ...props }: BookmarkButtonProps) {
  const [isBusy, setIsBusy] = useState(false);
  const { isFavorite, isFavoritePending, toggleFavorite } = useLibrary();
  const favorite = isFavorite(postId);
  const pending = isFavoritePending(postId) || isBusy;

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      aria-label={favorite ? 'Убрать из избранного' : 'Добавить в избранное'}
      onClick={async (event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsBusy(true);

        try {
          const nextState = await toggleFavorite(postId);
          toast.success(nextState ? 'Сохранено в избранное.' : 'Удалено из избранного.');
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'Не удалось обновить избранное.');
        } finally {
          setIsBusy(false);
        }
      }}
      disabled={pending}
      {...props}
    >
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : favorite ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
      {showLabel ? <span>{favorite ? 'Сохранено' : 'В избранное'}</span> : null}
    </Button>
  );
}
