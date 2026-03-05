import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AdminGuard } from '@/components/auth/admin-guard';
import { FlatPage } from '@/components/layout/flat';
import { Skeleton } from '@/components/ui/skeleton';
import { StateCard } from '@/components/ui/state-card';
import { getPost } from '@/features/posts/api';
import { PostForm } from '@/features/posts/components/post-form';
import { useAuth } from '@/providers/auth-provider';
import type { Post } from '@/types/db';

export function AdminEditPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadPostForEdit() {
      if (!id) {
        setError('\u041E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u0438\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0440 \u043D\u043E\u0432\u043E\u0441\u0442\u0438.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const loadedPost = await getPost(id);

        if (!ignore) {
          setPost(loadedPost);
        }
      } catch {
        if (!ignore) {
          setPost(null);
          setError('\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u043D\u043E\u0432\u043E\u0441\u0442\u044C.');
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadPostForEdit();

    return () => {
      ignore = true;
    };
  }, [id]);

  return (
    <AdminGuard allowEditor>
      {user ? (
        <FlatPage className="safe-pb py-6 sm:py-8">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-14 w-40" />
              <Skeleton className="h-[680px] w-full" />
            </div>
          ) : error || !post ? (
            <StateCard title="\u041D\u043E\u0432\u043E\u0441\u0442\u044C \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430" description={error ?? '\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u043D\u043E\u0432\u043E\u0441\u0442\u044C \u0434\u043B\u044F \u0440\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F.'} />
          ) : (
            <PostForm mode="edit" post={post} userId={user.id} />
          )}
        </FlatPage>
      ) : null}
    </AdminGuard>
  );
}
