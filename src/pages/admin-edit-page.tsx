import { useEffect, useState } from 'react';
import { AdminGuard } from '@/components/auth/admin-guard';
import { Container } from '@/components/layout/container';
import { Skeleton } from '@/components/ui/skeleton';
import { StateCard } from '@/components/ui/state-card';
import { getPost } from '@/features/posts/api';
import { PostForm } from '@/features/posts/components/post-form';
import { useAuth } from '@/providers/auth-provider';
import type { Post } from '@/types/db';
import { useParams } from 'react-router-dom';

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
        setError('Post id is missing.');
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
      } catch (loadError) {
        if (!ignore) {
          setPost(null);
          setError(loadError instanceof Error ? loadError.message : 'Failed to load the post.');
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
    <AdminGuard>
      {user ? (
        <Container className="safe-pb py-10">
          {isLoading ? (
            <div className="mx-auto max-w-5xl space-y-4">
              <Skeleton className="h-14 w-40 rounded-full" />
              <Skeleton className="h-[680px] w-full rounded-[1.75rem]" />
            </div>
          ) : error || !post ? (
            <StateCard title="Post unavailable" description={error ?? 'The post could not be loaded for editing.'} />
          ) : (
            <PostForm mode="edit" post={post} userId={user.id} />
          )}
        </Container>
      ) : null}
    </AdminGuard>
  );
}
