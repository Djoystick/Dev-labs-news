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
        setError('РћС‚СЃСѓС‚СЃС‚РІСѓРµС‚ РёРґРµРЅС‚РёС„РёРєР°С‚РѕСЂ РЅРѕРІРѕСЃС‚Рё.');
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
          setError('РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РЅРѕРІРѕСЃС‚СЊ.');
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
            <StateCard title="РќРѕРІРѕСЃС‚СЊ РЅРµРґРѕСЃС‚СѓРїРЅР°" description={error ?? 'РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РЅРѕРІРѕСЃС‚СЊ РґР»СЏ СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёСЏ.'} />
          ) : (
            <PostForm mode="edit" post={post} userId={user.id} />
          )}
        </FlatPage>
      ) : null}
    </AdminGuard>
  );
}
