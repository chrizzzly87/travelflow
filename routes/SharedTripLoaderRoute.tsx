import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Check } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';

import { useAppDialog } from '../components/AppDialogProvider';
import { useAuth } from '../hooks/useAuth';
import { useDbSync } from '../hooks/useDbSync';
import { useConnectivityStatus } from '../hooks/useConnectivityStatus';
import { PLAN_CATALOG } from '../config/planCatalog';
import { DB_ENABLED } from '../config/db';
import { resolveTripExpiryFromEntitlements } from '../config/productLimits';
import { getTripLifecycleState } from '../config/paywall';
import { trackEvent } from '../services/analyticsService';
import { buildBillingCheckoutPath } from '../services/billingService';
import {
    dbCanCreateTrip,
    dbCreateTripVersion,
    dbGetSharedTrip,
    dbGetSharedTripVersion,
    dbGetTripVersion,
    dbUpdateSharedTrip,
    dbUpsertTrip,
} from '../services/dbApi';
import { appendHistoryEntry, findHistoryEntryByUrl } from '../services/historyService';
import { saveTrip } from '../services/storageService';
import {
    buildShareUrl,
    buildTripUrl,
    generateTripId,
    generateVersionId,
    isUuid,
} from '../utils';
import { buildTripWorkspacePath, DEFAULT_TRIP_WORKSPACE_PAGE } from '../shared/tripWorkspace';
import { buildPathFromLocationParts } from '../services/authNavigationService';
import type { ITrip, IViewSettings } from '../types';
import type { CommitOptions, SharedTripLoaderRouteProps } from './tripRouteTypes';
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

type SharedTripSnapshotState = { hasNewer: boolean; latestUrl: string } | null;

interface SharedTripRouteState {
    shareMode: 'view' | 'edit';
    allowCopy: boolean;
    viewSettings: IViewSettings | undefined;
    snapshotState: SharedTripSnapshotState;
    sourceShareVersionId: string | null;
}

const createInitialSharedTripRouteState = (): SharedTripRouteState => ({
    shareMode: 'view',
    allowCopy: true,
    viewSettings: undefined,
    snapshotState: null,
    sourceShareVersionId: null,
});

const createLocalHistoryEntry = (
    navigate: ReturnType<typeof useNavigate>,
    updatedTrip: ITrip,
    view: IViewSettings | undefined,
    label: string,
    options?: { replace?: boolean },
    ts?: number,
    baseUrlOverride?: string
) => {
    const versionId = generateVersionId();
    const url = baseUrlOverride ? `${baseUrlOverride}?v=${versionId}` : buildTripUrl(updatedTrip.id, versionId);
    navigate(url, { replace: options?.replace ?? false });
    appendHistoryEntry(updatedTrip.id, url, label, { snapshot: { trip: updatedTrip, view }, ts });
    return url;
};

