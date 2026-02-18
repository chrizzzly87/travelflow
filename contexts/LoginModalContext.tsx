import React, { createContext, Suspense, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { trackEvent } from '../services/analyticsService';
import {
    buildPathFromLocationParts,
    clearPendingAuthRedirect,
    getPendingAuthRedirect,
    isSafeAuthReturnPath,
    rememberAuthReturnPath,
    resolvePreferredNextPath,
    setPendingAuthRedirect,
} from '../services/authNavigationService';
import { consumePendingOAuthProvider, setLastUsedOAuthProvider } from '../services/authUiPreferencesService';

interface OpenLoginModalOptions {
    nextPath?: string;
    source?: string;
    reloadOnSuccess?: boolean;
}

interface LoginModalContextValue {
    isLoginModalOpen: boolean;
    openLoginModal: (options?: OpenLoginModalOptions) => void;
    closeLoginModal: () => void;
}

interface LoginModalState {
    isOpen: boolean;
    source: string;
    nextPath: string;
    reloadOnSuccess: boolean;
}

const DEFAULT_MODAL_STATE: LoginModalState = {
    isOpen: false,
    source: 'unknown',
    nextPath: '/create-trip',
    reloadOnSuccess: true,
};

const LoginModalContext = createContext<LoginModalContextValue | null>(null);

const AuthModal = React.lazy(() => import('../components/auth/AuthModal').then((module) => ({
    default: module.AuthModal,
})));

export const LoginModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { isAuthenticated, isAnonymous, isLoading } = useAuth();
    const [state, setState] = useState<LoginModalState>(DEFAULT_MODAL_STATE);

    const closeLoginModal = useCallback((reason?: 'dismiss' | 'backdrop' | 'escape' | 'success') => {
        setState((previous) => ({ ...previous, isOpen: false }));
        if (reason && reason !== 'success') {
            clearPendingAuthRedirect();
        }
    }, []);

    const openLoginModal = useCallback((options?: OpenLoginModalOptions) => {
        const currentPath = buildPathFromLocationParts({
            pathname: location.pathname,
            search: location.search,
            hash: location.hash,
        });
        const nextPath = resolvePreferredNextPath(options?.nextPath, currentPath);
        rememberAuthReturnPath(nextPath);
        setPendingAuthRedirect(nextPath, options?.source || 'unknown');
        setState({
            isOpen: true,
            source: options?.source || 'unknown',
            nextPath,
            reloadOnSuccess: options?.reloadOnSuccess ?? true,
        });
    }, [location.hash, location.pathname, location.search]);

    useEffect(() => {
        if (isLoading || !isAuthenticated || isAnonymous) return;
        const completedProvider = consumePendingOAuthProvider();
        if (completedProvider) {
            setLastUsedOAuthProvider(completedProvider);
        }

        const pending = getPendingAuthRedirect();
        if (!pending) return;

        const currentPath = buildPathFromLocationParts({
            pathname: location.pathname,
            search: location.search,
            hash: location.hash,
        });

        if (!isSafeAuthReturnPath(pending.nextPath)) {
            clearPendingAuthRedirect();
            return;
        }

        clearPendingAuthRedirect();
        trackEvent('auth__redirect--resume', {
            source: pending.source,
            next_path: pending.nextPath,
            current_path: currentPath,
        });

        if (pending.nextPath === currentPath) return;
        navigate(pending.nextPath, { replace: true });
    }, [isAnonymous, isAuthenticated, isLoading, location.hash, location.pathname, location.search, navigate]);

    const value = useMemo<LoginModalContextValue>(() => ({
        isLoginModalOpen: state.isOpen,
        openLoginModal,
        closeLoginModal,
    }), [closeLoginModal, openLoginModal, state.isOpen]);

    return (
        <LoginModalContext.Provider value={value}>
            {children}
            <Suspense fallback={null}>
                <AuthModal
                    isOpen={state.isOpen}
                    source={state.source}
                    nextPath={state.nextPath}
                    reloadOnSuccess={state.reloadOnSuccess}
                    onClose={(reason) => {
                        closeLoginModal(reason);
                    }}
                />
            </Suspense>
        </LoginModalContext.Provider>
    );
};

export const useLoginModalContext = (): LoginModalContextValue => {
    const context = useContext(LoginModalContext);
    if (context) return context;

    // Defensive fallback: keep auth usable even if a render path misses the provider.
    return {
        isLoginModalOpen: false,
        openLoginModal: (options) => {
            if (typeof window === 'undefined') return;
            const currentPath = buildPathFromLocationParts({
                pathname: window.location.pathname,
                search: window.location.search,
                hash: window.location.hash,
            });
            const nextPath = resolvePreferredNextPath(options?.nextPath, currentPath);
            rememberAuthReturnPath(nextPath);
            const loginUrl = new URL('/login', window.location.origin);
            loginUrl.searchParams.set('next', nextPath);
            window.location.assign(loginUrl.toString());
        },
        closeLoginModal: () => {
            // no-op outside provider
        },
    };
};
