import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container } from '@/components/layout/container';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { isWelcomeOnboardingDone, markWelcomeOnboardingDone } from '@/features/onboarding/welcome';
import { getTelegramEnvironment } from '@/lib/telegram';
import { useAuth } from '@/providers/auth-provider';

type WelcomeStep = {
  description: string;
  primaryLabel: string;
  title: string;
};

const welcomeSteps: WelcomeStep[] = [
  {
    description: 'Это новостное приложение внутри Telegram. Всё важное по разработке в одном месте.',
    primaryLabel: 'Начать',
    title: 'Добро пожаловать в DevLabs News',
  },
  {
    description: 'Обычная Лента показывает общий поток, а Умная лента собирает персональную подборку под ваши интересы.',
    primaryLabel: 'Понятно',
    title: 'Две ленты для разных задач',
  },
  {
    description: 'Темы для Умной ленты выбираются через кнопку «Разделы», а уведомления о подборке включаются в блоке «Умная лента» профиля.',
    primaryLabel: 'Настроить разделы',
    title: 'Настройте подборку под себя',
  },
];

export function WelcomeOnboardingPage() {
  const navigate = useNavigate();
  const { isAuthed, loading, user } = useAuth();
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!isAuthed || !user?.id || getTelegramEnvironment() !== 'telegram') {
      void navigate('/', { replace: true });
      return;
    }

    if (isWelcomeOnboardingDone(user.id)) {
      void navigate('/', { replace: true });
    }
  }, [isAuthed, loading, navigate, user?.id]);

  const step = useMemo(() => welcomeSteps[stepIndex] ?? welcomeSteps[0], [stepIndex]);
  const isLastStep = stepIndex >= welcomeSteps.length - 1;

  const finishOnboarding = (targetPath: string) => {
    if (user?.id) {
      markWelcomeOnboardingDone(user.id);
    }

    void navigate(targetPath, { replace: true });
  };

  const handlePrimaryAction = () => {
    if (isLastStep) {
      finishOnboarding('/topic-preferences');
      return;
    }

    setStepIndex((current) => Math.min(current + 1, welcomeSteps.length - 1));
  };

  if (loading) {
    return (
      <Container className="safe-pb safe-pt py-6">
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-[2rem]" />
          <Skeleton className="h-48 w-full rounded-[2rem]" />
          <Skeleton className="h-16 w-full rounded-[2rem]" />
        </div>
      </Container>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,hsl(191_92%_54%_/_0.14),transparent_34%),linear-gradient(180deg,hsl(220_26%_12%),hsl(220_30%_8%))]">
      <Container className="safe-pb safe-pt flex min-h-screen max-w-3xl flex-col pb-8 pt-6 sm:pt-8">
        <div className="rounded-[2rem] border border-white/10 bg-card/85 p-6 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.8)] backdrop-blur sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-300/80">
            Шаг {stepIndex + 1} из {welcomeSteps.length}
          </p>
          <h1 className="mt-4 text-3xl font-semibold leading-tight text-white sm:text-4xl">{step.title}</h1>
          <p className="mt-4 text-sm leading-7 text-white/70 sm:text-base">{step.description}</p>
        </div>

        <div className="mt-auto pt-8">
          <div className="grid gap-3 sm:grid-cols-2">
            <Button type="button" className="h-12 text-base" onClick={handlePrimaryAction}>
              {step.primaryLabel}
            </Button>
            <Button type="button" variant="outline" className="h-12 text-base" onClick={() => finishOnboarding('/')}>
              {isLastStep ? 'Позже' : 'Пропустить'}
            </Button>
          </div>
        </div>
      </Container>
    </div>
  );
}
