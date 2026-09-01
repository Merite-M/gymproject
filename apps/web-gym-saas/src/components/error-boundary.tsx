"use client";

import { Component, ReactNode, ErrorInfo } from 'react';
import { AlertCircle, WifiOff, RotateCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isNetworkError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, isNetworkError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    const isNetworkError =
      error.message?.toLowerCase().includes('network') ||
      error.message?.toLowerCase().includes('fetch') ||
      error.message?.toLowerCase().includes('offline') ||
      (typeof navigator !== 'undefined' && !navigator.onLine);

    return { hasError: true, error, isNetworkError };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught runtime exception:', error, errorInfo);

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, isNetworkError: false });
  };

  render() {
    if (this.state.hasError) {
      const { error, isNetworkError } = this.state;
      const title = this.props.fallbackTitle || (isNetworkError ? 'Connection Issue' : 'Something went wrong');
      const description = isNetworkError
        ? 'Unable to connect to PolyFit servers. Please check your internet connection and try again.'
        : error?.message || 'An unexpected application error occurred.';

      return (
        <div className="min-h-[400px] w-full flex items-center justify-center p-6 bg-canvas-bg">
          <div className="max-w-md w-full bg-surface rounded-xl shadow-lg border border-border-hairline p-8 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-danger-soft/20 text-danger-crimson rounded-full flex items-center justify-center mx-auto mb-4 border border-danger-soft/40">
              {isNetworkError ? <WifiOff className="w-7 h-7" /> : <AlertCircle className="w-7 h-7" />}
            </div>
            <h2 className="text-xl font-bold text-primary mb-2">{title}</h2>
            <p className="text-sm text-text-muted mb-6 leading-relaxed">
              {description}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex items-center justify-center gap-2 bg-surface-container border border-border-hairline text-primary px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-surface-muted transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Try Again
              </button>
              <button
                type="button"
                onClick={() => { window.location.href = '/'; }}
                className="flex items-center justify-center gap-2 bg-primary text-on-primary px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                <Home className="w-4 h-4" />
                Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}