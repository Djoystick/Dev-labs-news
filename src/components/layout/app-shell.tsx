import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { BottomBar } from '@/components/layout/bottom-bar';
import { Footer } from '@/components/layout/footer';
import { Header } from '@/components/layout/header';

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const pathname = location.pathname;
  const showHeader = location.pathname === '/';
  const showBottomBar = pathname === '/' || pathname === '/for-you' || pathname === '/digests' || pathname === '/profile';

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {showHeader ? <Header /> : null}
      <main
        id="app-scroll"
        className={showHeader ? (showBottomBar ? 'app-header-offset app-bottom-nav-offset' : 'app-header-offset') : showBottomBar ? 'app-bottom-nav-offset' : undefined}
      >
        {children}
      </main>
      {showBottomBar ? null : <Footer />}
      {showBottomBar ? <BottomBar /> : null}
    </div>
  );
}
