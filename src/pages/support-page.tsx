import { CheckCircle2, X } from 'lucide-react';
import { useCallback, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FlatPage } from '@/components/layout/flat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StateCard } from '@/components/ui/state-card';
import { Textarea } from '@/components/ui/textarea';
import { getSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type SupportInsertPayload = {
  user_id: string;
  contact: string | null;
  subject: string;
  message: string;
  page: string;
  user_agent: string | null;
};

type SupportInsertBuilder = {
  insert: (payload: SupportInsertPayload) => Promise<{ error: { message: string } | null }>;
};

export function SupportPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [subjectError, setSubjectError] = useState<string | null>(null);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const onClose = useCallback(() => {
    if (location.key && location.key !== 'default') {
      navigate(-1);
      return;
    }

    navigate('/profile', { replace: true });
  }, [location.key, navigate]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const nextSubject = subject.trim();
      const nextMessage = message.trim();
      let hasError = false;

      if (!nextSubject) {
        setSubjectError('Укажите тему обращения.');
        hasError = true;
      } else {
        setSubjectError(null);
      }

      if (!nextMessage) {
        setMessageError('Опишите ваш вопрос или проблему.');
        hasError = true;
      } else {
        setMessageError(null);
      }

      if (hasError || !user?.id) {
        return;
      }

      setIsSubmitting(true);
      setSubmitError(null);

      try {
        const supabase = getSupabaseClient();
        const supportTable = (supabase as unknown as { from: (table: string) => SupportInsertBuilder }).from('support_requests');
        const { error } = await supportTable.insert({
          user_id: user.id,
          contact: contact.trim() ? contact.trim() : null,
          subject: nextSubject,
          message: nextMessage,
          page: location.pathname,
          user_agent: typeof navigator === 'undefined' ? null : navigator.userAgent,
        });

        if (error) {
          throw new Error(error.message);
        }

        setIsSuccess(true);
      } catch {
        setSubmitError('Не удалось отправить обращение. Попробуйте ещё раз.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [contact, location.pathname, message, subject, user?.id],
  );

  const resetForm = useCallback(() => {
    setSubject('');
    setMessage('');
    setContact('');
    setSubjectError(null);
    setMessageError(null);
    setSubmitError(null);
    setIsSuccess(false);
  }, []);

  return (
    <FlatPage className="py-6 sm:py-8">
      <div className="space-y-5">
        <div className="border-b border-border/60 pb-4">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-3xl font-extrabold">Поддержка</h1>
            <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Закрыть">
              <X className="h-5 w-5" />
            </Button>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Напишите нам, если нужна помощь или хотите предложить улучшение.</p>
        </div>

        {!user ? (
          <div className="space-y-3">
            <StateCard title="Нужен вход" description="Войдите, чтобы отправить обращение." />
            <Button type="button" onClick={() => navigate('/profile')}>
              {'Перейти в профиль'}
            </Button>
          </div>
        ) : null}

        {user && isSuccess ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-300" />
            <h2 className="mt-3 text-xl font-semibold text-white">Отправлено</h2>
            <p className="mt-1 text-sm text-white/70">Спасибо, мы получили ваше обращение.</p>
            <Button type="button" className="mt-4" onClick={resetForm}>
              {'Отправить ещё'}
            </Button>
          </div>
        ) : null}

        {user && !isSuccess ? (
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <div className="space-y-2">
              <Label htmlFor="support-subject">Тема</Label>
              <Input
                id="support-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Кратко опишите вопрос"
                aria-invalid={subjectError ? true : undefined}
              />
              {subjectError ? <p className="text-xs text-destructive">{subjectError}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="support-message">Сообщение</Label>
              <Textarea
                id="support-message"
                rows={6}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Опишите, что произошло"
                aria-invalid={messageError ? true : undefined}
              />
              {messageError ? <p className="text-xs text-destructive">{messageError}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="support-contact">Контакт</Label>
              <Input
                id="support-contact"
                value={contact}
                onChange={(event) => setContact(event.target.value)}
                placeholder="Telegram / Email"
              />
            </div>

            {submitError ? (
              <div className="rounded-xl border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive">
                <p>{submitError}</p>
              </div>
            ) : null}

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Отправляем...' : 'Отправить'}
              </Button>
              {submitError ? (
                <Button type="submit" variant="outline" disabled={isSubmitting}>
                  {'Повторить'}
                </Button>
              ) : null}
            </div>
          </form>
        ) : null}
      </div>
    </FlatPage>
  );
}
