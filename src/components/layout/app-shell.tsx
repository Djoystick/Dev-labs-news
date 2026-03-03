import type { ReactNode } from 'react';
import { BottomBar } from '@/components/layout/bottom-bar';
import { Footer } from '@/components/layout/footer';
import { Header } from '@/components/layout/header';

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <Header />
      <main className="app-header-offset app-bottom-nav-offset">{children}</main>
      <Footer />
      <BottomBar />
    </div>
  );
}
