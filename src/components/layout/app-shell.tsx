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
  const showHeader = location.pathname === '/';

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {showHeader ? <Header /> : null}
      <main id="app-scroll" className={showHeader ? 'app-header-offset app-bottom-nav-offset' : 'app-bottom-nav-offset'}>
        {children}
      </main>
      <Footer />
      <BottomBar />
    </div>
  );
}
