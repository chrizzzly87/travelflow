import React, { useCallback } from 'react';
import { useParams } from '@/app/navigation';
import { useDbSync } from '../hooks/useDbSync';
import { DB_ENABLED } from '../config/db';
import { dbUpdateTripShareViewSettings } from '../services/dbApi';
import type { IViewSettings } from '../types';
import type { TripLoaderRouteProps } from './tripRouteTypes';
import type { TripRouteData } from '../features/trips/routeData';
import { useRouteViewSettings } from '../features/trips/useRouteViewSettings';
import { LazyTripView } from '../components/tripview/LazyTripView';
import { TripRouteLoadingShell } from '../components/tripview/TripRouteLoadingShell';
import { resolveTripInitialMapFocusQuery } from '../shared/tripMapCityResolution';

/** Presentation and view interactions only; the native route owns resolution and cancellation. */
export const TripLoaderRoute: React.FC<TripLoaderRouteProps & { data: TripRouteData }> = ({ data, trip, onUpdateTrip, onCommitState, onAdoptAgentTripVersion, onOpenManager, onOpenSettings, appLanguage, onViewSettingsChange, onLanguageLoaded }) => {
    const { tripId } = useParams();
    useDbSync(onLanguageLoaded);
    const activeTrip = trip ?? data.trip;
    const [viewSettings, updateViewSettings] = useRouteViewSettings(data.view);
    const tripAccess = data.access;
    const handleRouteViewSettingsChange = useCallback((settings: IViewSettings) => {
        if (!updateViewSettings(settings)) return;
        onViewSettingsChange(settings);
        if (!DB_ENABLED || !tripId || tripAccess?.source === 'public_read' || tripAccess?.source === 'admin_fallback') return;
        void dbUpdateTripShareViewSettings(tripId, settings).catch(() => undefined);
    }, [onViewSettingsChange, tripAccess?.source, tripId, updateViewSettings]);
    const adminFallbackAccess = tripAccess?.source === 'admin_fallback' ? tripAccess : undefined;
    const isPublicReadView = tripAccess?.source === 'public_read';
    return <React.Suspense fallback={<TripRouteLoadingShell variant="preparingPlanner" />}>
        <LazyTripView key={`${activeTrip.id}:${tripAccess?.source ?? 'local'}`} trip={activeTrip}
            initialMapFocusQuery={resolveTripInitialMapFocusQuery(activeTrip)} initialViewSettings={viewSettings ?? activeTrip.defaultView}
            onUpdateTrip={onUpdateTrip} onCommitState={onCommitState} onAdoptAgentTripVersion={onAdoptAgentTripVersion}
            onViewSettingsChange={handleRouteViewSettingsChange} onOpenManager={onOpenManager} onOpenSettings={onOpenSettings} appLanguage={appLanguage}
            readOnly={isPublicReadView} canShare={!adminFallbackAccess && !isPublicReadView} adminAccess={adminFallbackAccess} tripAccess={tripAccess ?? undefined} />
    </React.Suspense>;
};
