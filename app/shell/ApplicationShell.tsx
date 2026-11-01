import React, { lazy, Suspense } from 'react';
import { Outlet } from '@tanstack/react-router';
import { AppProviderShell } from '../bootstrap/AppProviderShell';
import { useAnalyticsBootstrap } from '../bootstrap/useAnalyticsBootstrap';
import { useAuthNavigationBootstrap } from '../bootstrap/useAuthNavigationBootstrap';
import { useNavigationContextBootstrap } from '../bootstrap/useNavigationContextBootstrap';
import { useTripsPrunedNoticeBootstrap } from '../bootstrap/useTripsPrunedNoticeBootstrap';
import { useDebuggerBootstrap } from '../bootstrap/useDebuggerBootstrap';
import { useWebMcpBootstrap } from '../bootstrap/useWebMcpBootstrap';
import { APP_NAME } from '../../config/appGlobals';
import { useAuth } from '../../hooks/useAuth';
import { InstallAppBanner } from '../../components/InstallAppBanner';
import { CookieConsentBanner } from '../../components/marketing/CookieConsentBanner';
import { GlobalTooltipLayer } from '../../components/GlobalTooltipLayer';
import { TripLibraryProvider } from './TripLibraryProvider';
import { RouteNavigationFeedback } from '../routing/RouteNavigationFeedback';
import { AuthRoutingBoundary } from '../../features/auth/AuthRoutingBoundary';

const AccountCapabilities = lazy(() => import('./AccountCapabilities'));
const OnPageDebugger = lazy(() => import('../../components/OnPageDebugger').then(module => ({ default: module.OnPageDebugger })));
function ApplicationRuntime() {
    useAnalyticsBootstrap();
    useAuthNavigationBootstrap();
    useNavigationContextBootstrap();
    useTripsPrunedNoticeBootstrap();
    useWebMcpBootstrap();
    const { isAuthenticated, isLoading, access } = useAuth();
    const showDebugger = useDebuggerBootstrap({ appName: APP_NAME, isDev: import.meta.env.DEV });
    return <TripLibraryProvider>
        <RouteNavigationFeedback authPending={isLoading} />
        <InstallAppBanner />
        <AuthRoutingBoundary><Outlet /></AuthRoutingBoundary>
        <CookieConsentBanner />
        <GlobalTooltipLayer />
        {!isLoading && isAuthenticated && access && !access.isAnonymous && <Suspense fallback={null}><AccountCapabilities /></Suspense>}
        {showDebugger && <Suspense fallback={null}><OnPageDebugger /></Suspense>}
    </TripLibraryProvider>;
}
/** Cross-cutting UI only. Planner and admin state live under their own route boundaries. */
export default function ApplicationShell() {
    return <AppProviderShell><ApplicationRuntime /></AppProviderShell>;
}
