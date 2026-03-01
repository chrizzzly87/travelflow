import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import { DB_ENABLED } from '../config/db';
import { ANONYMOUS_TRIP_EXPIRATION_DAYS, buildTripExpiryIso } from '../config/productLimits';
import { trackEvent } from '../services/analyticsService';
import {
    dbCanCreateTrip,
    dbCreateTripVersion,
    dbUpsertTrip,
} from '../services/dbApi';
import { saveTrip } from '../services/storageService';
import {
    buildCreateTripUrl,
    buildTripUrl,
    generateTripId,
} from '../utils';
import type { ITrip, IViewSettings } from '../types';
import type { ExampleTripLoaderRouteProps } from './tripRouteTypes';
import { TripView } from '../components/TripView';

type ExampleTemplateFactory = (createdAtIso: string) => ITrip;
type ExampleTripCardSummary = {
    title: string;
    countries: { name: string }[];
};

interface ExampleTemplateResourcesState {
    templateFactory: ExampleTemplateFactory | null | undefined;
    templateCard: ExampleTripCardSummary | null;
}

type ExampleTripPrefetchState = {
    useExampleSharedTransition?: boolean;
    prefetchedExampleTrip?: ITrip;
    prefetchedExampleView?: IViewSettings;
    prefetchedTemplateTitle?: string;
    prefetchedTemplateCountries?: string[];
};

