import { isToolRoute, stripLocalePrefix } from '../../config/routes';

const TERMS_EXEMPT_PATHS = new Set([
    '/terms',
    '/privacy',
    '/cookies',
    '/imprint',
    '/login',
    '/auth/reset-password',
]);

export const shouldRedirectToTermsAcceptance = (options: {
    isAuthenticated: boolean;
    isAuthLoading: boolean;
    hasAccess: boolean;
    isAnonymous: boolean;
    isAdmin: boolean;
    termsAcceptanceRequired: boolean;
    pathname: string;
    search?: string;
}): boolean => {
    if (options.isAuthLoading) return false;
    if (!options.isAuthenticated || !options.hasAccess || options.isAnonymous) return false;
    if (!options.termsAcceptanceRequired) return false;

    const strippedPath = stripLocalePrefix(options.pathname);
    if (options.isAdmin && strippedPath.startsWith('/admin')) return false;
    if (TERMS_EXEMPT_PATHS.has(strippedPath)) return false;
    if (strippedPath === '/checkout') {
        const params = new URLSearchParams(options.search || '');
        if (params.get('signup_accept_terms') === '1') return false;
    }
    return isToolRoute(options.pathname);
};

export type TermsNoticeState = 'none' | 'force' | 'inform';

export const resolveTermsNoticeState = (options: {
    isAuthenticated: boolean;
    isAuthLoading: boolean;
    hasAccess: boolean;
    isAnonymous: boolean;
    termsAcceptanceRequired: boolean;
    termsNoticeRequired: boolean;
}): TermsNoticeState => {
    if (options.isAuthLoading) return 'none';
    if (!options.isAuthenticated || !options.hasAccess || options.isAnonymous) return 'none';
    if (options.termsAcceptanceRequired) return 'force';
    if (options.termsNoticeRequired) return 'inform';
    return 'none';
};
