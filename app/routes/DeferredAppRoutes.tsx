import React, { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppLanguage, ITrip, IViewSettings } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { useDbSync } from '../../hooks/useDbSync';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '../../config/locales';
import { loadLazyComponentWithRecovery } from '../../services/lazyImportRecovery';
import { MarketingRouteLoadingShell } from '../../components/bootstrap/MarketingRouteLoadingShell';
import '../../styles/deferred-routes.css';
import { suspendUntilAuthBootstrapSettles } from '../../services/authBootstrapSuspense';
import { markInitialRouteHandoffCompleted } from '../../services/marketingRouteShellState';

const lazyWithRecovery = <TModule extends { default: React.ComponentType<any> },>(
    moduleKey: string,
    importer: () => Promise<TModule>
) => lazy(() => loadLazyComponentWithRecovery(moduleKey, importer));

const PublicProfilePage = lazyWithRecovery('PublicProfilePage', () => import('../../pages/PublicProfilePage').then((module) => ({ default: module.PublicProfilePage })));
const PublicProfileStampsPage = lazyWithRecovery('PublicProfileStampsPage', () => import('../../pages/PublicProfileStampsPage').then((module) => ({ default: module.PublicProfileStampsPage })));

const LoginPage = lazyWithRecovery('LoginPage', () => import('../../pages/LoginPage').then((module) => ({ default: module.LoginPage })));
const ResetPasswordPage = lazyWithRecovery('ResetPasswordPage', () => import('../../pages/ResetPasswordPage').then((module) => ({ default: module.ResetPasswordPage })));
const ProfilePage = lazyWithRecovery('ProfilePage', () => import('../../pages/ProfilePage').then((module) => ({ default: module.ProfilePage })));
const ProfileStampsPage = lazyWithRecovery('ProfileStampsPage', () => import('../../pages/ProfileStampsPage').then((module) => ({ default: module.ProfileStampsPage })));
const ProfileSettingsPage = lazyWithRecovery('ProfileSettingsPage', () => import('../../pages/ProfileSettingsPage').then((module) => ({ default: module.ProfileSettingsPage })));
const ProfileOnboardingPage = lazyWithRecovery('ProfileOnboardingPage', () => import('../../pages/ProfileOnboardingPage').then((module) => ({ default: module.ProfileOnboardingPage })));
const CheckoutPage = lazyWithRecovery('CheckoutPage', () => import('../../pages/CheckoutPage').then((module) => ({ default: module.CheckoutPage })));
const AdminAccessDeniedPage = lazyWithRecovery('AdminAccessDeniedPage', () => import('../../pages/AdminAccessDeniedPage').then((module) => ({ default: module.AdminAccessDeniedPage })));
const AdminWorkspaceRouter = lazyWithRecovery('AdminWorkspaceRouter', () => import('../../pages/AdminWorkspaceRouter').then((module) => ({ default: module.AdminWorkspaceRouter })));
const ShareUnavailablePage = lazyWithRecovery('ShareUnavailablePage', () => import('../../pages/ShareUnavailablePage').then((module) => ({ default: module.ShareUnavailablePage })));
const NotFoundPage = lazyWithRecovery('NotFoundPage', () => import('../../pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })));
const CreateTripClassicLabPage = lazyWithRecovery('CreateTripClassicLabPage', () => import('../../pages/CreateTripClassicLabPage').then((module) => ({ default: module.CreateTripClassicLabPage })));
const CreateTripV3Page = lazyWithRecovery('CreateTripV3Page', () => import('../../pages/CreateTripV3Page').then((module) => ({ default: module.CreateTripV3Page })));

const RouteLoadingFallback: React.FC = () => (
    <MarketingRouteLoadingShell />
);

const HandoffReadyBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    useEffect(() => {
        markInitialRouteHandoffCompleted();
    }, []);

    return (
        <div data-tf-handoff-ready="true">
            {children}
        </div>
    );
};

const renderWithHandoff = (node: React.ReactElement) => (
    <HandoffReadyBoundary>{node}</HandoffReadyBoundary>
);

const LOCALIZED_APP_LOCALES: AppLanguage[] = SUPPORTED_LOCALES.filter((locale) => locale !== DEFAULT_LOCALE);

const APP_MARKETING_ROUTE_CONFIGS: Array<{ path: string; element: React.ReactElement }> = [
    { path: '/share-unavailable', element: <ShareUnavailablePage /> },
    { path: '/login', element: <LoginPage /> },
    { path: '/auth/reset-password', element: <ResetPasswordPage /> },
];

const getLocalizedAppRoutePath = (path: string, locale: AppLanguage): string => {
    if (path === '/') return `/${locale}`;
    return `/${locale}${path}`;
};

const AstroMarketingDocumentRoute: React.FC = () => {
    const location = useLocation();
    const target = `${location.pathname}${location.search}${location.hash}`;

    useEffect(() => {
        window.location.assign(target);
    }, [target]);

    return <RouteLoadingFallback />;
};

const CreateTripClassicRoute: React.FC<{
    onTripGenerated: (t: ITrip) => void;
    onOpenManager: () => void;
    onLanguageLoaded?: (lang: AppLanguage) => void;
}> = ({ onTripGenerated, onOpenManager, onLanguageLoaded }) => {
    useDbSync(onLanguageLoaded);
    return (
        <CreateTripClassicLabPage
            onTripGenerated={onTripGenerated}
            onOpenManager={onOpenManager}
            onLanguageLoaded={onLanguageLoaded}
        />
    );
};

const CreateTripWizardRoute: React.FC<{
    onTripGenerated: (t: ITrip) => void;
    onOpenManager: () => void;
    onLanguageLoaded?: (lang: AppLanguage) => void;
}> = ({ onTripGenerated, onOpenManager, onLanguageLoaded }) => {
    useDbSync(onLanguageLoaded);
    return (
        <CreateTripV3Page onTripGenerated={onTripGenerated} onOpenManager={onOpenManager} />
    );
};

const AuthenticatedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
    const { isLoading, isAuthenticated } = useAuth();
    const location = useLocation();

    suspendUntilAuthBootstrapSettles(isLoading);
    if (!isAuthenticated) {
        return (
            <Navigate
                to="/login"
                replace
                state={{ from: `${location.pathname}${location.search}` }}
            />
        );
    }

    return children;
};

const AdminRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
    const { isLoading, isAdmin, isAuthenticated } = useAuth();
    const location = useLocation();

    suspendUntilAuthBootstrapSettles(isLoading);
    if (!isAuthenticated) {
        return (
            <Navigate
                to="/login"
                replace
                state={{ from: `${location.pathname}${location.search}` }}
            />
        );
    }
    if (!isAdmin) {
        return (
            <Navigate
                to="/admin/access-denied"
                replace
                state={{ from: `${location.pathname}${location.search}` }}
            />
        );
    }

    return children;
};

export interface DeferredAppRoutesProps {
    wrapInSuspense?: boolean;
    onAppLanguageLoaded: (lang: AppLanguage) => void;
    onTripGenerated: (trip: ITrip) => void;
    onOpenManager: () => void;
}

export const DeferredAppRoutes: React.FC<DeferredAppRoutesProps> = ({
    wrapInSuspense = true,
    onAppLanguageLoaded,
    onTripGenerated,
    onOpenManager,
}) => {
    const routes = (
        <Routes>
            {APP_MARKETING_ROUTE_CONFIGS.map(({ path, element }) => (
                <Route
                    key={`app-marketing:${path}`}
                    path={path}
                    element={renderWithHandoff(element)}
                />
            ))}
            {LOCALIZED_APP_LOCALES.flatMap((locale) =>
                APP_MARKETING_ROUTE_CONFIGS.map(({ path, element }) => (
                    <Route
                        key={`app-marketing:${locale}:${path}`}
                        path={getLocalizedAppRoutePath(path, locale)}
                        element={renderWithHandoff(element)}
                    />
                ))
            )}
            <Route path="/" element={renderWithHandoff(<AstroMarketingDocumentRoute />)} />
            {LOCALIZED_APP_LOCALES.map((locale) => (
                <Route
                    key={`astro-marketing:${locale}:home`}
                    path={`/${locale}`}
                    element={renderWithHandoff(<AstroMarketingDocumentRoute />)}
                />
            ))}
            <Route path="/features" element={renderWithHandoff(<AstroMarketingDocumentRoute />)} />
            <Route path="/inspirations/*" element={renderWithHandoff(<AstroMarketingDocumentRoute />)} />
            <Route path="/updates" element={renderWithHandoff(<AstroMarketingDocumentRoute />)} />
            <Route path="/blog/*" element={renderWithHandoff(<AstroMarketingDocumentRoute />)} />
            <Route path="/pricing" element={renderWithHandoff(<AstroMarketingDocumentRoute />)} />
            <Route path="/faq" element={renderWithHandoff(<AstroMarketingDocumentRoute />)} />
            <Route path="/contact" element={renderWithHandoff(<AstroMarketingDocumentRoute />)} />
            <Route path="/imprint" element={renderWithHandoff(<AstroMarketingDocumentRoute />)} />
            <Route path="/privacy" element={renderWithHandoff(<AstroMarketingDocumentRoute />)} />
            <Route path="/terms" element={renderWithHandoff(<AstroMarketingDocumentRoute />)} />
            <Route path="/cookies" element={renderWithHandoff(<AstroMarketingDocumentRoute />)} />
            {LOCALIZED_APP_LOCALES.flatMap((locale) => [
                <Route key={`astro-marketing:${locale}:features`} path={`/${locale}/features`} element={renderWithHandoff(<AstroMarketingDocumentRoute />)} />,
                <Route key={`astro-marketing:${locale}:inspirations`} path={`/${locale}/inspirations/*`} element={renderWithHandoff(<AstroMarketingDocumentRoute />)} />,
                <Route key={`astro-marketing:${locale}:updates`} path={`/${locale}/updates`} element={renderWithHandoff(<AstroMarketingDocumentRoute />)} />,
                <Route key={`astro-marketing:${locale}:blog`} path={`/${locale}/blog/*`} element={renderWithHandoff(<AstroMarketingDocumentRoute />)} />,
                <Route key={`astro-marketing:${locale}:pricing`} path={`/${locale}/pricing`} element={renderWithHandoff(<AstroMarketingDocumentRoute />)} />,
                <Route key={`astro-marketing:${locale}:faq`} path={`/${locale}/faq`} element={renderWithHandoff(<AstroMarketingDocumentRoute />)} />,
                <Route key={`astro-marketing:${locale}:contact`} path={`/${locale}/contact`} element={renderWithHandoff(<AstroMarketingDocumentRoute />)} />,
                <Route key={`astro-marketing:${locale}:imprint`} path={`/${locale}/imprint`} element={renderWithHandoff(<AstroMarketingDocumentRoute />)} />,
                <Route key={`astro-marketing:${locale}:privacy`} path={`/${locale}/privacy`} element={renderWithHandoff(<AstroMarketingDocumentRoute />)} />,
                <Route key={`astro-marketing:${locale}:terms`} path={`/${locale}/terms`} element={renderWithHandoff(<AstroMarketingDocumentRoute />)} />,
                <Route key={`astro-marketing:${locale}:cookies`} path={`/${locale}/cookies`} element={renderWithHandoff(<AstroMarketingDocumentRoute />)} />,
            ])}

            <Route
                path="/create-trip/labs/classic-card"
                element={
                    renderWithHandoff(<CreateTripClassicRoute
                        onTripGenerated={onTripGenerated}
                        onOpenManager={onOpenManager}
                        onLanguageLoaded={onAppLanguageLoaded}
                    />)
                }
            />
            <Route
                path="/create-trip/wizard"
                element={
                    renderWithHandoff(<CreateTripWizardRoute
                        onTripGenerated={onTripGenerated}
                        onOpenManager={onOpenManager}
                        onLanguageLoaded={onAppLanguageLoaded}
                    />)
                }
            />
            <Route path="/create-trip/labs/classic-legacy" element={<Navigate to="/create-trip" replace />} />
            <Route path="/create-trip/labs/split-workspace" element={<Navigate to="/create-trip" replace />} />
            <Route path="/create-trip/labs/journey-architect" element={<Navigate to="/create-trip" replace />} />
            <Route path="/create-trip/labs/design-v1" element={<Navigate to="/create-trip" replace />} />
            <Route path="/create-trip/labs/design-v2" element={<Navigate to="/create-trip" replace />} />
            <Route path="/create-trip/labs/design-v3" element={<Navigate to="/create-trip/wizard" replace />} />
            <Route path="/create-trip/v1" element={<Navigate to="/create-trip" replace />} />
            <Route path="/create-trip/v2" element={<Navigate to="/create-trip" replace />} />
            <Route path="/create-trip/v3" element={<Navigate to="/create-trip/wizard" replace />} />

            <Route
                path="/checkout"
                element={renderWithHandoff(<CheckoutPage />)}
            />
            <Route
                path="/profile/onboarding"
                element={renderWithHandoff(
                    <AuthenticatedRoute>
                        <ProfileOnboardingPage />
                    </AuthenticatedRoute>
                )}
            />
            <Route
                path="/profile"
                element={renderWithHandoff(
                    <AuthenticatedRoute>
                        <ProfilePage />
                    </AuthenticatedRoute>
                )}
            />
            <Route
                path="/profile/stamps"
                element={renderWithHandoff(
                    <AuthenticatedRoute>
                        <ProfileStampsPage />
                    </AuthenticatedRoute>
                )}
            />
            <Route
                path="/profile/settings"
                element={renderWithHandoff(
                    <AuthenticatedRoute>
                        <ProfileSettingsPage />
                    </AuthenticatedRoute>
                )}
            />
            <Route
                path="/u/:username"
                element={renderWithHandoff(<PublicProfilePage />)}
            />
            <Route
                path="/u/:username/stamps"
                element={renderWithHandoff(<PublicProfileStampsPage />)}
            />
            <Route
                path="/admin/access-denied"
                element={renderWithHandoff(
                    <AuthenticatedRoute>
                        <AdminAccessDeniedPage />
                    </AuthenticatedRoute>
                )}
            />
            <Route
                path="/admin/*"
                element={renderWithHandoff(
                    <AdminRoute>
                        <AdminWorkspaceRouter />
                    </AdminRoute>
                )}
            />
            <Route path="*" element={renderWithHandoff(<NotFoundPage />)} />
        </Routes>
    );

    if (!wrapInSuspense) {
        return routes;
    }

    return (
        <Suspense fallback={<RouteLoadingFallback />}>
            {routes}
        </Suspense>
    );
};
