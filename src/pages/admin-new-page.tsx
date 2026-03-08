import { AdminGuard } from '@/components/auth/admin-guard';
import { FlatPage } from '@/components/layout/flat';
import { AppLink } from '@/components/ui/app-link';
import { Button } from '@/components/ui/button';
import { PostForm } from '@/features/posts/components/post-form';
import { useAuth } from '@/providers/auth-provider';

export function AdminNewPage() {
  const { user } = useAuth();

  return (
    <AdminGuard allowEditor>
      {user ? (
        <FlatPage className="safe-pb py-6 sm:py-8">
          <div className="mb-4 flex justify-end">
            <Button asChild type="button" variant="outline">
              <AppLink to="/admin/import" state={{ returnTo: '/admin/new' }}>{'Импортировать в черновик'}</AppLink>
            </Button>
          </div>
          <PostForm mode="create" userId={user.id} />
        </FlatPage>
      ) : null}
    </AdminGuard>
  );
}
