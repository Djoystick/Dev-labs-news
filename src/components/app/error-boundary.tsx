import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(error, errorInfo);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg rounded-[2rem] border border-border/70 bg-card/90 p-8 text-center shadow-[0_32px_80px_-42px_rgba(15,23,42,0.45)]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h1 className="mt-5 text-2xl font-bold">Что-то пошло не так</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Попробуй перезагрузить приложение. Если проблема повторяется, проверь консоль и последние изменения.</p>
          {import.meta.env.DEV ? <pre className="mt-5 overflow-x-auto rounded-2xl bg-secondary/60 p-4 text-left text-xs text-muted-foreground">{this.state.error.message}</pre> : null}
          <Button className="mt-6" onClick={() => window.location.reload()}>
            <RotateCcw className="h-4 w-4" />
            Перезагрузить
          </Button>
        </div>
      </div>
    );
  }
}
