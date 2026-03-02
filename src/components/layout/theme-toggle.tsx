import type { ComponentProps } from 'react';
import { MoonStar, SunMedium } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/providers/theme-provider';

type ThemeToggleProps = Omit<ComponentProps<typeof Button>, 'children' | 'onClick'>;

export function ThemeToggle(props: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button variant="outline" size="icon" onClick={toggleTheme} aria-label="Toggle theme" {...props}>
      {theme === 'dark' ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
    </Button>
  );
}
