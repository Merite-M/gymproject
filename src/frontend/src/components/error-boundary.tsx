"use client";

import { Component, ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Call custom error handler if provided (e.g., for error tracking service)
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // TODO: Integrate with error tracking service (e.g., Sentry, LogRocket)
    // Example: Sentry.captureException(error, { extra: errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-canvas-bg flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-surface rounded-xl shadow-lg border border-border-hairline p-8 text-center">
            <div className="w-16 h-16 bg-danger-soft rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-danger-crimson text-3xl">error</span>
            </div>
            <h2 className="text-2xl font-bold text-primary mb-2">Something went wrong</h2>
            <p className="text-text-muted mb-6">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={this.handleReset}
                className="bg-surface-container border border-border-hairline text-primary px-6 py-3 rounded-lg font-semibold hover:bg-surface-muted transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="bg-primary text-on-primary px-6 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}