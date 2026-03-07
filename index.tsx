import React, { ReactNode, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './i18n';
import { applyDocumentLocale, DEFAULT_LOCALE, normalizeLocale } from './config/locales';
import { extractLocaleFromPath, isToolRoute } from './config/routes';

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

const BootstrapShellHandoff: React.FC = () => {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    const shell = document.getElementById('app-bootstrap-shell');
    let removalTimer: number | undefined;

    const finalizeRemoval = () => {
      shell?.remove();
    };

    const frame = window.requestAnimationFrame(() => {
      root.setAttribute('data-tf-react-mounted', 'true');
      if (!shell) return;
      shell.addEventListener('transitionend', finalizeRemoval, { once: true });
      removalTimer = window.setTimeout(finalizeRemoval, 240);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (removalTimer !== undefined) {
        window.clearTimeout(removalTimer);
      }
      shell?.removeEventListener('transitionend', finalizeRemoval);
    };
  }, []);

  return null;
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

if (typeof window !== 'undefined') {
  const localeFromPath = extractLocaleFromPath(window.location.pathname);
  let storedLocale = DEFAULT_LOCALE;
  try {
    storedLocale = normalizeLocale(window.localStorage.getItem('tf_app_language'));
  } catch {
    storedLocale = DEFAULT_LOCALE;
  }
  const initialLocale = isToolRoute(window.location.pathname)
    ? localeFromPath ?? storedLocale
    : localeFromPath ?? DEFAULT_LOCALE;
  applyDocumentLocale(initialLocale);
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
        <BootstrapShellHandoff />
        <App />
    </ErrorBoundary>
  </React.StrictMode>
);
