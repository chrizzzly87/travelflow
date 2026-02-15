import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AuthModal } from '../components/auth/AuthModal';
import { buildPathFromLocationParts, rememberAuthReturnPath, resolvePreferredNextPath } from '../services/authNavigationService';

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

export const LoginModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const location = useLocation();
    const [state, setState] = useState<LoginModalState>(DEFAULT_MODAL_STATE);

    const closeLoginModal = useCallback(() => {
        setState((previous) => ({ ...previous, isOpen: false }));
    }, []);

    const openLoginModal = useCallback((options?: OpenLoginModalOptions) => {
        const currentPath = buildPathFromLocationParts({
            pathname: location.pathname,
            search: location.search,
            hash: location.hash,
        });
        const nextPath = resolvePreferredNextPath(options?.nextPath, currentPath);
        rememberAuthReturnPath(nextPath);
        setState({
            isOpen: true,
            source: options?.source || 'unknown',
            nextPath,
            reloadOnSuccess: options?.reloadOnSuccess ?? true,
        });
    }, [location.hash, location.pathname, location.search]);

    const value = useMemo<LoginModalContextValue>(() => ({
        isLoginModalOpen: state.isOpen,
        openLoginModal,
        closeLoginModal,
    }), [closeLoginModal, openLoginModal, state.isOpen]);

    return (
        <LoginModalContext.Provider value={value}>
            {children}
            <AuthModal
                isOpen={state.isOpen}
                source={state.source}
                nextPath={state.nextPath}
                reloadOnSuccess={state.reloadOnSuccess}
                onClose={() => {
                    closeLoginModal();
                }}
            />
        </LoginModalContext.Provider>
    );
};

export const useLoginModalContext = (): LoginModalContextValue => {
    const context = useContext(LoginModalContext);
    if (!context) {
        throw new Error('useLoginModalContext must be used within LoginModalProvider.');
    }
    return context;
};