export const ExampleTripLoaderRoute: React.FC<ExampleTripLoaderRouteProps> = ({
    trip,
    onTripLoaded,
    onOpenManager,
    onOpenSettings,
    appLanguage,
    onViewSettingsChange,
}) => {
    const { templateId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { access } = useAuth();
    const [viewSettings, setViewSettings] = useState<IViewSettings | undefined>(undefined);
    const trackedTemplateRef = useRef<string | null>(null);
    const hydratedTemplateRef = useRef<string | null>(null);
    const prefetchedState = location.state as ExampleTripPrefetchState | null;
    const prefetchedTrip = useMemo<ITrip | null>(() => {
        if (!templateId) return null;
        const candidate = prefetchedState?.prefetchedExampleTrip;
        if (!candidate) return null;
        if (!candidate.isExample) return null;
        if (candidate.exampleTemplateId !== templateId) return null;
        return candidate;
    }, [prefetchedState, templateId]);
    const prefetchedView = useMemo<IViewSettings | undefined>(() => {
        if (!prefetchedTrip) return undefined;
        return prefetchedState?.prefetchedExampleView ?? prefetchedTrip.defaultView;
    }, [prefetchedState, prefetchedTrip]);
    const prefetchedTemplateCard = useMemo<ExampleTripCardSummary | null>(() => {
        if (!prefetchedTrip) return null;
        const names = prefetchedState?.prefetchedTemplateCountries
            || prefetchedTrip.exampleTemplateCountries
            || [];
        return {
            title: prefetchedState?.prefetchedTemplateTitle || prefetchedTrip.title,
            countries: names.map((name) => ({ name })),
        };
    }, [prefetchedState, prefetchedTrip]);
    const [templateResources, setTemplateResources] = useState<ExampleTemplateResourcesState>(() => ({
        templateFactory: undefined,
        templateCard: prefetchedTemplateCard,
    }));
    const { templateFactory, templateCard } = templateResources;
    const applyTemplateResources = useCallback((next: ExampleTemplateResourcesState) => {
        setTemplateResources(next);
    }, []);
    const markTemplateFactoryLoading = useCallback(() => {
        setTemplateResources((prev) => ({
            ...prev,
            templateFactory: undefined,
        }));
    }, []);

    const resolveTripExpiry = (createdAtMs: number, existingTripExpiry?: string | null): string | null => {
        if (typeof existingTripExpiry === 'string' && existingTripExpiry) return existingTripExpiry;
        const expirationDays = access?.entitlements.tripExpirationDays;
        if (expirationDays === null) return null;
        if (typeof expirationDays === 'number' && expirationDays > 0) {
            return buildTripExpiryIso(createdAtMs, expirationDays);
        }
        return buildTripExpiryIso(createdAtMs, ANONYMOUS_TRIP_EXPIRATION_DAYS);
    };

    useEffect(() => {
        if (!templateId) {
            applyTemplateResources({
                templateFactory: null,
                templateCard: prefetchedTemplateCard ?? null,
            });
            return;
        }

        let cancelled = false;
        markTemplateFactoryLoading();

        const loadTemplateResources = async () => {
            try {
                const { getExampleTemplateSummary, loadExampleTemplateFactory } = await import('../data/exampleTripTemplates/runtimeFactory');
                if (cancelled) return;
                const nextFactory = await loadExampleTemplateFactory(templateId);
                if (cancelled) return;
                const summary = getExampleTemplateSummary(templateId);
                applyTemplateResources({
                    templateFactory: nextFactory,
                    templateCard: (summary as ExampleTripCardSummary | undefined) ?? prefetchedTemplateCard ?? null,
                });
            } catch {
                if (cancelled) return;
                applyTemplateResources({
                    templateFactory: null,
                    templateCard: prefetchedTemplateCard ?? null,
                });
            }
        };

        void loadTemplateResources();

        return () => {
            cancelled = true;
        };
    }, [applyTemplateResources, markTemplateFactoryLoading, prefetchedTemplateCard, templateId]);

    const templateCountries = useMemo(
        () => templateCard?.countries?.map((country) => country.name).filter(Boolean)
            || prefetchedTrip?.exampleTemplateCountries
            || [],
        [templateCard, prefetchedTrip]
    );

    useEffect(() => {
        if (!templateId) {
            navigate('/', { replace: true });
            return;
        }

        const hasActiveExampleTrip =
            !!trip &&
            trip.isExample === true &&
            trip.exampleTemplateId === templateId;
        const hasHydratedTemplate = hydratedTemplateRef.current === templateId;
        const shouldHydrateTrip = !hasHydratedTemplate || !hasActiveExampleTrip;

        if (shouldHydrateTrip && prefetchedTrip) {
            const resolvedView = prefetchedView ?? prefetchedTrip.defaultView;
            setViewSettings(resolvedView);
            onTripLoaded(prefetchedTrip, resolvedView);
            hydratedTemplateRef.current = templateId;
        } else if (shouldHydrateTrip) {
            if (templateFactory === undefined) return;
            if (typeof templateFactory !== 'function') {
                navigate('/', { replace: true });
                return;
            }

            const nowMs = Date.now();
            const generated = templateFactory(new Date(nowMs).toISOString());
            const resolvedView: IViewSettings = {
                layoutMode: generated.defaultView?.layoutMode ?? 'horizontal',
                timelineView: generated.defaultView?.timelineView ?? 'horizontal',
                mapStyle: generated.defaultView?.mapStyle ?? 'standard',
                zoomLevel: generated.defaultView?.zoomLevel ?? 1,
                routeMode: generated.defaultView?.routeMode,
                showCityNames: generated.defaultView?.showCityNames,
                sidebarWidth: generated.defaultView?.sidebarWidth,
                timelineHeight: generated.defaultView?.timelineHeight,
            };
            const prepared: ITrip = {
                ...generated,
                createdAt: nowMs,
                updatedAt: nowMs,
                isFavorite: false,
                isExample: true,
                exampleTemplateId: templateId,
                exampleTemplateCountries: templateCountries,
                sourceKind: 'example',
                sourceOwnerType: 'system_catalog',
                sourceOwnerHandle: 'travelflow_examples',
                defaultView: resolvedView,
            };

            setViewSettings(resolvedView);
            onTripLoaded(prepared, resolvedView);
            hydratedTemplateRef.current = templateId;
        }

        if (trackedTemplateRef.current !== templateId) {
            trackedTemplateRef.current = templateId;
            trackEvent('example_trip__open', {
                template: templateId,
                country_count: templateCountries.length,
            });
        }
    }, [templateCountries, templateFactory, templateId, trip, prefetchedTrip, prefetchedView, navigate, onTripLoaded]);

    const activeTrip = useMemo(() => {
        if (trip?.isExample && trip.exampleTemplateId === templateId) {
            return trip;
        }
        return prefetchedTrip;
    }, [templateId, trip, prefetchedTrip]);

    const handleCopyExampleTrip = async () => {
        if (!activeTrip || !templateId) return;
        if (DB_ENABLED) {
            const limit = await dbCanCreateTrip();
            if (!limit.allowCreate) {
                window.alert(`Trip limit reached (${limit.activeTripCount}/${limit.maxTripCount}). Archive a trip or upgrade to continue.`);
                navigate('/pricing');
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
            tripExpiresAt: resolveTripExpiry(now),
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

    if (!activeTrip || !activeTrip.isExample) return null;

    return (
        <TripView
            trip={activeTrip}
            initialViewSettings={viewSettings ?? activeTrip.defaultView}
            onUpdateTrip={(updatedTrip) => onTripLoaded(updatedTrip, viewSettings ?? updatedTrip.defaultView)}
            onViewSettingsChange={(settings) => {
                setViewSettings(settings);
                onViewSettingsChange(settings);
            }}
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
