import { AdminGuard } from '@/components/auth/admin-guard';
import { Container } from '@/components/layout/container';
import { PostForm } from '@/features/posts/components/post-form';
import { useAuth } from '@/providers/auth-provider';

export function AdminNewPage() {
  const { user } = useAuth();

  return (
    <AdminGuard allowEditor>
      {user ? (
        <Container className="safe-pb py-10">
          <PostForm mode="create" userId={user.id} />
        </Container>
      ) : null}
    </AdminGuard>
  );
}
