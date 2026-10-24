import React, { useCallback, useEffect } from 'react';
import { useNavigate } from '@/app/navigation';
import { useAuth } from '../hooks/useAuth';
import { DB_ENABLED } from '../config/db';
import { resolveTripExpiryFromEntitlements } from '../config/productLimits';
import { trackEvent } from '../services/analyticsService';
import { dbCanCreateTrip, dbCreateTripVersion, dbUpsertTrip } from '../services/dbApi';
import { saveTrip } from '../services/storageService';
import { buildCreateTripUrl, buildTripUrl, generateTripId } from '../utils';
import type { ITrip, IViewSettings } from '../types';
import type { ExampleTripLoaderRouteProps } from './tripRouteTypes';
import type { ExampleTripRouteData } from '../features/trips/routeData';
import { useRouteViewSettings } from '../features/trips/useRouteViewSettings';
import { useTripCopyLimit } from '../features/trips/useTripCopyLimit';
// The native route component chunk owns the complete required view.
import { TripView } from '../components/TripView';

export const ExampleTripLoaderRoute: React.FC<ExampleTripLoaderRouteProps & { data: ExampleTripRouteData }> = ({ data, trip, onTripLoaded, onOpenManager, onOpenSettings, appLanguage, onViewSettingsChange }) => {
    const navigate = useNavigate();
    const { access } = useAuth();
    const activeTrip = trip ?? data.trip;
    const { templateId, countries: templateCountries } = data;
    const templateCard = { title: data.templateTitle };
    const [viewSettings, updateViewSettings] = useRouteViewSettings(data.view);
    const handleTripLimitReached = useTripCopyLimit('example_trip');
    useEffect(() => { trackEvent('example_trip__open', { template: templateId, country_count: templateCountries.length }); }, [templateId, templateCountries.length]);
    const handleCopyExampleTrip = async () => {
        if (!activeTrip || !templateId) return;
        if (DB_ENABLED) {
            const limit = await dbCanCreateTrip();
            if (!limit.allowCreate) {
                await handleTripLimitReached(limit);
                return;
            }
        }
        const now = Date.now();
        const cloned: ITrip = {
            ...activeTrip,
            id: generateTripId(),
            createdAt: now,
            updatedAt: now,
            isFavorite: false,
            isExample: false,
            status: 'active',
            tripExpiresAt: resolveTripExpiryFromEntitlements(
                now,
                undefined,
                access?.entitlements.tripExpirationDays
            ),
            sourceKind: 'duplicate_trip',
            sourceTemplateId: templateId,
            sourceOwnerType: 'system_catalog',
            sourceOwnerHandle: 'travelflow_examples',
            exampleTemplateId: undefined,
            exampleTemplateCountries: undefined,
            forkedFromExampleTemplateId: templateId,
        };

        if (typeof window !== 'undefined') {
            try {
                window.sessionStorage.setItem('tf_trip_copy_notice', JSON.stringify({
                    tripId: cloned.id,
                    sourceTripId: activeTrip.id,
                    sourceTitle: activeTrip.title,
                    sourceShareToken: null,
                    sourceShareVersionId: null,
                    createdAt: Date.now(),
                }));
            } catch {
                // ignore storage issues
            }
        }

        saveTrip(cloned);
        trackEvent('example_trip__banner--copy_trip', {
            template: templateId,
            country_count: templateCountries.length,
        });

        if (DB_ENABLED) {
            await dbUpsertTrip(cloned, viewSettings);
            await dbCreateTripVersion(cloned, viewSettings, 'Data: Copied trip');
        }

        navigate(buildTripUrl(cloned.id));
    };

    const handleCreateSimilarTrip = () => {
        if (!templateId) return;
        const url = buildCreateTripUrl({
            countries: templateCountries,
            meta: {
                source: 'example_trip',
                label: templateCard?.title || 'Example trip',
                templateId,
            },
        });
        trackEvent('example_trip__banner--create_similar', {
            template: templateId,
            country_count: templateCountries.length,
        });
        navigate(url);
    };

    const handleRouteViewSettingsChange = useCallback((settings: IViewSettings) => {
        if (updateViewSettings(settings)) onViewSettingsChange(settings);
    }, [onViewSettingsChange, updateViewSettings]);
    return (
            <TripView
                trip={activeTrip}
                initialViewSettings={viewSettings ?? activeTrip.defaultView}
                onUpdateTrip={(updatedTrip) => onTripLoaded(updatedTrip, viewSettings ?? updatedTrip.defaultView)}
                onViewSettingsChange={handleRouteViewSettingsChange}
                onOpenManager={onOpenManager}
                onOpenSettings={onOpenSettings}
                appLanguage={appLanguage}
                canShare={false}
                onCopyTrip={handleCopyExampleTrip}
                isExamplePreview
                suppressToasts
                suppressReleaseNotice
                exampleTripBanner={{
                    title: templateCard?.title || activeTrip.title,
                    countries: templateCountries,
                    onCreateSimilarTrip: handleCreateSimilarTrip,
                }}
            />
    );
};
