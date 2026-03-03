import { AdminGuard } from '@/components/auth/admin-guard';
import { AdminRoleManager } from '@/components/AdminRoleManager';
import { AdminRulesEditor } from '@/components/AdminRulesEditor';
import { Container } from '@/components/layout/container';
import { PostForm } from '@/features/posts/components/post-form';
import { useAuth } from '@/providers/auth-provider';

export function AdminNewPage() {
  const { user } = useAuth();

  return (
    <AdminGuard>
      {user ? (
        <Container className="safe-pb space-y-6 py-10">
          <AdminRoleManager />
          <AdminRulesEditor />
          <PostForm mode="create" userId={user.id} />
        </Container>
      ) : null}
    </AdminGuard>
  );
}
