import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Check } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container } from '@/components/layout/container';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchMyTopicIds, fetchTopics, setMyTopics } from '@/features/topics/api';
import { isTopicsOnboardingDone, markTopicsOnboardingDone } from '@/features/topics/onboarding';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import type { Topic } from '@/types/db';

type OnboardingStep = 'pick' | 'confirm';
const chipSkeletonWidths = ['w-28', 'w-36', 'w-32', 'w-40', 'w-24', 'w-44', 'w-28', 'w-36', 'w-24', 'w-32'];

function InlineError({
  actionLabel,
  message,
  onAction,
}: {
  actionLabel?: string;
  message: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-[1.5rem] border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p>{message}</p>
        {onAction ? (
          <button type="button" onClick={onAction} className="font-semibold text-destructive transition hover:opacity-80">
            {actionLabel ?? 'Retry'}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function TopicChip({
  onClick,
  selected,
  topic,
}: {
  onClick: () => void;
  selected: boolean;
  topic: Topic;
}) {
  return (
    <motion.button
      type="button"
      layout
      whileTap={{ scale: 0.97 }}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.18 }}
      onClick={onClick}
      className={cn(
        'group inline-flex items-center gap-2 rounded-full border px-4 py-3 text-left text-sm font-semibold transition-all duration-200',
        selected
          ? 'border-transparent bg-indigo-500 text-white shadow-[0_16px_40px_-24px_rgba(99,102,241,0.95)]'
          : 'border-border/80 bg-card/70 text-foreground hover:border-indigo-400/60 hover:bg-card',
      )}
    >
      <motion.span
        initial={false}
        animate={{
          opacity: selected ? 1 : 0.7,
          scale: selected ? 1 : 0.85,
        }}
        className={cn(
          'flex h-5 w-5 items-center justify-center rounded-full border text-[11px]',
          selected ? 'border-white/30 bg-white/18 text-white' : 'border-border/70 bg-background/60 text-muted-foreground',
        )}
      >
        <Check className="h-3.5 w-3.5" />
      </motion.span>
      <span>{topic.name}</span>
    </motion.button>
  );
}

export function TopicPreferencesOnboardingPage() {
  const navigate = useNavigate();
  const { isAuthed, loading, user } = useAuth();
  const [step, setStep] = useState<OnboardingStep>('pick');
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [retryToken, setRetryToken] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!isAuthed || !user?.id) {
      void navigate('/', { replace: true });
      return;
    }

    if (isTopicsOnboardingDone()) {
      void navigate('/', { replace: true });
      return;
    }

    const controller = new AbortController();
    setBootstrapping(true);
    setLoadError(null);

    void Promise.all([fetchTopics(controller.signal), fetchMyTopicIds(user.id, controller.signal)])
      .then(([loadedTopics, myTopicIds]) => {
        if (controller.signal.aborted) {
          return;
        }

        if (myTopicIds.length > 0) {
          void navigate('/', { replace: true });
          return;
        }

        setTopics(loadedTopics);
      })
      .catch((nextError) => {
        if (!controller.signal.aborted) {
          setLoadError(nextError instanceof Error ? nextError.message : 'Failed to prepare topic onboarding.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setBootstrapping(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [isAuthed, loading, navigate, retryToken, user?.id]);

  const selectedTopics = useMemo(() => topics.filter((topic) => selectedIds.includes(topic.id)), [selectedIds, topics]);

  const toggleTopic = (topicId: string) => {
    if (saving) {
      return;
    }

    setSaveError(null);
    setSelectedIds((currentIds) => (currentIds.includes(topicId) ? currentIds.filter((id) => id !== topicId) : [...currentIds, topicId]));
  };

  const finishOnboarding = () => {
    markTopicsOnboardingDone();
    void navigate('/', { replace: true });
  };

  const handleSave = async () => {
    if (selectedIds.length === 0 || saving) {
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      await setMyTopics(selectedIds);
      setStep('confirm');
    } catch (nextError) {
      setSaveError(nextError instanceof Error ? nextError.message : 'Failed to save topic preferences.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,hsl(229_84%_68%_/_0.22),transparent_34%),radial-gradient(circle_at_85%_15%,hsl(191_92%_54%_/_0.16),transparent_26%),linear-gradient(180deg,hsl(220_28%_10%),hsl(220_30%_8%))]">
      <Container className="safe-pt flex min-h-screen max-w-3xl flex-col pb-40 pt-6 sm:pb-44 sm:pt-10">
        <AnimatePresence mode="wait">
          {step === 'pick' ? (
            <motion.div
              key="pick"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              transition={{ duration: 0.24 }}
              className="flex flex-1 flex-col"
            >
              <div className="rounded-[2rem] border border-border/70 bg-card/80 p-6 shadow-[0_32px_80px_-42px_rgba(15,23,42,0.7)] backdrop-blur sm:p-8">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary">Topic preferences</p>
                <h1 className="mt-4 max-w-xl font-['Source_Serif_4'] text-4xl font-bold leading-tight text-balance sm:text-5xl">
                  Pick What Matters to You
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                  Choose the topics you want to follow first. We&apos;ll tailor your feed and future alerts around the signals you care about most.
                </p>
              </div>

              <div className="mt-6 space-y-4">
                {loadError ? <InlineError message={loadError} actionLabel="Retry" onAction={() => setRetryToken((current) => current + 1)} /> : null}

                <motion.div layout className="flex flex-wrap gap-3">
                  {bootstrapping
                    ? chipSkeletonWidths.map((widthClass, index) => (
                        <Skeleton key={`${widthClass}-${index}`} className={cn('h-12 rounded-full bg-secondary/55', widthClass)} />
                      ))
                    : topics.map((topic, index) => (
                        <motion.div
                          key={topic.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.03, duration: 0.2 }}
                        >
                          <TopicChip topic={topic} selected={selectedIds.includes(topic.id)} onClick={() => toggleTopic(topic.id)} />
                        </motion.div>
                      ))}
                </motion.div>
              </div>

              <div className="mt-auto pt-8">
                <AnimatePresence>
                  {selectedIds.length > 0 ? (
                    <motion.div
                      key="save"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      transition={{ duration: 0.22 }}
                      className="pointer-events-none fixed inset-x-0 bottom-0 z-30"
                    >
                      <div
                        className="bg-[linear-gradient(180deg,transparent_0%,hsl(220_30%_8%_/_0.82)_26%,hsl(220_30%_8%)_100%)] px-4 pt-8 backdrop-blur-xl"
                        style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}
                      >
                        <div className="mx-auto max-w-3xl rounded-[2rem] border border-border/70 bg-background/88 p-4 shadow-[0_-20px_60px_-42px_rgba(15,23,42,0.9)]">
                          <div className="pointer-events-auto">
                            <Button className="h-14 w-full text-base" onClick={handleSave} disabled={saving || bootstrapping || Boolean(loadError)}>
                              {saving ? 'Saving...' : 'Save & Continue'}
                            </Button>
                            {saveError ? <p className="mt-3 text-sm text-destructive">{saveError}</p> : null}
                            <button
                              type="button"
                              onClick={finishOnboarding}
                              className="mt-4 w-full text-center text-sm font-semibold text-muted-foreground transition hover:text-foreground"
                              disabled={saving}
                            >
                              Skip
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                <div className={cn('flex justify-center', selectedIds.length > 0 ? 'invisible mt-4' : 'mt-2')}>
                  <button
                    type="button"
                    onClick={finishOnboarding}
                    className="text-sm font-semibold text-muted-foreground transition hover:text-foreground"
                    disabled={saving || bootstrapping}
                  >
                    Skip
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              transition={{ duration: 0.24 }}
              className="flex flex-1 flex-col"
            >
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setStep('pick')}>
                  <ArrowLeft className="h-5 w-5" />
                  <span className="sr-only">Back</span>
                </Button>
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary">Topic preferences</p>
              </div>

              <div className="mt-6 rounded-[2rem] border border-border/70 bg-card/80 p-6 shadow-[0_32px_80px_-42px_rgba(15,23,42,0.7)] backdrop-blur sm:p-8">
                <h1 className="max-w-2xl font-['Source_Serif_4'] text-4xl font-bold leading-tight text-balance sm:text-5xl">
                  Get only the Alerts You Actually Want
                </h1>
                <p className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-primary/90">Here are your picks!</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {selectedTopics.map((topic) => (
                    <span
                      key={topic.id}
                      className="inline-flex items-center gap-2 rounded-full border border-transparent bg-indigo-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_40px_-24px_rgba(99,102,241,0.95)]"
                    >
                      <Check className="h-3.5 w-3.5" />
                      {topic.name}
                    </span>
                  ))}
                </div>
                <p className="mt-6 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                  We&apos;ll send you real-time updates for the beats you picked, so your home view stays focused and your notifications stay worth opening.
                </p>
              </div>

              <AnimatePresence>
                <motion.div
                  key="confirm-cta"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.22 }}
                  className="pointer-events-none fixed inset-x-0 bottom-0 z-30"
                >
                  <div
                    className="bg-[linear-gradient(180deg,transparent_0%,hsl(220_30%_8%_/_0.82)_26%,hsl(220_30%_8%)_100%)] px-4 pt-8 backdrop-blur-xl"
                    style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}
                  >
                    <div className="mx-auto max-w-3xl rounded-[2rem] border border-border/70 bg-background/88 p-4 shadow-[0_-20px_60px_-42px_rgba(15,23,42,0.9)]">
                      <div className="pointer-events-auto">
                        <Button className="h-14 w-full text-base" onClick={finishOnboarding}>
                          Yes, Keep Me Posted
                        </Button>
                        <button
                          type="button"
                          onClick={finishOnboarding}
                          className="mt-4 w-full text-center text-sm font-semibold text-muted-foreground transition hover:text-foreground"
                        >
                          Not now
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </Container>
    </div>
  );
}
