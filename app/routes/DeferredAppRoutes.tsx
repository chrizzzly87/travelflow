import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppLanguage, ITrip, IViewSettings } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { useDbSync } from '../../hooks/useDbSync';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '../../config/locales';
import { loadLazyComponentWithRecovery } from '../../services/lazyImportRecovery';
import '../../styles/deferred-routes.css';

const lazyWithRecovery = <TModule extends { default: React.ComponentType<any> },>(
    moduleKey: string,
    importer: () => Promise<TModule>
) => lazy(() => loadLazyComponentWithRecovery(moduleKey, importer));

const MarketingHomePage = lazyWithRecovery('MarketingHomePage', () => import('../../pages/MarketingHomePage').then((module) => ({ default: module.MarketingHomePage })));
const FeaturesPage = lazyWithRecovery('FeaturesPage', () => import('../../pages/FeaturesPage').then((module) => ({ default: module.FeaturesPage })));
const UpdatesPage = lazyWithRecovery('UpdatesPage', () => import('../../pages/UpdatesPage').then((module) => ({ default: module.UpdatesPage })));
const BlogPage = lazyWithRecovery('BlogPage', () => import('../../pages/BlogPage').then((module) => ({ default: module.BlogPage })));
const BlogPostPage = lazyWithRecovery('BlogPostPage', () => import('../../pages/BlogPostPage').then((module) => ({ default: module.BlogPostPage })));
const InspirationsPage = lazyWithRecovery('InspirationsPage', () => import('../../pages/InspirationsPage').then((module) => ({ default: module.InspirationsPage })));
const ThemesPage = lazyWithRecovery('ThemesPage', () => import('../../pages/inspirations/ThemesPage').then((module) => ({ default: module.ThemesPage })));
const BestTimeToTravelPage = lazyWithRecovery('BestTimeToTravelPage', () => import('../../pages/inspirations/BestTimeToTravelPage').then((module) => ({ default: module.BestTimeToTravelPage })));
const CountriesPage = lazyWithRecovery('CountriesPage', () => import('../../pages/inspirations/CountriesPage').then((module) => ({ default: module.CountriesPage })));
const FestivalsPage = lazyWithRecovery('FestivalsPage', () => import('../../pages/inspirations/FestivalsPage').then((module) => ({ default: module.FestivalsPage })));
const WeekendGetawaysPage = lazyWithRecovery('WeekendGetawaysPage', () => import('../../pages/inspirations/WeekendGetawaysPage').then((module) => ({ default: module.WeekendGetawaysPage })));
const CountryDetailPage = lazyWithRecovery('CountryDetailPage', () => import('../../pages/inspirations/CountryDetailPage').then((module) => ({ default: module.CountryDetailPage })));
const LoginPage = lazyWithRecovery('LoginPage', () => import('../../pages/LoginPage').then((module) => ({ default: module.LoginPage })));
const ResetPasswordPage = lazyWithRecovery('ResetPasswordPage', () => import('../../pages/ResetPasswordPage').then((module) => ({ default: module.ResetPasswordPage })));
const ContactPage = lazyWithRecovery('ContactPage', () => import('../../pages/ContactPage').then((module) => ({ default: module.ContactPage })));
const ImprintPage = lazyWithRecovery('ImprintPage', () => import('../../pages/ImprintPage').then((module) => ({ default: module.ImprintPage })));
const PrivacyPage = lazyWithRecovery('PrivacyPage', () => import('../../pages/PrivacyPage').then((module) => ({ default: module.PrivacyPage })));
const TermsPage = lazyWithRecovery('TermsPage', () => import('../../pages/TermsPage').then((module) => ({ default: module.TermsPage })));
const CookiesPage = lazyWithRecovery('CookiesPage', () => import('../../pages/CookiesPage').then((module) => ({ default: module.CookiesPage })));
const ProfilePage = lazyWithRecovery('ProfilePage', () => import('../../pages/ProfilePage').then((module) => ({ default: module.ProfilePage })));
const ProfileStampsPage = lazyWithRecovery('ProfileStampsPage', () => import('../../pages/ProfileStampsPage').then((module) => ({ default: module.ProfileStampsPage })));
const PublicProfilePage = lazyWithRecovery('PublicProfilePage', () => import('../../pages/PublicProfilePage').then((module) => ({ default: module.PublicProfilePage })));
const PublicProfileStampsPage = lazyWithRecovery('PublicProfileStampsPage', () => import('../../pages/PublicProfileStampsPage').then((module) => ({ default: module.PublicProfileStampsPage })));
const ProfileSettingsPage = lazyWithRecovery('ProfileSettingsPage', () => import('../../pages/ProfileSettingsPage').then((module) => ({ default: module.ProfileSettingsPage })));
const ProfileOnboardingPage = lazyWithRecovery('ProfileOnboardingPage', () => import('../../pages/ProfileOnboardingPage').then((module) => ({ default: module.ProfileOnboardingPage })));
const AdminAccessDeniedPage = lazyWithRecovery('AdminAccessDeniedPage', () => import('../../pages/AdminAccessDeniedPage').then((module) => ({ default: module.AdminAccessDeniedPage })));
const AdminWorkspaceRouter = lazyWithRecovery('AdminWorkspaceRouter', () => import('../../pages/AdminWorkspaceRouter').then((module) => ({ default: module.AdminWorkspaceRouter })));
const PricingPage = lazyWithRecovery('PricingPage', () => import('../../pages/PricingPage').then((module) => ({ default: module.PricingPage })));
const FaqPage = lazyWithRecovery('FaqPage', () => import('../../pages/FaqPage').then((module) => ({ default: module.FaqPage })));
const ShareUnavailablePage = lazyWithRecovery('ShareUnavailablePage', () => import('../../pages/ShareUnavailablePage').then((module) => ({ default: module.ShareUnavailablePage })));
const NotFoundPage = lazyWithRecovery('NotFoundPage', () => import('../../pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })));
const CreateTripForm = lazyWithRecovery('CreateTripForm', () => import('../../components/CreateTripForm').then((module) => ({ default: module.CreateTripForm })));
const CreateTripClassicLabPage = lazyWithRecovery('CreateTripClassicLabPage', () => import('../../pages/CreateTripClassicLabPage').then((module) => ({ default: module.CreateTripClassicLabPage })));
const CreateTripSplitWorkspaceLabPage = lazyWithRecovery('CreateTripSplitWorkspaceLabPage', () => import('../../pages/CreateTripSplitWorkspaceLabPage').then((module) => ({ default: module.CreateTripSplitWorkspaceLabPage })));
const CreateTripJourneyArchitectLabPage = lazyWithRecovery('CreateTripJourneyArchitectLabPage', () => import('../../pages/CreateTripJourneyArchitectLabPage').then((module) => ({ default: module.CreateTripJourneyArchitectLabPage })));
const CreateTripV1Page = lazyWithRecovery('CreateTripV1Page', () => import('../../pages/CreateTripV1Page').then((module) => ({ default: module.CreateTripV1Page })));
const CreateTripV2Page = lazyWithRecovery('CreateTripV2Page', () => import('../../pages/CreateTripV2Page').then((module) => ({ default: module.CreateTripV2Page })));
const CreateTripV3Page = lazyWithRecovery('CreateTripV3Page', () => import('../../pages/CreateTripV3Page').then((module) => ({ default: module.CreateTripV3Page })));

const RouteLoadingFallback: React.FC = () => (
    <div className="min-h-[42vh] w-full bg-slate-50" aria-hidden="true" />
);

const renderWithSuspense = (node: React.ReactElement) => (
    <Suspense fallback={<RouteLoadingFallback />}>
        {node}
    </Suspense>
);

const AuthenticatedMarketingHomeRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
    const { isLoading, isAuthenticated } = useAuth();

    if (isLoading) return <RouteLoadingFallback />;
    if (isAuthenticated) {
        return <Navigate to="/profile" replace />;
    }
    return children;
};

const wrapMarketingRouteElement = (path: string, element: React.ReactElement): React.ReactElement => {
    if (path !== '/') return element;
    return (
        <AuthenticatedMarketingHomeRoute>
            {element}
        </AuthenticatedMarketingHomeRoute>
    );
};

const LOCALIZED_MARKETING_LOCALES: AppLanguage[] = SUPPORTED_LOCALES.filter((locale) => locale !== DEFAULT_LOCALE);

const MARKETING_ROUTE_CONFIGS: Array<{ path: string; element: React.ReactElement }> = [
    { path: '/', element: <MarketingHomePage /> },
    { path: '/features', element: <FeaturesPage /> },
    { path: '/inspirations', element: <InspirationsPage /> },
    { path: '/inspirations/themes', element: <ThemesPage /> },
    { path: '/inspirations/best-time-to-travel', element: <BestTimeToTravelPage /> },
    { path: '/inspirations/countries', element: <CountriesPage /> },
    { path: '/inspirations/events-and-festivals', element: <FestivalsPage /> },
    { path: '/inspirations/weekend-getaways', element: <WeekendGetawaysPage /> },
    { path: '/inspirations/country/:countryName', element: <CountryDetailPage /> },
    { path: '/updates', element: <UpdatesPage /> },
    { path: '/blog', element: <BlogPage /> },
    { path: '/blog/:slug', element: <BlogPostPage /> },
    { path: '/pricing', element: <PricingPage /> },
    { path: '/faq', element: <FaqPage /> },
    { path: '/share-unavailable', element: <ShareUnavailablePage /> },
    { path: '/login', element: <LoginPage /> },
    { path: '/auth/reset-password', element: <ResetPasswordPage /> },
    { path: '/contact', element: <ContactPage /> },
    { path: '/imprint', element: <ImprintPage /> },
    { path: '/privacy', element: <PrivacyPage /> },
    { path: '/terms', element: <TermsPage /> },
    { path: '/cookies', element: <CookiesPage /> },
];

const getLocalizedMarketingRoutePath = (path: string, locale: AppLanguage): string => {
    if (path === '/') return `/${locale}`;
    return `/${locale}${path}`;
};

const CreateTripClassicRoute: React.FC<{
    onTripGenerated: (t: ITrip) => void;
    onOpenManager: () => void;
    onLanguageLoaded?: (lang: AppLanguage) => void;
}> = ({ onTripGenerated, onOpenManager, onLanguageLoaded }) => {
    useDbSync(onLanguageLoaded);
    return (
        <Suspense fallback={<RouteLoadingFallback />}>
            <CreateTripClassicLabPage
                onTripGenerated={onTripGenerated}
                onOpenManager={onOpenManager}
                onLanguageLoaded={onLanguageLoaded}
            />
        </Suspense>
    );
};

const CreateTripLegacyRoute: React.FC<{
    onTripGenerated: (t: ITrip) => void;
    onOpenManager: () => void;
    onLanguageLoaded?: (lang: AppLanguage) => void;
}> = ({ onTripGenerated, onOpenManager, onLanguageLoaded }) => {
    useDbSync(onLanguageLoaded);
    return (
        <Suspense fallback={<RouteLoadingFallback />}>
            <CreateTripForm onTripGenerated={onTripGenerated} onOpenManager={onOpenManager} />
        </Suspense>
    );
};

const CreateTripDesignV1Route: React.FC<{
    onTripGenerated: (t: ITrip) => void;
    onOpenManager: () => void;
    onLanguageLoaded?: (lang: AppLanguage) => void;
}> = ({ onTripGenerated, onOpenManager, onLanguageLoaded }) => {
    useDbSync(onLanguageLoaded);
    return (
        <Suspense fallback={<RouteLoadingFallback />}>
            <CreateTripV1Page onTripGenerated={onTripGenerated} onOpenManager={onOpenManager} />
        </Suspense>
    );
};

const CreateTripDesignV2Route: React.FC<{
    onTripGenerated: (t: ITrip) => void;
    onOpenManager: () => void;
    onLanguageLoaded?: (lang: AppLanguage) => void;
}> = ({ onTripGenerated, onOpenManager, onLanguageLoaded }) => {
    useDbSync(onLanguageLoaded);
    return (
        <Suspense fallback={<RouteLoadingFallback />}>
            <CreateTripV2Page onTripGenerated={onTripGenerated} onOpenManager={onOpenManager} />
        </Suspense>
    );
};

const CreateTripDesignV3Route: React.FC<{
    onTripGenerated: (t: ITrip) => void;
    onOpenManager: () => void;
    onLanguageLoaded?: (lang: AppLanguage) => void;
}> = ({ onTripGenerated, onOpenManager, onLanguageLoaded }) => {
    useDbSync(onLanguageLoaded);
    return (
        <Suspense fallback={<RouteLoadingFallback />}>
            <CreateTripV3Page onTripGenerated={onTripGenerated} onOpenManager={onOpenManager} />
        </Suspense>
    );
};

const AuthenticatedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
    const { isLoading, isAuthenticated } = useAuth();
    const location = useLocation();

    if (isLoading) return <RouteLoadingFallback />;
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

    if (isLoading) return <RouteLoadingFallback />;
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
    onAppLanguageLoaded: (lang: AppLanguage) => void;
    onTripGenerated: (trip: ITrip) => void;
    onOpenManager: () => void;
}

