import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Container } from '@/components/layout/container';
import { Skeleton } from '@/components/ui/skeleton';
import { isWelcomeOnboardingDone, markWelcomeOnboardingDone } from '@/features/onboarding/welcome';
import { fetchMyTopicIds } from '@/features/topics/api';
import { getTelegramEnvironment } from '@/lib/telegram';
import { useAuth } from '@/providers/auth-provider';

type OnboardingGateProps = {
  children: ReactNode;
};

export function OnboardingGate({ children }: OnboardingGateProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthed, loading, user } = useAuth();
  const [checking, setChecking] = useState(true);
  const checkedUserRef = useRef<{ shouldShow: boolean; userId: string } | null>(null);
  const isOnboardingRoute = location.pathname.startsWith('/onboarding');

  useEffect(() => {
    if (loading) {
      setChecking(true);
      return;
    }

    if (isOnboardingRoute) {
      setChecking(false);
      return;
    }

    if (!isAuthed || !user?.id) {
      setChecking(false);
      return;
    }

    if (getTelegramEnvironment() !== 'telegram') {
      setChecking(false);
      return;
    }

    if (isWelcomeOnboardingDone(user.id)) {
      setChecking(false);
      return;
    }

    const cachedCheck = checkedUserRef.current;

    if (cachedCheck?.userId === user.id) {
      if (cachedCheck.shouldShow) {
        void navigate('/onboarding/welcome', { replace: true });
        return;
      }

      setChecking(false);
      return;
    }

    let active = true;
    setChecking(true);

    void fetchMyTopicIds(user.id)
      .then((topicIds) => {
        if (!active) {
          return;
        }

        const shouldShowWelcome = topicIds.length === 0;
        checkedUserRef.current = { shouldShow: shouldShowWelcome, userId: user.id };

        if (shouldShowWelcome) {
          setChecking(false);
          void navigate('/onboarding/welcome', { replace: true });
          return;
        }

        markWelcomeOnboardingDone(user.id);
        setChecking(false);
      })
      .catch(() => {
        if (active) {
          setChecking(false);
        }
      });

    return () => {
      active = false;
    };
  }, [isAuthed, isOnboardingRoute, loading, navigate, user?.id]);

  if (checking) {
    return (
      <Container className="safe-pb safe-pt py-6">
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-[2rem]" />
          <Skeleton className="h-48 w-full rounded-[2rem]" />
          <Skeleton className="h-28 w-full rounded-[2rem]" />
        </div>
      </Container>
    );
  }

  return <>{children}</>;
}
