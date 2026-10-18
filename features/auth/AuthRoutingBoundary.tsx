import React, { lazy, Suspense, useEffect, useRef } from 'react';
import { Navigate, useRouter } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { useLocation } from '../../app/navigation';
import { MarketingRouteLoadingShell } from '../../components/bootstrap/MarketingRouteLoadingShell';
import { buildLocalizedMarketingPath, extractLocaleFromPath, isToolRoute, stripLocalePrefix } from '../../config/routes';
import { normalizeLocale } from '../../config/locales';
import { useAccountLanguageSync } from './useAccountLanguageSync';
import { shouldRedirectToTermsAcceptance } from './termsPolicy';
import { shouldRevokeInactiveAccount } from './sessionPolicy';

const AccountTermsNotice = lazy(() => import('./AccountTermsNotice'));

/** Session changes invalidate native route guards; no second browser router or stale role cache. */
export function AuthRoutingBoundary({ children }: { children: React.ReactNode }) {
    const auth = useAuth();
    const router = useRouter();
    useAccountLanguageSync();
    const location = useLocation();
    const { i18n } = useTranslation('common');
    const identity = `${auth.isLoading}:${auth.access?.userId ?? ''}:${auth.access?.role ?? ''}:${auth.access?.accountStatus ?? ''}`;
    const previousIdentity = useRef(identity);
    useEffect(() => {
        if (identity === previousIdentity.current) return;
        previousIdentity.current = identity;
        if (!auth.isLoading) void router.invalidate();
    }, [identity, auth.isLoading, router]);
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
    if (isToolRoute(location.pathname) && auth.isLoading) return <MarketingRouteLoadingShell />;
    const hasTermsNotice = auth.isAuthenticated && !auth.access?.isAnonymous && (auth.access?.termsAcceptanceRequired || auth.access?.termsNoticeRequired);
    return <>{hasTermsNotice && <Suspense fallback={null}><AccountTermsNotice /></Suspense>}{children}</>;
}
