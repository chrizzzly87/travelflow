import React, { Suspense, lazy, useLayoutEffect, useRef } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppLanguage, ITrip, IViewSettings } from '../../types';
import { useDbSync } from '../../hooks/useDbSync';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '../../config/locales';
import { loadLazyComponentWithRecovery } from '../../services/lazyImportRecovery';
import { TripRouteLoadingShell } from '../../components/tripview/TripRouteLoadingShell';

const lazyWithRecovery = <TModule extends { default: React.ComponentType<any> },>(
    moduleKey: string,
    importer: () => Promise<TModule>
) => lazy(() => loadLazyComponentWithRecovery(moduleKey, importer));

const TripLoaderRoute = lazyWithRecovery('TripLoaderRoute', () => import('../../routes/TripLoaderRoute').then((module) => ({ default: module.TripLoaderRoute })));
const SharedTripLoaderRoute = lazyWithRecovery('SharedTripLoaderRoute', () => import('../../routes/SharedTripLoaderRoute').then((module) => ({ default: module.SharedTripLoaderRoute })));
const ExampleTripLoaderRoute = lazyWithRecovery('ExampleTripLoaderRoute', () => import('../../routes/ExampleTripLoaderRoute').then((module) => ({ default: module.ExampleTripLoaderRoute })));
const CreateTripClassicLabPage = lazyWithRecovery('CreateTripClassicLabPage', () => import('../../pages/CreateTripClassicLabPage').then((module) => ({ default: module.CreateTripClassicLabPage })));
const CreateTripV3Page = lazyWithRecovery('CreateTripV3Page', () => import('../../pages/CreateTripV3Page').then((module) => ({ default: module.CreateTripV3Page })));
const DeferredAppRoutes = lazyWithRecovery('DeferredAppRoutes', () => import('./DeferredAppRoutes').then((module) => ({ default: module.DeferredAppRoutes })));

export const RouteLoadingFallback: React.FC = () => (
    <div className="min-h-screen w-full bg-white" aria-hidden="true" />
);

const renderWithSuspense = (
    node: React.ReactElement,
    fallback: React.ReactElement = <RouteLoadingFallback />
) => (
    <Suspense fallback={fallback}>
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

const CreateTripWizardRoute: React.FC<{
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
                    path="/create-trip/wizard"
                    element={
                        renderWithSuspense(<CreateTripWizardRoute
                            onTripGenerated={onTripGenerated}
                            onOpenManager={onOpenManager}
                            onLanguageLoaded={onAppLanguageLoaded}
                        />)
                    }
                />
                {LOCALIZED_TOOL_LOCALES.map((locale) => (
                    <Route
                        key={`tool:${locale}:create-trip-wizard`}
                        path={`/${locale}/create-trip/wizard`}
                        element={
                            renderWithSuspense(<CreateTripWizardRoute
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
                        />,
                        <TripRouteLoadingShell variant="loadingTrip" />
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
                        />,
                        <TripRouteLoadingShell variant="loadingExampleTrip" />
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
                        />,
                        <TripRouteLoadingShell variant="loadingSharedTrip" />
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
