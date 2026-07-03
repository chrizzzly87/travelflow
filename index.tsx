import React, { ReactNode, Suspense } from 'react';
import { createRoot, hydrateRoot, type HydrationOptions } from 'react-dom/client';
import App from './App';
import './index.css';
import { APP_SHELL_NAMESPACES, preloadLocaleNamespaces } from './i18n';
import { applyDocumentLocale, DEFAULT_LOCALE, normalizeLocale } from './config/locales';
import { extractLocaleFromPath, isToolRoute } from './config/routes';
import { hasRenderableHandoffNode } from './services/bootstrapHandoffService';
import { preloadCriticalRouteModules } from './services/criticalRoutePreload';
import { shouldHydrateReactRoot } from './services/reactRootRenderMode';
import { AppBootstrapShell } from './components/bootstrap/AppBootstrapShell';

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
        <div className="p-8 font-sans text-center" data-tf-handoff-ready="true" data-tf-error-boundary="true">
          <h1 className="text-2xl font-semibold text-red-600 mb-4">Something went wrong</h1>
          <p className="text-gray-600 mb-4">The application encountered an error while loading.</p>
          <pre className="bg-gray-100 p-4 rounded text-left text-sm overflow-auto max-w-2xl mx-auto">
            {this.state.error?.toString()}
          </pre>
          <button type="button"
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

const setupBootstrapShellHandoff = (rootElement: HTMLElement) => {
  if (typeof document === 'undefined') return;

  const shell = document.getElementById('app-bootstrap-shell');
  if (!shell) return;

  let rafId: number | undefined;
  let observer: MutationObserver | undefined;
  let didScheduleRemoval = false;

  const finalizeRemoval = () => {
    shell.remove();
    if (rafId !== undefined) {
      window.cancelAnimationFrame(rafId);
      rafId = undefined;
    }
    observer?.disconnect();
    document.documentElement.setAttribute('data-tf-react-shell-visible', 'true');
  };

  const scheduleRemoval = () => {
    if (didScheduleRemoval) return;
    didScheduleRemoval = true;
    rafId = window.requestAnimationFrame(() => {
      finalizeRemoval();
    });
  };

  if (hasRenderableHandoffNode(rootElement)) {
    scheduleRemoval();
    return;
  }

  observer = new MutationObserver(() => {
    if (!hasRenderableHandoffNode(rootElement)) return;
    observer?.disconnect();
    scheduleRemoval();
  });

  observer.observe(rootElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-tf-handoff-ready'],
  });
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

// Root fallback must never be blank: under preact/compat a suspend at this
// boundary replaces the tree with the fallback, so `null` = white screen. We
// render the marketing boot-shell skeleton and tag it data-tf-handoff-ready so
// the boot-shell handoff still completes (the shell is never left stuck). In
// practice the i18n preload below keeps this boundary from tripping at all;
// this is defense in depth.
const RootFallback = () => (
  <div data-tf-handoff-ready="true">
    <AppBootstrapShell variant="marketing" testId="root-suspense-fallback" />
  </div>
);

const appNode = (
  <React.StrictMode>
    <Suspense fallback={<RootFallback />}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </Suspense>
  </React.StrictMode>
);

const isExpectedHydrationRecovery = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('Minified React error #418')
    || message.includes('Minified React error #423')
    || message.includes('Hydration failed')
    || message.includes('Text content does not match server-rendered HTML')
    || message.includes('There was an error while hydrating')
  );
};

const handleRecoverableReactError: HydrationOptions['onRecoverableError'] = (error, errorInfo) => {
  if (isExpectedHydrationRecovery(error)) return;
  console.error('Recoverable React error:', error, errorInfo);
};

const mountReactRoot = () => {
  if (shouldHydrateReactRoot(rootElement)) {
    hydrateRoot(rootElement, appNode, {
      onRecoverableError: handleRecoverableReactError,
    });
  } else {
    const root = createRoot(rootElement);
    root.render(appNode);
  }
};

// preact/compat (unlike React 18) does not keep the prerendered DOM on screen
// when the tree suspends during hydration — it swaps in the Suspense fallback.
// AppContent calls useTranslation(APP_SHELL_NAMESPACES) with useSuspense above
// the route-level boundary, so if those namespaces aren't in the i18next store
// when the first render runs, the whole tree suspends to the root fallback.
// That was the intermittent blank/partial load. So we await the app-shell
// namespaces before mounting — a small, same-origin JSON fetch (and preloaded
// via modulepreload), bounded by a timeout so a slow network can never block
// the mount. Route modules stay a non-blocking background warmup. The
// prerendered markup remains visible during this short wait; only interactivity
// waits, and it needs the same namespaces anyway.
const MOUNT_I18N_TIMEOUT_MS = 1500;

const warmShellI18nThenMount = async () => {
  if (typeof window !== 'undefined') {
    void preloadCriticalRouteModules(window.location.pathname);
    const locale = document.documentElement.lang || DEFAULT_LOCALE;
    try {
      await Promise.race([
        preloadLocaleNamespaces(locale, APP_SHELL_NAMESPACES),
        new Promise((resolve) => { window.setTimeout(resolve, MOUNT_I18N_TIMEOUT_MS); }),
      ]);
    } catch {
      // Ignore preload failures — mount anyway; i18n falls back to keys/default.
    }
  }
  mountReactRoot();
};

setupBootstrapShellHandoff(rootElement);
void warmShellI18nThenMount();
