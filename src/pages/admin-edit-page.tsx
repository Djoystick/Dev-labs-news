import { ArrowLeft } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AdminGuard } from '@/components/auth/admin-guard';
import { FlatPage } from '@/components/layout/flat';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StateCard } from '@/components/ui/state-card';
import { getPost } from '@/features/posts/api';
import { PostForm } from '@/features/posts/components/post-form';
import { useAuth } from '@/providers/auth-provider';
import type { Post } from '@/types/db';

export function AdminEditPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { user } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const returnTo = useMemo(() => {
    const state = location.state as { returnTo?: unknown } | null;
    return typeof state?.returnTo === 'string' ? state.returnTo : undefined;
  }, [location.state]);

  const handleBack = () => {
    if (returnTo) {
      navigate(returnTo);
      return;
    }

    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate('/author');
  };

  useEffect(() => {
    let ignore = false;

    async function loadPostForEdit() {
      if (!id) {
        setError('Отсутствует идентификатор новости.');
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
          setError('Не удалось загрузить новость.');
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
          <div className="mb-4 flex items-center justify-between gap-3">
            <Button type="button" variant="ghost" className="rounded-full" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4" />
              {'Назад'}
            </Button>
          </div>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-14 w-40" />
              <Skeleton className="h-[680px] w-full" />
            </div>
          ) : error || !post ? (
            <StateCard title="Новость недоступна" description={error ?? 'Не удалось загрузить новость для редактирования.'} />
          ) : (
            <PostForm mode="edit" post={post} userId={user.id} />
          )}
        </FlatPage>
      ) : null}
    </AdminGuard>
  );
}