export const SharedTripLoaderRoute: React.FC<SharedTripLoaderRouteProps> = ({
    trip,
    onTripLoaded,
    onOpenManager,
    onOpenSettings,
    appLanguage,
    onViewSettingsChange,
    onLanguageLoaded,
}) => {
    const { confirm: confirmDialog } = useAppDialog();
    const { t } = useTranslation(['common', 'pricing']);
    const { token } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { access } = useAuth();
    const { snapshot: connectivitySnapshot } = useConnectivityStatus();
    const lastLoadRef = useRef<string | null>(null);
    const lastRouteTargetRef = useRef<string | null>(null);
    const latestViewSettingsRef = useRef<IViewSettings | undefined>(undefined);
    const hasInSessionViewOverrideRef = useRef(false);
    const [routeState, setRouteState] = useState<SharedTripRouteState>(() => createInitialSharedTripRouteState());
    const {
        shareMode,
        allowCopy,
        viewSettings,
        snapshotState,
        sourceShareVersionId,
    } = routeState;
    const resetRouteState = useCallback((options?: { preserveViewSettings?: boolean }) => {
        setRouteState((prev) => ({
            ...prev,
            viewSettings: options?.preserveViewSettings ? prev.viewSettings : undefined,
            snapshotState: null,
            sourceShareVersionId: null,
        }));
    }, []);
    const applyRouteState = useCallback((next: SharedTripRouteState) => {
        setRouteState(next);
    }, []);

    useEffect(() => {
        latestViewSettingsRef.current = viewSettings;
    }, [viewSettings]);

    const versionId = useMemo(() => {
        const params = new URLSearchParams(location.search);
        return params.get('v');
    }, [location.search]);

    useDbSync(onLanguageLoaded);

    useEffect(() => {
        if (!token) return;
        const loadKey = `${token}:${location.search}:${connectivitySnapshot.state}`;
        if (lastLoadRef.current === loadKey) return;
        lastLoadRef.current = loadKey;
        const routeTargetKey = `${token}:${versionId || ''}`;
        const didRouteTargetChange = lastRouteTargetRef.current !== routeTargetKey;
        lastRouteTargetRef.current = routeTargetKey;

        const load = async () => {
            const connectivityState = connectivitySnapshot.state;
            if (!DB_ENABLED) {
                navigate('/share-unavailable', { replace: true });
                return;
            }

            if (connectivityState === 'offline') {
                navigate('/share-unavailable?reason=offline', { replace: true });
                return;
            }

            // Keep in-session view choices while reconnecting on the same shared
            // route target so delayed loader refreshes do not override controls.
            resetRouteState({ preserveViewSettings: !didRouteTargetChange });
            if (didRouteTargetChange) {
                latestViewSettingsRef.current = undefined;
                hasInSessionViewOverrideRef.current = false;
            }

            const resolveEffectiveView = (resolvedView?: IViewSettings, fallbackView?: IViewSettings) => {
                if (!didRouteTargetChange && hasInSessionViewOverrideRef.current) {
                    return latestViewSettingsRef.current ?? resolvedView ?? fallbackView;
                }
                return resolvedView ?? fallbackView;
            };
            const shared = await dbGetSharedTrip(token);
            if (!shared) {
                if (connectivityState !== 'online') {
                    navigate('/share-unavailable?reason=offline', { replace: true });
                    return;
                }
                navigate('/share-unavailable', { replace: true });
                return;
            }
            if (getTripLifecycleState(shared.trip) !== 'active') {
                navigate('/share-unavailable', { replace: true });
                return;
            }

            const baseRouteState: SharedTripRouteState = {
                shareMode: shared.mode,
                allowCopy: shared.allowCopy ?? true,
                viewSettings: undefined,
                snapshotState: null,
                sourceShareVersionId: null,
            };

            if (versionId && isUuid(versionId)) {
                const sharedVersion = await dbGetSharedTripVersion(token, versionId);
                if (sharedVersion?.trip) {
                    const resolvedView = resolveEffectiveView(
                        sharedVersion.view ?? sharedVersion.shareView ?? shared.shareView,
                        sharedVersion.trip.defaultView,
                    );
                    const latestVersionId = sharedVersion.latestVersionId ?? shared.latestVersionId ?? null;
                    const nextState: SharedTripRouteState = {
                        ...baseRouteState,
                        viewSettings: resolvedView,
                        sourceShareVersionId: sharedVersion.versionId,
                        snapshotState: {
                            hasNewer: Boolean(latestVersionId && latestVersionId !== sharedVersion.versionId),
                            latestUrl: buildShareUrl(token),
                        },
                    };
                    applyRouteState(nextState);
                    onTripLoaded(sharedVersion.trip, resolvedView);
                    return;
                }

                const version = await dbGetTripVersion(shared.trip.id, versionId);
                if (version?.trip) {
                    const latestVersionMismatch = Boolean(shared.latestVersionId && shared.latestVersionId !== versionId);
                    const sharedUpdatedAt = typeof shared.trip.updatedAt === 'number' ? shared.trip.updatedAt : null;
                    const snapshotUpdatedAt = typeof version.trip.updatedAt === 'number' ? version.trip.updatedAt : null;
                    const newerByTimestamp = sharedUpdatedAt !== null && snapshotUpdatedAt !== null && sharedUpdatedAt > snapshotUpdatedAt;
                    const resolvedView = resolveEffectiveView(version.view ?? shared.shareView, version.trip.defaultView);
                    const nextState: SharedTripRouteState = {
                        ...baseRouteState,
                        viewSettings: resolvedView,
                        sourceShareVersionId: versionId,
                        snapshotState: {
                            hasNewer: latestVersionMismatch || newerByTimestamp,
                            latestUrl: buildShareUrl(token),
                        },
                    };
                    applyRouteState(nextState);
                    onTripLoaded(version.trip, resolvedView);
                    return;
                }
            }

            if (versionId) {
                const localEntry = findHistoryEntryByUrl(shared.trip.id, buildPathFromLocationParts({
                    pathname: location.pathname,
                    search: location.search,
                    hash: '',
                }));
                if (localEntry?.snapshot?.trip) {
                    const resolvedView = resolveEffectiveView(localEntry.snapshot.view, localEntry.snapshot.trip.defaultView);
                    const nextState: SharedTripRouteState = {
                        ...baseRouteState,
                        viewSettings: resolvedView,
                        sourceShareVersionId: isUuid(versionId) ? versionId : null,
                        snapshotState: {
                            hasNewer: true,
                            latestUrl: buildShareUrl(token),
                        },
                    };
                    applyRouteState(nextState);
                    onTripLoaded(localEntry.snapshot.trip, resolvedView);
                    return;
                }
            }

            const resolvedView = resolveEffectiveView(shared.shareView ?? shared.view, shared.trip.defaultView);
            applyRouteState({
                ...baseRouteState,
                viewSettings: resolvedView,
                sourceShareVersionId: shared.latestVersionId ?? null,
            });
            onTripLoaded(shared.trip, resolvedView);
        };

        void load();
    }, [applyRouteState, connectivitySnapshot.state, token, versionId, location.search, navigate, onTripLoaded, resetRouteState]);

    const handleCommitShared = (updatedTrip: ITrip, view: IViewSettings | undefined, options?: CommitOptions) => {
        if (shareMode !== 'edit' || !token) return;
        const label = options?.label || 'Updated trip';
        const commitTs = Date.now();
        createLocalHistoryEntry(navigate, updatedTrip, view, label, options, commitTs, location.pathname);

        const commit = async () => {
            const version = await dbUpdateSharedTrip(token, updatedTrip, view, label);
            if (!version) return;
        };
        void commit();
    };

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
            source: 'shared_trip',
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
                source: 'shared_trip',
                current_tier: currentTierKey,
                target_tier: upgradeTierKey,
            });
            return;
        }

        trackEvent('trip_limit__dialog--upgrade', {
            source: 'shared_trip',
            current_tier: currentTierKey,
            target_tier: upgradeTierKey,
        });

        navigate(buildBillingCheckoutPath({
            tierKey: upgradeTierKey,
            source: 'shared_trip_limit_dialog',
            returnTo: currentPath,
        }));
    }, [access?.tierKey, confirmDialog, location.hash, location.pathname, location.search, navigate, resolveTierHighlights, t]);

    const handleCopyTrip = async () => {
        if (!trip) return;
        if (DB_ENABLED) {
            const limit = await dbCanCreateTrip();
            if (!limit.allowCreate) {
                await handleTripLimitReached(limit);
                return;
            }
        }
        let resolvedSourceShareVersionId = sourceShareVersionId;
        if (!resolvedSourceShareVersionId && token && DB_ENABLED) {
            const sharedNow = await dbGetSharedTrip(token);
            resolvedSourceShareVersionId = sharedNow?.latestVersionId ?? null;
        }
        const now = Date.now();
        const cloned: ITrip = {
            ...trip,
            id: generateTripId(),
            createdAt: now,
            updatedAt: now,
            isFavorite: false,
            status: 'active',
            tripExpiresAt: resolveTripExpiryFromEntitlements(
                now,
                undefined,
                access?.entitlements.tripExpirationDays
            ),
            sourceKind: 'duplicate_shared',
            forkedFromTripId: trip.id,
            forkedFromShareToken: token || undefined,
            forkedFromShareVersionId: resolvedSourceShareVersionId || undefined,
        };
        if (typeof window !== 'undefined') {
            try {
                window.sessionStorage.setItem('tf_trip_copy_notice', JSON.stringify({
                    tripId: cloned.id,
                    sourceTripId: trip.id,
                    sourceTitle: trip.title,
                    sourceShareToken: token || null,
                    sourceShareVersionId: resolvedSourceShareVersionId || null,
                    createdAt: Date.now(),
                }));
            } catch {
                // ignore storage issues
            }
        }
        saveTrip(cloned);
        if (DB_ENABLED) {
            await dbUpsertTrip(cloned, viewSettings);
            await dbCreateTripVersion(cloned, viewSettings, 'Data: Copied trip');
            createLocalHistoryEntry(navigate, cloned, viewSettings, 'Data: Copied trip', undefined, Date.now());
            return;
        }
        navigate(buildTripWorkspacePath(`/trip/${encodeURIComponent(cloned.id)}`, DEFAULT_TRIP_WORKSPACE_PAGE));
    };

    const handleRouteViewSettingsChange = useCallback((settings: IViewSettings) => {
        const currentViewSettings = routeState.viewSettings;
        if (areViewSettingsEqual(currentViewSettings, settings)) return;
        hasInSessionViewOverrideRef.current = true;
        setRouteState((prev) => ({ ...prev, viewSettings: settings }));
        onViewSettingsChange(settings);
    }, [onViewSettingsChange, routeState.viewSettings]);

    if (!trip) {
        return <TripRouteLoadingShell variant="loadingSharedTrip" />;
    }

    return (
        <React.Suspense fallback={<TripRouteLoadingShell variant="preparingSharedPlanner" />}>
            <LazyTripView
                trip={trip}
                initialViewSettings={viewSettings ?? trip.defaultView}
                onUpdateTrip={(updatedTrip) => onTripLoaded(updatedTrip, viewSettings ?? updatedTrip.defaultView)}
                onCommitState={handleCommitShared}
                onViewSettingsChange={handleRouteViewSettingsChange}
                onOpenManager={onOpenManager}
                onOpenSettings={onOpenSettings}
                appLanguage={appLanguage}
                readOnly={shareMode === 'view'}
                canShare={false}
                shareStatus={shareMode}
                shareSnapshotMeta={snapshotState ?? undefined}
                onCopyTrip={allowCopy ? handleCopyTrip : undefined}
            />
        </React.Suspense>
    );
};
