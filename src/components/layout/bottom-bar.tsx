import { FileStack, Home, Sparkles, UserRound } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

const items = [
  { href: '/', icon: Home, label: '\u041b\u0435\u043d\u0442\u0430' },
  { href: '/for-you', icon: Sparkles, label: '\u0414\u043b\u044f \u0442\u0435\u0431\u044f' },
  { href: '/digests', icon: FileStack, label: '\u0421\u0432\u043e\u0434\u043a\u0438' },
  { href: '/profile', icon: UserRound, label: '\u041f\u0440\u043e\u0444\u0438\u043b\u044c' },
] as const;

export function BottomBar() {
  const location = useLocation();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-[55] border-t border-border/70 bg-background/95 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-3 backdrop-blur-xl">
      <div className="mx-auto grid max-w-lg grid-cols-4 gap-2 rounded-[1.5rem] border border-border/70 bg-card/90 p-2 shadow-[0_20px_48px_-32px_rgba(15,23,42,0.65)]">
        {items.map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex min-h-11 flex-col items-center justify-center gap-1 rounded-[1rem] px-2 py-2 text-[11px] font-semibold transition',
                isActive ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground',
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
