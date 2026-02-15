import { useLoginModalContext } from '../contexts/LoginModalContext';
import {
    buildPathFromLocationParts,
    rememberAuthReturnPath,
    resolvePreferredNextPath,
} from '../services/authNavigationService';

const FALLBACK_MODAL_API = {
    isLoginModalOpen: false,
    openLoginModal: (options?: { nextPath?: string }) => {
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
        // no-op
    },
};

export const useLoginModal = () => {
    try {
        return useLoginModalContext();
    } catch {
        return FALLBACK_MODAL_API;
    }
};
