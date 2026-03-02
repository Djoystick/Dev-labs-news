import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoaderCircle, LogIn, Send, UserPlus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { getTelegramEnvironment } from '@/lib/telegram';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { signInSchema, signUpSchema, type SignInValues, type SignUpValues } from '@/features/auth/validation';

type AuthDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function AuthDialog({ onOpenChange, open }: AuthDialogProps) {
  const [activeTab, setActiveTab] = useState<'sign-in' | 'sign-up'>('sign-in');
  const { loading, resetPassword, signIn, signInWithTelegram, signUp } = useAuth();
  const telegramAvailable = getTelegramEnvironment() === 'telegram';

  const signInForm = useForm<SignInValues>({
    defaultValues: {
      email: '',
      password: '',
    },
    resolver: zodResolver(signInSchema),
  });

  const signUpForm = useForm<SignUpValues>({
    defaultValues: {
      confirmPassword: '',
      email: '',
      password: '',
    },
    resolver: zodResolver(signUpSchema),
  });

  const handleForgotPassword = async () => {
    const email = signInForm.getValues('email');

    if (!email) {
      signInForm.setError('email', {
        message: 'Сначала укажи email.',
        type: 'manual',
      });
      return;
    }

    try {
      await resetPassword(email);
      toast.success('Письмо для сброса отправлено.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось отправить письмо.');
    }
  };

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
          <DialogDescription>Используй email или Telegram.</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'sign-in' | 'sign-up')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="sign-in">Вход</TabsTrigger>
            <TabsTrigger value="sign-up">Регистрация</TabsTrigger>
          </TabsList>

          <TabsContent value="sign-in">
            <form
              className="space-y-4"
              onSubmit={signInForm.handleSubmit(async (values) => {
                try {
                  await signIn(values.email, values.password);
                  toast.success('Вход выполнен.');
                  onOpenChange(false);
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : 'Не удалось войти.');
                }
              })}
            >
              <div className="space-y-2">
                <Label htmlFor="sign-in-email">Email</Label>
                <Input id="sign-in-email" type="email" placeholder="editor@devlabs.news" disabled={loading} {...signInForm.register('email')} />
                {signInForm.formState.errors.email ? <p className="text-sm text-destructive">{signInForm.formState.errors.email.message}</p> : null}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="sign-in-password">Пароль</Label>
                  <button type="button" className="text-xs font-semibold text-primary" onClick={handleForgotPassword}>
                    Забыли пароль?
                  </button>
                </div>
                <Input id="sign-in-password" type="password" placeholder="Минимум 8 символов" disabled={loading} {...signInForm.register('password')} />
                {signInForm.formState.errors.password ? <p className="text-sm text-destructive">{signInForm.formState.errors.password.message}</p> : null}
              </div>
              <Button className="w-full" type="submit" disabled={loading}>
                {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                Войти
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="sign-up">
            <form
              className="space-y-4"
              onSubmit={signUpForm.handleSubmit(async (values) => {
                try {
                  const result = await signUp(values.email, values.password);
                  toast.success(result.requiresEmailConfirmation ? 'Проверь почту и подтверди регистрацию.' : 'Аккаунт создан.');
                  if (!result.requiresEmailConfirmation) {
                    onOpenChange(false);
                  }
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : 'Не удалось создать аккаунт.');
                }
              })}
            >
              <div className="space-y-2">
                <Label htmlFor="sign-up-email">Email</Label>
                <Input id="sign-up-email" type="email" placeholder="editor@devlabs.news" disabled={loading} {...signUpForm.register('email')} />
                {signUpForm.formState.errors.email ? <p className="text-sm text-destructive">{signUpForm.formState.errors.email.message}</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="sign-up-password">Пароль</Label>
                <Input id="sign-up-password" type="password" placeholder="Минимум 8 символов" disabled={loading} {...signUpForm.register('password')} />
                {signUpForm.formState.errors.password ? <p className="text-sm text-destructive">{signUpForm.formState.errors.password.message}</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="sign-up-confirm-password">Повтори пароль</Label>
                <Input id="sign-up-confirm-password" type="password" placeholder="Повтори пароль" disabled={loading} {...signUpForm.register('confirmPassword')} />
                {signUpForm.formState.errors.confirmPassword ? <p className="text-sm text-destructive">{signUpForm.formState.errors.confirmPassword.message}</p> : null}
              </div>
              <Button className="w-full" type="submit" disabled={loading}>
                {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Создать аккаунт
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Separator />
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Telegram</span>
            <Separator />
          </div>

          {!telegramAvailable ? (
            <Alert>
              <AlertTitle>Telegram недоступен</AlertTitle>
              <AlertDescription>Открой приложение внутри Telegram или войди по email.</AlertDescription>
            </Alert>
          ) : null}

          <Button className="w-full" type="button" variant="secondary" onClick={handleTelegramSignIn} disabled={loading}>
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Войти через Telegram
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
