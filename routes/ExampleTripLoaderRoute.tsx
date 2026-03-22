import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Check } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';

import { useAppDialog } from '../components/AppDialogProvider';
import { useAuth } from '../hooks/useAuth';
import { PLAN_CATALOG } from '../config/planCatalog';
import { DB_ENABLED } from '../config/db';
import { resolveTripExpiryFromEntitlements } from '../config/productLimits';
import { trackEvent } from '../services/analyticsService';
import { buildBillingCheckoutPath } from '../services/billingService';
import {
    dbCanCreateTrip,
    dbCreateTripVersion,
    dbUpsertTrip,
} from '../services/dbApi';
import { saveTrip } from '../services/storageService';
import {
    buildCreateTripUrl,
    generateTripId,
} from '../utils';
import { buildTripWorkspacePath, DEFAULT_TRIP_WORKSPACE_PAGE } from '../shared/tripWorkspace';
import type { ITrip, IViewSettings } from '../types';
import type { ExampleTripLoaderRouteProps } from './tripRouteTypes';
import { LazyTripView } from '../components/tripview/LazyTripView';
import { TripRouteLoadingShell } from '../components/tripview/TripRouteLoadingShell';

const areViewSettingsEqual = (a?: IViewSettings, b?: IViewSettings): boolean => {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return (
        a.layoutMode === b.layoutMode
        && a.timelineMode === b.timelineMode
        && a.timelineView === b.timelineView
        && a.activeCompanionSection === b.activeCompanionSection
        && a.workspaceCountryCode === b.workspaceCountryCode
        && a.workspaceCityGuideId === b.workspaceCityGuideId
        && a.mapDockMode === b.mapDockMode
        && a.mapStyle === b.mapStyle
        && a.routeMode === b.routeMode
        && a.showCityNames === b.showCityNames
        && a.zoomLevel === b.zoomLevel
        && a.zoomBehavior === b.zoomBehavior
        && a.sidebarWidth === b.sidebarWidth
        && a.detailsWidth === b.detailsWidth
        && a.timelineHeight === b.timelineHeight
    );
};

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
    const { confirm: confirmDialog } = useAppDialog();
    const { t } = useTranslation(['common', 'pricing']);
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
                activeCompanionSection: generated.defaultView?.activeCompanionSection,
                workspaceCountryCode: generated.defaultView?.workspaceCountryCode,
                workspaceCityGuideId: generated.defaultView?.workspaceCityGuideId,
                mapStyle: generated.defaultView?.mapStyle ?? 'standard',
                zoomLevel: generated.defaultView?.zoomLevel ?? 1,
                routeMode: generated.defaultView?.routeMode,
                showCityNames: generated.defaultView?.showCityNames,
                sidebarWidth: generated.defaultView?.sidebarWidth,
                detailsWidth: generated.defaultView?.detailsWidth,
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

    const resolveTierHighlights = useCallback((tierKey: 'tier_mid' | 'tier_premium') => {
        const tier = PLAN_CATALOG[tierKey];
        const unlimitedLabel = t('shared.unlimited', { ns: 'pricing' });
        const noExpiryLabel = t('shared.noExpiry', { ns: 'pricing' });
        const enabledLabel = t('shared.enabled', { ns: 'pricing' });
        const disabledLabel = t('shared.disabled', { ns: 'pricing' });
        const interpolationValues = {
            maxActiveTripsLabel: tier.entitlements.maxActiveTrips === null
                ? unlimitedLabel
                : String(tier.entitlements.maxActiveTrips),
            maxTotalTripsLabel: tier.entitlements.maxTotalTrips === null
                ? unlimitedLabel
                : String(tier.entitlements.maxTotalTrips),
            tripExpirationLabel: tier.entitlements.tripExpirationDays === null
                ? noExpiryLabel
                : t('shared.days', { ns: 'pricing', count: tier.entitlements.tripExpirationDays }),
            sharingLabel: tier.entitlements.canShare ? enabledLabel : disabledLabel,
            editableSharesLabel: tier.entitlements.canCreateEditableShares ? enabledLabel : disabledLabel,
            proCreationLabel: tier.entitlements.canCreateProTrips ? enabledLabel : disabledLabel,
        };
        return [0, 2, 4].map((index) => t(`tiers.${tier.publicSlug}.features.${index}`, {
            ns: 'pricing',
            ...interpolationValues,
        }));
    }, [t]);

    const handleTripLimitReached = useCallback(async (limit: { activeTripCount: number; maxTripCount: number }) => {
        const currentTierKey = access?.tierKey === 'tier_mid' || access?.tierKey === 'tier_premium'
            ? access.tierKey
            : 'tier_free';
        const upgradeTierKey = currentTierKey === 'tier_mid' ? 'tier_premium' : 'tier_mid';
        const currentTier = PLAN_CATALOG[currentTierKey];
        const upgradeTier = PLAN_CATALOG[upgradeTierKey];
        const currentPath = `${location.pathname}${location.search}${location.hash}`;

        trackEvent('trip_limit__dialog--view', {
            source: 'example_trip',
            current_tier: currentTierKey,
            target_tier: upgradeTierKey,
            active_trip_count: limit.activeTripCount,
            max_trip_count: limit.maxTripCount,
        });

        const shouldUpgrade = await confirmDialog({
            title: `${currentTier.publicName} -> ${upgradeTier.publicName}`,
            message: (
                <div className="space-y-3">
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="flex items-end justify-between gap-3">
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                                    {currentTier.publicName}
                                </p>
                                <p className="mt-1 text-sm font-semibold text-slate-900">
                                    {limit.activeTripCount} / {limit.maxTripCount}
                                </p>
                            </div>
                            <div className="text-right text-sm text-slate-500">
                                ${currentTier.monthlyPriceUsd}{t('shared.perMonth', { ns: 'pricing' })}
                            </div>
                        </div>
                    </div>
                    <div className="rounded-xl border border-accent-200 bg-accent-50/70 p-4">
                        <div className="flex items-end justify-between gap-3">
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-700">
                                    {upgradeTier.publicName}
                                </p>
                                <p className="mt-1 text-sm font-semibold text-slate-900">
                                    ${upgradeTier.monthlyPriceUsd}{t('shared.perMonth', { ns: 'pricing' })}
                                </p>
                            </div>
                        </div>
                        <ul className="mt-3 space-y-2">
                            {resolveTierHighlights(upgradeTierKey).map((feature) => (
                                <li key={feature} className="flex items-start gap-2 text-sm leading-6 text-slate-700">
                                    <Check size={14} weight="bold" className="mt-1 shrink-0 text-accent-600" />
                                    <span>{feature}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            ),
            confirmLabel: t(`tiers.${upgradeTier.publicSlug}.cta`, { ns: 'pricing' }),
            cancelLabel: t('buttons.done', { ns: 'common' }),
        });

        if (!shouldUpgrade) {
            trackEvent('trip_limit__dialog--dismiss', {
                source: 'example_trip',
                current_tier: currentTierKey,
                target_tier: upgradeTierKey,
            });
            return;
        }

        trackEvent('trip_limit__dialog--upgrade', {
            source: 'example_trip',
            current_tier: currentTierKey,
            target_tier: upgradeTierKey,
        });

        navigate(buildBillingCheckoutPath({
            tierKey: upgradeTierKey,
            source: 'example_trip_limit_dialog',
            returnTo: currentPath,
        }));
    }, [access?.tierKey, confirmDialog, location.hash, location.pathname, location.search, navigate, resolveTierHighlights, t]);

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

        navigate(buildTripWorkspacePath(`/trip/${encodeURIComponent(cloned.id)}`, DEFAULT_TRIP_WORKSPACE_PAGE));
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
        if (areViewSettingsEqual(viewSettings, settings)) return;
        setViewSettings((previous) => {
            if (areViewSettingsEqual(previous, settings)) return previous;
            return settings;
        });
        onViewSettingsChange(settings);
    }, [onViewSettingsChange, viewSettings]);

    if (!activeTrip || !activeTrip.isExample) {
        return <TripRouteLoadingShell variant="loadingExampleTrip" />;
    }

    return (
        <React.Suspense fallback={<TripRouteLoadingShell variant="preparingExamplePlanner" />}>
            <LazyTripView
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
        </React.Suspense>
    );
};
