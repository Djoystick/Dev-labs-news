import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { EnvGuard } from '@/components/app/env-guard';
import { ThemeProvider } from '@/providers/theme-provider';
import { AuthProvider } from '@/providers/auth-provider';
import { router } from '@/router';
import '@/styles/index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <EnvGuard>
        <AuthProvider>
          <RouterProvider router={router} />
          <Toaster richColors position="top-center" />
        </AuthProvider>
      </EnvGuard>
    </ThemeProvider>
  </React.StrictMode>,
);
