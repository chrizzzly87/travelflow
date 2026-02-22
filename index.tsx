import React, { ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './i18n';
import {
  getCurrentBlogPostTransitionTarget,
  getLastKnownBlogPostTransitionTarget,
  isBlogListPath,
  isBlogRoutePath,
  primeBlogTransitionSnapshot,
  setPendingBlogTransitionTarget,
  startBlogViewTransition,
  supportsBlogViewTransitions,
  waitForBlogTransitionTarget,
} from './shared/blogViewTransitions';

declare global {
  interface Window {
    __tfBlogPopstateTransitionBound?: boolean;
  }
}

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 font-sans text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h1>
          <p className="text-gray-600 mb-4">The application encountered an error while loading.</p>
          <pre className="bg-gray-100 p-4 rounded text-left text-sm overflow-auto max-w-2xl mx-auto">
            {this.state.error?.toString()}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 px-4 py-2 bg-accent-600 text-white rounded hover:bg-accent-700"
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

if (typeof window !== 'undefined' && !window.__tfBlogPopstateTransitionBound) {
  window.__tfBlogPopstateTransitionBound = true;
  window.addEventListener('popstate', () => {
    if (!supportsBlogViewTransitions()) return;
    const toPathname = window.location.pathname;
    if (!isBlogRoutePath(toPathname)) return;

    const currentTarget = getCurrentBlogPostTransitionTarget() ?? getLastKnownBlogPostTransitionTarget();
    if (!currentTarget) return;

    setPendingBlogTransitionTarget(currentTarget);
    startBlogViewTransition(() => {
      const expectedRouteKind = isBlogListPath(toPathname) ? 'list' : 'post';
      return waitForBlogTransitionTarget(currentTarget, expectedRouteKind, 280).finally(() => {
        primeBlogTransitionSnapshot();
      });
    });
  }, true);
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
        <App />
    </ErrorBoundary>
  </React.StrictMode>
);
