import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { useLocation } from '../../app/navigation';
import { MarketingRouteLoadingShell } from '../../components/bootstrap/MarketingRouteLoadingShell';
import { buildLocalizedMarketingPath, extractLocaleFromPath, isToolRoute, stripLocalePrefix } from '../../config/routes';
import { normalizeLocale } from '../../config/locales';
import { useAccountLanguageSync } from './useAccountLanguageSync';
import { shouldRedirectToTermsAcceptance } from './termsPolicy';
import { useSessionRouteLifecycle } from './useSessionRouteLifecycle';
import { shouldRevokeInactiveAccount } from './sessionPolicy';

const AccountTermsNotice = lazy(() => import('./AccountTermsNotice'));

/** Session changes invalidate native route guards; no second browser router or stale role cache. */
export function AuthRoutingBoundary({ children }: { children: React.ReactNode }) {
    const auth = useAuth();
    // Initial discovery has no presented session to revoke. Keep the native
    // selective-SSR boundaries intact until the first auth result settles.
    const [hasSettledAuth, setHasSettledAuth] = useState(!auth.isLoading);
    if (!auth.isLoading && !hasSettledAuth) setHasSettledAuth(true);
    useSessionRouteLifecycle(auth);
    useAccountLanguageSync();
    const location = useLocation();
    // Privacy/loading follows the presented workspace, not the requested URL.
    // A still-loading example click must not replace the current public page.
    const hasPresentedTool = useRouterState({ select: state => {
        const match = state.matches.at(-1);
        // Pending/selective-SSR matches have not presented a workspace yet.
        // Preserve their native hydration boundaries instead of replacing them.
        return match?.status === 'success' && isToolRoute(match.pathname);
    } });
    const { i18n } = useTranslation('common');
    const hasInactiveAccount = shouldRevokeInactiveAccount(auth);
    useEffect(() => {
        if (hasInactiveAccount) void auth.logout().catch(() => { /* Local access is already revoked by logout. */ });
    }, [hasInactiveAccount, auth.logout]);
    const strippedPath = stripLocalePrefix(location.pathname);
    if (hasInactiveAccount) {
        if (strippedPath !== '/login' && strippedPath !== '/auth/reset-password') {
            const locale = extractLocaleFromPath(location.pathname) ?? normalizeLocale(i18n.resolvedLanguage ?? i18n.language);
            return <Navigate to="/{-$locale}/login" params={{ locale: locale === 'en' ? undefined : locale }} replace />;
        }
        // Do not mount login's authenticated redirect until local revocation settles.
        return <MarketingRouteLoadingShell />;
    }
    const requiresTerms = shouldRedirectToTermsAcceptance({
        isAuthenticated: auth.isAuthenticated, isAuthLoading: auth.isLoading, hasAccess: Boolean(auth.access),
        isAnonymous: Boolean(auth.access?.isAnonymous), isAdmin: auth.access?.role === 'admin',
        termsAcceptanceRequired: Boolean(auth.access?.termsAcceptanceRequired), pathname: location.pathname, search: location.search,
    });
    if (requiresTerms) {
        const locale = extractLocaleFromPath(location.pathname) ?? normalizeLocale(i18n.resolvedLanguage ?? i18n.language);
        const next = `${location.pathname}${location.search}${location.hash}`;
        return <Navigate to="/{-$locale}/terms" params={{ locale: locale === 'en' ? undefined : locale }} search={previous => ({ ...previous, accept: 'required', next })} replace />;
    }
    if (hasSettledAuth && hasPresentedTool && auth.isLoading) return <MarketingRouteLoadingShell />;
    const hasTermsNotice = auth.isAuthenticated && !auth.access?.isAnonymous && (auth.access?.termsAcceptanceRequired || auth.access?.termsNoticeRequired);
    return <>{hasTermsNotice && <Suspense fallback={null}><AccountTermsNotice /></Suspense>}{children}</>;
}
