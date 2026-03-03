import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createDefaultTopicFilterState, getEnabledTopicKeys, type TopicFilterState, type TopicKey } from '@/features/topics/model';
import { readTopicFilterState, writeTopicFilterState } from '@/lib/topic-filter-storage';

type ReadingTextSize = 's' | 'm' | 'l';
type ReadingWidth = 'narrow' | 'wide';

type PreferencesContextValue = {
  enabledTopicCount: number;
  motionEnabled: boolean;
  reduceMotion: boolean;
  resetTopicFilters: () => void;
  setReadingWidth: (value: ReadingWidth) => void;
  setReduceMotion: (value: boolean) => void;
  setTextSize: (value: ReadingTextSize) => void;
  setTopicEnabled: (key: TopicKey, value: boolean) => void;
  textSize: ReadingTextSize;
  textSizeClassName: string;
  topicFilters: TopicFilterState;
  textWidth: ReadingWidth;
  textWidthClassName: string;
};

const textSizeKey = 'dev-labs:reading:text-size';
const reduceMotionKey = 'dev-labs:reading:reduce-motion';
const textWidthKey = 'dev-labs:reading:text-width';

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

const textSizeClasses: Record<ReadingTextSize, string> = {
  l: 'prose-lg sm:prose-xl',
  m: 'prose-base sm:prose-lg',
  s: 'prose-sm sm:prose-base',
};

const textWidthClasses: Record<ReadingWidth, string> = {
  narrow: 'max-w-4xl',
  wide: 'max-w-5xl',
};

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [textSize, setTextSize] = useState<ReadingTextSize>('m');
  const [reduceMotion, setReduceMotion] = useState(false);
  const [textWidth, setReadingWidth] = useState<ReadingWidth>('narrow');
  const [topicFilters, setTopicFilters] = useState<TopicFilterState>(createDefaultTopicFilterState);

  useEffect(() => {
    const savedTextSize = window.localStorage.getItem(textSizeKey) as ReadingTextSize | null;
    const savedReduceMotion = window.localStorage.getItem(reduceMotionKey);
    const savedTextWidth = window.localStorage.getItem(textWidthKey) as ReadingWidth | null;

    if (savedTextSize === 's' || savedTextSize === 'm' || savedTextSize === 'l') {
      setTextSize(savedTextSize);
    }

    if (savedReduceMotion === 'true' || savedReduceMotion === 'false') {
      setReduceMotion(savedReduceMotion === 'true');
    }

    if (savedTextWidth === 'narrow' || savedTextWidth === 'wide') {
      setReadingWidth(savedTextWidth);
    }

    setTopicFilters(readTopicFilterState());
  }, []);

  useEffect(() => {
    window.localStorage.setItem(textSizeKey, textSize);
  }, [textSize]);

  useEffect(() => {
    window.localStorage.setItem(reduceMotionKey, String(reduceMotion));
    document.documentElement.dataset.reduceMotion = reduceMotion ? 'true' : 'false';
  }, [reduceMotion]);

  useEffect(() => {
    window.localStorage.setItem(textWidthKey, textWidth);
  }, [textWidth]);

  useEffect(() => {
    writeTopicFilterState(topicFilters);
  }, [topicFilters]);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      enabledTopicCount: getEnabledTopicKeys(topicFilters).length,
      motionEnabled: !reduceMotion,
      reduceMotion,
      resetTopicFilters: () => setTopicFilters(createDefaultTopicFilterState()),
      setReadingWidth,
      setReduceMotion,
      setTextSize,
      setTopicEnabled: (key: TopicKey, value: boolean) => {
        setTopicFilters((current) => ({
          ...current,
          [key]: value,
        }));
      },
      textSize,
      textSizeClassName: textSizeClasses[textSize],
      topicFilters,
      textWidth,
      textWidthClassName: textWidthClasses[textWidth],
    }),
    [reduceMotion, textSize, textWidth, topicFilters],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function useReadingPreferences() {
  const context = useContext(PreferencesContext);

  if (!context) {
    throw new Error('useReadingPreferences must be used within PreferencesProvider');
  }

  return context;
}
