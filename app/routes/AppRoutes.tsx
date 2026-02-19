import React, { Suspense, lazy, useLayoutEffect, useRef } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppLanguage, ITrip, IViewSettings } from '../../types';
import { useDbSync } from '../../hooks/useDbSync';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '../../config/locales';
import { loadLazyComponentWithRecovery } from '../../services/lazyImportRecovery';

const lazyWithRecovery = <TModule extends { default: React.ComponentType<any> },>(
    moduleKey: string,
    importer: () => Promise<TModule>
) => lazy(() => loadLazyComponentWithRecovery(moduleKey, importer));

const MarketingHomePage = lazyWithRecovery('MarketingHomePage', () => import('../../pages/MarketingHomePage').then((module) => ({ default: module.MarketingHomePage })));
const TripLoaderRoute = lazyWithRecovery('TripLoaderRoute', () => import('../../routes/TripRouteLoaders').then((module) => ({ default: module.TripLoaderRoute })));
const SharedTripLoaderRoute = lazyWithRecovery('SharedTripLoaderRoute', () => import('../../routes/TripRouteLoaders').then((module) => ({ default: module.SharedTripLoaderRoute })));
const ExampleTripLoaderRoute = lazyWithRecovery('ExampleTripLoaderRoute', () => import('../../routes/TripRouteLoaders').then((module) => ({ default: module.ExampleTripLoaderRoute })));
const CreateTripClassicLabPage = lazyWithRecovery('CreateTripClassicLabPage', () => import('../../pages/CreateTripClassicLabPage').then((module) => ({ default: module.CreateTripClassicLabPage })));
const DeferredAppRoutes = lazyWithRecovery('DeferredAppRoutes', () => import('./DeferredAppRoutes').then((module) => ({ default: module.DeferredAppRoutes })));

export const RouteLoadingFallback: React.FC = () => (
    <div className="min-h-[42vh] w-full bg-slate-50" aria-hidden="true" />
);

const renderWithSuspense = (node: React.ReactElement) => (
    <Suspense fallback={<RouteLoadingFallback />}>
        {node}
    </Suspense>
);

const LOCALIZED_TOOL_LOCALES: AppLanguage[] = SUPPORTED_LOCALES.filter((locale) => locale !== DEFAULT_LOCALE);

const ScrollToTop: React.FC = () => {
    const { pathname } = useLocation();
    const prevPathRef = useRef(pathname);

    useLayoutEffect(() => {
        if (prevPathRef.current === pathname) return;
        prevPathRef.current = pathname;
        window.scrollTo(0, 0);
    }, [pathname]);

    return null;
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

export interface AppRoutesProps {
    trip: ITrip | null;
    appLanguage: AppLanguage;
    onAppLanguageLoaded: (lang: AppLanguage) => void;
    onTripGenerated: (trip: ITrip) => void;
    onTripLoaded: (trip: ITrip) => void;
    onUpdateTrip: (updatedTrip: ITrip, options?: { persist?: boolean }) => void;
    onCommitState: (
        updatedTrip: ITrip,
        view: IViewSettings | undefined,
        options?: { replace?: boolean; label?: string; adminOverride?: boolean }
    ) => void;
    onViewSettingsChange: (settings: IViewSettings) => void;
    onOpenManager: () => void;
    onOpenSettings: () => void;
}

export const AppRoutes: React.FC<AppRoutesProps> = ({
    trip,
    appLanguage,
    onAppLanguageLoaded,
    onTripGenerated,
    onTripLoaded,
    onUpdateTrip,
    onCommitState,
    onViewSettingsChange,
    onOpenManager,
    onOpenSettings,
}) => {
    return (
        <>
            <ScrollToTop />
            <Routes>
                <Route
                    path="/"
                    element={renderWithSuspense(<MarketingHomePage />)}
                />
                <Route
                    path="/create-trip"
                    element={
                        renderWithSuspense(<CreateTripClassicRoute
                            onTripGenerated={onTripGenerated}
                            onOpenManager={onOpenManager}
                            onLanguageLoaded={onAppLanguageLoaded}
                        />)
                    }
                />
                {LOCALIZED_TOOL_LOCALES.map((locale) => (
                    <Route
                        key={`tool:${locale}:create-trip`}
                        path={`/${locale}/create-trip`}
                        element={
                            renderWithSuspense(<CreateTripClassicRoute
                                onTripGenerated={onTripGenerated}
                                onOpenManager={onOpenManager}
                                onLanguageLoaded={onAppLanguageLoaded}
                            />)
                        }
                    />
                ))}
                <Route
                    path="/trip/:tripId"
                    element={renderWithSuspense(
                        <TripLoaderRoute
                            trip={trip}
                            onTripLoaded={onTripLoaded}
                            onUpdateTrip={onUpdateTrip}
                            onCommitState={onCommitState}
                            onOpenManager={onOpenManager}
                            onOpenSettings={onOpenSettings}
                            appLanguage={appLanguage}
                            onViewSettingsChange={onViewSettingsChange}
                            onLanguageLoaded={onAppLanguageLoaded}
                        />
                    )}
                />
                <Route
                    path="/example/:templateId"
                    element={renderWithSuspense(
                        <ExampleTripLoaderRoute
                            trip={trip}
                            onTripLoaded={onTripLoaded}
                            onOpenManager={onOpenManager}
                            onOpenSettings={onOpenSettings}
                            appLanguage={appLanguage}
                            onViewSettingsChange={onViewSettingsChange}
                        />
                    )}
                />
                <Route
                    path="/s/:token"
                    element={renderWithSuspense(
                        <SharedTripLoaderRoute
                            trip={trip}
                            onTripLoaded={onTripLoaded}
                            onOpenManager={onOpenManager}
                            onOpenSettings={onOpenSettings}
                            appLanguage={appLanguage}
                            onViewSettingsChange={onViewSettingsChange}
                            onLanguageLoaded={onAppLanguageLoaded}
                        />
                    )}
                />
                <Route path="/trip" element={<Navigate to="/create-trip" replace />} />
                <Route
                    path="*"
                    element={renderWithSuspense(
                        <DeferredAppRoutes
                            onAppLanguageLoaded={onAppLanguageLoaded}
                            onTripGenerated={onTripGenerated}
                            onOpenManager={onOpenManager}
                        />
                    )}
                />
            </Routes>
        </>
    );
};
