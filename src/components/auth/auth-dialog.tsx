import { LoaderCircle, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { getTelegramEnvironment } from '@/lib/telegram';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type AuthDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function AuthDialog({ onOpenChange, open }: AuthDialogProps) {
  const { loading, signInWithTelegram } = useAuth();
  const telegramAvailable = getTelegramEnvironment() === 'telegram';

  const handleTelegramSignIn = async () => {
    try {
      await signInWithTelegram();
      toast.success('Вход через Telegram выполнен.');
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось войти через Telegram.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Вход</DialogTitle>
          <DialogDescription>Авторизация и роли администратора теперь приходят только через Telegram token.</DialogDescription>
        </DialogHeader>

        {!telegramAvailable ? (
          <Alert>
            <AlertTitle>Telegram недоступен</AlertTitle>
            <AlertDescription>Открой мини-приложение внутри Telegram. Только там доступен `initData` для входа и выдачи RLS token.</AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <AlertTitle>Telegram авторизация</AlertTitle>
            <AlertDescription>Приложение отправит `initData` в Edge Function, получит JWT с `app_role` и сохранит его локально.</AlertDescription>
          </Alert>
        )}

        <Button className="w-full" type="button" variant="secondary" onClick={handleTelegramSignIn} disabled={loading || !telegramAvailable}>
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Войти через Telegram
        </Button>
      </DialogContent>
    </Dialog>
  );
}
