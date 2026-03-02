import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoaderCircle, LogIn, Mail, Send, UserPlus } from 'lucide-react';
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
        message: 'Enter your email first.',
        type: 'manual',
      });
      return;
    }

    try {
      await resetPassword(email);
      toast.success('Password reset email sent.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send reset email.');
    }
  };

  const handleTelegramSignIn = async () => {
    try {
      await signInWithTelegram();
      toast.success('Signed in with Telegram.');
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Telegram sign-in failed.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Account access</DialogTitle>
          <DialogDescription>Войди через email или Telegram.</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'sign-in' | 'sign-up')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="sign-in">Sign in</TabsTrigger>
            <TabsTrigger value="sign-up">Register</TabsTrigger>
          </TabsList>

          <TabsContent value="sign-in">
            <form
              className="space-y-4"
              onSubmit={signInForm.handleSubmit(async (values) => {
                try {
                  await signIn(values.email, values.password);
                  toast.success('Signed in successfully.');
                  onOpenChange(false);
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : 'Sign-in failed.');
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
                  <Label htmlFor="sign-in-password">Password</Label>
                  <button type="button" className="text-xs font-semibold text-primary" onClick={handleForgotPassword}>
                    Forgot password?
                  </button>
                </div>
                <Input id="sign-in-password" type="password" placeholder="At least 8 characters" disabled={loading} {...signInForm.register('password')} />
                {signInForm.formState.errors.password ? <p className="text-sm text-destructive">{signInForm.formState.errors.password.message}</p> : null}
              </div>
              <Button className="w-full" type="submit" disabled={loading}>
                {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                Sign in
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="sign-up">
            <form
              className="space-y-4"
              onSubmit={signUpForm.handleSubmit(async (values) => {
                try {
                  const result = await signUp(values.email, values.password);
                  toast.success(result.requiresEmailConfirmation ? 'Registration succeeded. Confirm your email before signing in.' : 'Account created and signed in.');
                  if (!result.requiresEmailConfirmation) {
                    onOpenChange(false);
                  }
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : 'Registration failed.');
                }
              })}
            >
              <div className="space-y-2">
                <Label htmlFor="sign-up-email">Email</Label>
                <Input id="sign-up-email" type="email" placeholder="editor@devlabs.news" disabled={loading} {...signUpForm.register('email')} />
                {signUpForm.formState.errors.email ? <p className="text-sm text-destructive">{signUpForm.formState.errors.email.message}</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="sign-up-password">Password</Label>
                <Input id="sign-up-password" type="password" placeholder="At least 8 characters" disabled={loading} {...signUpForm.register('password')} />
                {signUpForm.formState.errors.password ? <p className="text-sm text-destructive">{signUpForm.formState.errors.password.message}</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="sign-up-confirm-password">Confirm password</Label>
                <Input id="sign-up-confirm-password" type="password" placeholder="Repeat your password" disabled={loading} {...signUpForm.register('confirmPassword')} />
                {signUpForm.formState.errors.confirmPassword ? <p className="text-sm text-destructive">{signUpForm.formState.errors.confirmPassword.message}</p> : null}
              </div>
              <Button className="w-full" type="submit" disabled={loading}>
                {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Create account
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
              <AlertTitle>Telegram sign-in is unavailable</AlertTitle>
              <AlertDescription>Открой приложение внутри Telegram или используй email и пароль.</AlertDescription>
            </Alert>
          ) : null}

          <Button className="w-full" type="button" variant="secondary" onClick={handleTelegramSignIn} disabled={loading}>
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Sign in with Telegram
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
