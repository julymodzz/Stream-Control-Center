import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
  stack: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '', stack: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message,
      stack: error.stack ?? '',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-surface p-6">
          <div className="card max-w-lg text-center">
            <h1 className="text-xl font-bold text-accent-red">Ein Fehler ist aufgetreten</h1>
            <p className="mt-2 text-sm text-gray-400">{this.state.message}</p>
            {import.meta.env.DEV && this.state.stack && (
              <pre className="mt-4 max-h-48 overflow-auto rounded bg-black/40 p-3 text-left text-xs text-gray-500">
                {this.state.stack}
              </pre>
            )}
            <button
              className="btn-primary mt-4"
              onClick={() => window.location.reload()}
            >
              Seite neu laden
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
