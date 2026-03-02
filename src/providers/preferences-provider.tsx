import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type ReadingTextSize = 's' | 'm' | 'l';
type ReadingWidth = 'narrow' | 'wide';

type PreferencesContextValue = {
  motionEnabled: boolean;
  reduceMotion: boolean;
  setReadingWidth: (value: ReadingWidth) => void;
  setReduceMotion: (value: boolean) => void;
  setTextSize: (value: ReadingTextSize) => void;
  textSize: ReadingTextSize;
  textSizeClassName: string;
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

  const value = useMemo<PreferencesContextValue>(
    () => ({
      motionEnabled: !reduceMotion,
      reduceMotion,
      setReadingWidth,
      setReduceMotion,
      setTextSize,
      textSize,
      textSizeClassName: textSizeClasses[textSize],
      textWidth,
      textWidthClassName: textWidthClasses[textWidth],
    }),
    [reduceMotion, textSize, textWidth],
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
