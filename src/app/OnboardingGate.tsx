import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container } from '@/components/layout/container';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchMyTopicIds } from '@/features/topics/api';
import { isTopicsOnboardingDone } from '@/features/topics/onboarding';
import { useAuth } from '@/providers/auth-provider';

type OnboardingGateProps = {
  children: ReactNode;
};

export function OnboardingGate({ children }: OnboardingGateProps) {
  const navigate = useNavigate();
  const { isAuthed, loading, user } = useAuth();
  const [checking, setChecking] = useState(true);
  const checkedUserRef = useRef<{ hasTopics: boolean; userId: string } | null>(null);

  useEffect(() => {
    if (loading) {
      setChecking(true);
      return;
    }

    if (!isAuthed || !user?.id) {
      setChecking(false);
      return;
    }

    if (isTopicsOnboardingDone()) {
      setChecking(false);
      return;
    }

    const cachedCheck = checkedUserRef.current;

    if (cachedCheck?.userId === user.id) {
      if (!cachedCheck.hasTopics) {
        void navigate('/onboarding/topics', { replace: true });
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

        const hasTopics = topicIds.length > 0;
        checkedUserRef.current = { hasTopics, userId: user.id };

        if (!hasTopics) {
          void navigate('/onboarding/topics', { replace: true });
          return;
        }

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
  }, [isAuthed, loading, navigate, user?.id]);

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
