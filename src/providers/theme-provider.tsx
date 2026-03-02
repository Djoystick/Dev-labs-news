import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { initTelegramWebApp } from '@/lib/telegram';

type Theme = 'light' | 'dark';

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const storageKey = 'dev-labs-news-theme';

function applyTelegramTheme() {
  const result = initTelegramWebApp();
  const root = document.documentElement;

  if (result.themeParams?.bg_color) root.style.setProperty('--telegram-bg', result.themeParams.bg_color);
  if (result.themeParams?.text_color) root.style.setProperty('--telegram-text', result.themeParams.text_color);
  if (result.themeParams?.hint_color) root.style.setProperty('--telegram-hint', result.themeParams.hint_color);
  if (result.themeParams?.link_color) root.style.setProperty('--telegram-link', result.themeParams.link_color);
  if (result.themeParams?.button_color) root.style.setProperty('--telegram-button', result.themeParams.button_color);
  if (result.themeParams?.button_text_color) root.style.setProperty('--telegram-button-text', result.themeParams.button_text_color);

  return result.colorScheme === 'dark' ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey) as Theme | null;
    const telegramTheme = applyTelegramTheme();
    setTheme(stored ?? telegramTheme);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    window.localStorage.setItem(storageKey, theme);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      toggleTheme: () => setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark')),
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }

  return context;
}
