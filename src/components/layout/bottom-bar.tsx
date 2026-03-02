import { Bookmark, Home, UserRound } from 'lucide-react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';

const items = [
  { href: '/', icon: Home, id: 'feed', label: 'Лента' },
  { href: '/profile?tab=favorites', icon: Bookmark, id: 'favorites', label: 'Избранное' },
  { href: '/profile', icon: UserRound, id: 'profile', label: 'Профиль' },
] as const;

export function BottomBar() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') ?? 'profile';

  return (
    <nav className="fixed inset-x-0 bottom-0 z-[55] border-t border-border/70 bg-background/95 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-3 backdrop-blur-xl md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-3 gap-2 rounded-[1.5rem] border border-border/70 bg-card/90 p-2 shadow-[0_20px_48px_-32px_rgba(15,23,42,0.65)]">
        {items.map((item) => {
          const isActive =
            item.id === 'feed'
              ? location.pathname === '/'
              : item.id === 'favorites'
                ? location.pathname === '/profile' && activeTab === 'favorites'
                : location.pathname === '/profile' && activeTab !== 'favorites';

          const Icon = item.icon;

          return (
            <Link
              key={item.id}
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
