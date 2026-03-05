import { AdminGuard } from '@/components/auth/admin-guard';
import { FlatPage } from '@/components/layout/flat';
import { PostForm } from '@/features/posts/components/post-form';
import { useAuth } from '@/providers/auth-provider';

export function AdminNewPage() {
  const { user } = useAuth();

  return (
    <AdminGuard allowEditor>
      {user ? (
        <FlatPage className="safe-pb py-6 sm:py-8">
          <PostForm mode="create" userId={user.id} />
        </FlatPage>
      ) : null}
    </AdminGuard>
  );
}