export const DeferredAppRoutes: React.FC<DeferredAppRoutesProps> = ({
    onAppLanguageLoaded,
    onTripGenerated,
    onOpenManager,
}) => {
    return (
        <Routes>
            {MARKETING_ROUTE_CONFIGS.map(({ path, element }) => (
                <Route
                    key={`marketing:${path}`}
                    path={path}
                    element={renderWithSuspense(wrapMarketingRouteElement(path, element))}
                />
            ))}
            {LOCALIZED_MARKETING_LOCALES.flatMap((locale) =>
                MARKETING_ROUTE_CONFIGS.map(({ path, element }) => (
                    <Route
                        key={`marketing:${locale}:${path}`}
                        path={getLocalizedMarketingRoutePath(path, locale)}
                        element={renderWithSuspense(wrapMarketingRouteElement(path, element))}
                    />
                ))
            )}

            <Route
                path="/create-trip/labs/classic-card"
                element={
                    renderWithSuspense(<CreateTripClassicRoute
                        onTripGenerated={onTripGenerated}
                        onOpenManager={onOpenManager}
                        onLanguageLoaded={onAppLanguageLoaded}
                    />)
                }
            />
            <Route
                path="/create-trip/labs/classic-legacy"
                element={
                    renderWithSuspense(<CreateTripLegacyRoute
                        onTripGenerated={onTripGenerated}
                        onOpenManager={onOpenManager}
                        onLanguageLoaded={onAppLanguageLoaded}
                    />)
                }
            />
            <Route
                path="/create-trip/labs/split-workspace"
                element={
                    renderWithSuspense(<CreateTripSplitWorkspaceLabPage
                        onOpenManager={onOpenManager}
                        onLanguageLoaded={onAppLanguageLoaded}
                    />)
                }
            />
            <Route
                path="/create-trip/labs/journey-architect"
                element={
                    renderWithSuspense(<CreateTripJourneyArchitectLabPage
                        onOpenManager={onOpenManager}
                        onLanguageLoaded={onAppLanguageLoaded}
                    />)
                }
            />
            <Route
                path="/create-trip/labs/design-v1"
                element={
                    renderWithSuspense(<CreateTripDesignV1Route
                        onTripGenerated={onTripGenerated}
                        onOpenManager={onOpenManager}
                        onLanguageLoaded={onAppLanguageLoaded}
                    />)
                }
            />
            <Route
                path="/create-trip/labs/design-v2"
                element={
                    renderWithSuspense(<CreateTripDesignV2Route
                        onTripGenerated={onTripGenerated}
                        onOpenManager={onOpenManager}
                        onLanguageLoaded={onAppLanguageLoaded}
                    />)
                }
            />
            <Route
                path="/create-trip/labs/design-v3"
                element={
                    renderWithSuspense(<CreateTripDesignV3Route
                        onTripGenerated={onTripGenerated}
                        onOpenManager={onOpenManager}
                        onLanguageLoaded={onAppLanguageLoaded}
                    />)
                }
            />
            <Route
                path="/create-trip/v1"
                element={
                    renderWithSuspense(<CreateTripDesignV1Route
                        onTripGenerated={onTripGenerated}
                        onOpenManager={onOpenManager}
                        onLanguageLoaded={onAppLanguageLoaded}
                    />)
                }
            />
            <Route
                path="/create-trip/v2"
                element={
                    renderWithSuspense(<CreateTripDesignV2Route
                        onTripGenerated={onTripGenerated}
                        onOpenManager={onOpenManager}
                        onLanguageLoaded={onAppLanguageLoaded}
                    />)
                }
            />
            <Route
                path="/create-trip/v3"
                element={
                    renderWithSuspense(<CreateTripDesignV3Route
                        onTripGenerated={onTripGenerated}
                        onOpenManager={onOpenManager}
                        onLanguageLoaded={onAppLanguageLoaded}
                    />)
                }
            />

            <Route
                path="/profile/onboarding"
                element={renderWithSuspense(
                    <AuthenticatedRoute>
                        <ProfileOnboardingPage />
                    </AuthenticatedRoute>
                )}
            />
            <Route
                path="/profile"
                element={renderWithSuspense(
                    <AuthenticatedRoute>
                        <ProfilePage />
                    </AuthenticatedRoute>
                )}
            />
            <Route
                path="/profile/stamps"
                element={renderWithSuspense(
                    <AuthenticatedRoute>
                        <ProfileStampsPage />
                    </AuthenticatedRoute>
                )}
            />
            <Route
                path="/profile/settings"
                element={renderWithSuspense(
                    <AuthenticatedRoute>
                        <ProfileSettingsPage />
                    </AuthenticatedRoute>
                )}
            />
            <Route
                path="/u/:username"
                element={renderWithSuspense(<PublicProfilePage />)}
            />
            <Route
                path="/u/:username/stamps"
                element={renderWithSuspense(<PublicProfileStampsPage />)}
            />
            <Route
                path="/admin/access-denied"
                element={renderWithSuspense(
                    <AuthenticatedRoute>
                        <AdminAccessDeniedPage />
                    </AuthenticatedRoute>
                )}
            />
            <Route
                path="/admin/*"
                element={renderWithSuspense(
                    <AdminRoute>
                        <AdminWorkspaceRouter />
                    </AdminRoute>
                )}
            />
            <Route path="*" element={renderWithSuspense(<NotFoundPage />)} />
        </Routes>
    );
};
