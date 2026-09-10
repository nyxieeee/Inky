import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RotateCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Inky Uncaught Error Boundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg)] font-sans">
          <div className="card-organic max-w-md w-full p-8 text-center space-y-5 rounded-[2.5rem] shadow-2xl border border-[var(--border-light)]">
            <div className="h-16 w-16 rounded-[1.5rem] flex items-center justify-center mx-auto bg-red-100/60 dark:bg-red-950/40">
              <AlertCircle className="h-8 w-8 text-[#A85448]" />
            </div>
            <div>
              <h2 className="font-display font-bold text-xl text-[var(--fg)]">
                Something went wrong
              </h2>
              <p className="text-xs text-[var(--fg-muted)] mt-1.5 leading-relaxed">
                An unexpected interface error occurred. We've preserved your data.
              </p>
              {this.state.error && (
                <div className="mt-3 p-3 rounded-xl bg-[var(--bg-stone)] border border-[var(--border-light)] text-[11px] font-mono text-left text-[var(--fg-muted)] overflow-x-auto max-h-24">
                  {this.state.error.message}
                </div>
              )}
            </div>
            <div className="flex gap-2 justify-center pt-2">
              <button
                onClick={this.handleReload}
                className="btn-outline text-xs flex items-center gap-1.5 px-4 py-2"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reload</span>
              </button>
              <button
                onClick={this.handleReset}
                className="btn-primary text-xs flex items-center gap-1.5 px-4 py-2"
              >
                <Home className="h-3.5 w-3.5" />
                <span>Back to Home</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
