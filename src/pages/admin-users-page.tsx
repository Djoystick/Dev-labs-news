import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AdminRoleManager } from '@/components/AdminRoleManager';
import { AdminGuard } from '@/components/auth/admin-guard';
import { Container } from '@/components/layout/container';
import { Button } from '@/components/ui/button';

export function AdminUsersPage() {
  const navigate = useNavigate();

  return (
    <AdminGuard>
      <Container className="safe-pb py-6 sm:py-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="flex items-center gap-3">
            <Button type="button" variant="ghost" size="icon" className="rounded-full" onClick={() => navigate('/profile')}>
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Назад</span>
            </Button>
            <h1 className="text-3xl font-extrabold">Роли пользователей</h1>
          </div>

          <AdminRoleManager />
        </div>
      </Container>
    </AdminGuard>
  );
}
