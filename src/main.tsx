import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ErrorBoundary } from '@/components/app/error-boundary';
import { EnvGuard } from '@/components/app/env-guard';
import { initTelegramWebAppRuntime } from '@/lib/telegram';
import { ThemeProvider } from '@/providers/theme-provider';
import { AuthProvider } from '@/providers/auth-provider';
import { LibraryProvider } from '@/providers/library-provider';
import { PreferencesProvider } from '@/providers/preferences-provider';
import { router } from '@/router';
import '@/styles/index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root not found');
}

initTelegramWebAppRuntime();

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <PreferencesProvider>
          <EnvGuard>
            <AuthProvider>
              <LibraryProvider>
                <RouterProvider router={router} />
                <Toaster richColors position="top-center" />
              </LibraryProvider>
            </AuthProvider>
          </EnvGuard>
        </PreferencesProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
