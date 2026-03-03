import { AdminGuard } from '@/components/auth/admin-guard';
import { RoleManager } from '@/components/RoleManager';
import { Container } from '@/components/layout/container';
import { PostForm } from '@/features/posts/components/post-form';
import { useAuth } from '@/providers/auth-provider';

export function AdminNewPage() {
  const { user } = useAuth();

  return (
    <AdminGuard>
      {user ? (
        <Container className="safe-pb py-10">
          <RoleManager />
          <PostForm mode="create" userId={user.id} />
        </Container>
      ) : null}
    </AdminGuard>
  );
}
