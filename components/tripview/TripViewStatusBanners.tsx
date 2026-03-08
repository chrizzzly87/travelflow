import React from 'react';
import { Link } from 'react-router-dom';
import { Check, CopySimple, Sparkle } from '@phosphor-icons/react';
import { AlertTriangle, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PLAN_CATALOG } from '../../config/planCatalog';
import { normalizeLocale } from '../../config/locales';
import type { TripPaywallActivationMode } from '../../config/paywall';
import { buildLocalizedMarketingPath } from '../../config/routes';
import type { ShareMode, TripGenerationState } from '../../types';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import type { ConnectivityState } from '../../services/supabaseHealthMonitor';
import { Spinner } from '../ui/spinner';

const IS_DEV = Boolean((import.meta as any)?.env?.DEV);

interface TripViewStatusBannersProps {
    shareStatus?: ShareMode;
    onCopyTrip?: () => void;
    isAdminFallbackView: boolean;
    adminOverrideEnabled: boolean;
    canEnableAdminOverride: boolean;
    ownerUsersUrl: string | null;
    ownerEmail?: string;
    ownerId?: string;
    isTripLockedByArchive: boolean;
    isTripLockedByExpiry: boolean;
    hasLoadingItems: boolean;
    onOpenOwnerDrawer: () => void;
    onAdminOverrideEnabledChange: (enabled: boolean) => void;
    shareSnapshotMeta?: {
        hasNewer: boolean;
        latestUrl: string;
    };
    onOpenLatestSnapshot: () => void;
    tripExpiresAtMs: number | null;
    isExampleTrip: boolean;
    isPaywallLocked: boolean;
    expirationLabel: string | null;
    expirationRelativeLabel: string | null;
    paywallActivationMode: TripPaywallActivationMode;
    onPaywallActivateClick: (
        event: React.MouseEvent<HTMLAnchorElement>,
        analyticsEvent: 'trip_paywall__strip--activate' | 'trip_paywall__overlay--activate',
        source: 'trip_paywall_strip' | 'trip_paywall_overlay'
    ) => void;
    paywallStripUpgradeCheckoutPath?: string | null;
    tripId: string;
    connectivityState?: ConnectivityState;
    connectivityReason?: string | null;
    connectivityForced?: boolean;
    pendingSyncCount?: number;
    failedSyncCount?: number;
    isSyncingQueue?: boolean;
    onRetrySyncQueue?: () => void;
    hasConflictBackupForTrip?: boolean;
    onRestoreConflictBackup?: () => void;
    generationState?: TripGenerationState | null;
    generationElapsedMs?: number | null;
    generationTimeoutMs?: number;
    generationFailureMessage?: string | null;
    pendingAuthQueueRequestId?: string | null;
    canRetryGeneration?: boolean;
    canAbortAndRetryGeneration?: boolean;
    isRetryingGeneration?: boolean;
    isResolvingPendingAuthGeneration?: boolean;
    onResolvePendingAuthGeneration?: () => void;
    onAbortAndRetryGeneration?: () => void;
    onOpenRetryModelSelector?: () => void;
    onRetryGeneration?: () => void;
    exampleTripBanner?: {
        title: string;
        countries: string[];
        onCreateSimilarTrip?: () => void;
    };
}

export const TripViewStatusBanners: React.FC<TripViewStatusBannersProps> = ({
    shareStatus,
    onCopyTrip,
    isAdminFallbackView,
    adminOverrideEnabled,
    canEnableAdminOverride,
    ownerUsersUrl,
    ownerEmail,
    ownerId,
    isTripLockedByArchive,
    isTripLockedByExpiry,
    hasLoadingItems,
    onOpenOwnerDrawer,
    onAdminOverrideEnabledChange,
    shareSnapshotMeta,
    onOpenLatestSnapshot,
    tripExpiresAtMs,
    isExampleTrip,
    isPaywallLocked,
    expirationLabel,
    expirationRelativeLabel,
    paywallActivationMode,
    onPaywallActivateClick,
    paywallStripUpgradeCheckoutPath = null,
    tripId,
    connectivityState,
    connectivityReason,
    connectivityForced = false,
    pendingSyncCount = 0,
    failedSyncCount = 0,
    isSyncingQueue = false,
    onRetrySyncQueue,
    hasConflictBackupForTrip = false,
    onRestoreConflictBackup,
    generationState = null,
    generationElapsedMs = null,
    generationTimeoutMs = 60_000,
    generationFailureMessage = null,
    pendingAuthQueueRequestId = null,
    canRetryGeneration = false,
    canAbortAndRetryGeneration = false,
    isRetryingGeneration = false,
    isResolvingPendingAuthGeneration = false,
    onResolvePendingAuthGeneration,
    onAbortAndRetryGeneration,
    onOpenRetryModelSelector,
    onRetryGeneration,
    exampleTripBanner,
}) => {
    const { t, i18n } = useTranslation(['common', 'pricing']);
    const shouldShowConnectivityStrip = Boolean(connectivityState && connectivityState !== 'online');
    const shouldShowSyncStrip = pendingSyncCount > 0 || isSyncingQueue;
    const showSyncStatusStrip = shouldShowConnectivityStrip || shouldShowSyncStrip;
    const syncCountVariant = pendingSyncCount === 1 ? 'One' : 'Many';
    const isBrowserOffline = connectivityReason === 'browser_offline';
    const paywallRequiresLogin = paywallActivationMode === 'login_modal';
    const activeLocale = normalizeLocale(i18n?.resolvedLanguage ?? i18n?.language ?? 'en');
    const explorerTier = PLAN_CATALOG.tier_mid;
    const supportContactPath = buildLocalizedMarketingPath('contact', activeLocale);
    const explorerHighlights = React.useMemo(() => {
        const unlimitedLabel = t('shared.unlimited', { ns: 'pricing' });
        const noExpiryLabel = t('shared.noExpiry', { ns: 'pricing' });
        const enabledLabel = t('shared.enabled', { ns: 'pricing' });
        const disabledLabel = t('shared.disabled', { ns: 'pricing' });
        const interpolationValues = {
            maxActiveTripsLabel: explorerTier.entitlements.maxActiveTrips === null
                ? unlimitedLabel
                : String(explorerTier.entitlements.maxActiveTrips),
            maxTotalTripsLabel: explorerTier.entitlements.maxTotalTrips === null
                ? unlimitedLabel
                : String(explorerTier.entitlements.maxTotalTrips),
            tripExpirationLabel: explorerTier.entitlements.tripExpirationDays === null
                ? noExpiryLabel
                : t('shared.days', { ns: 'pricing', count: explorerTier.entitlements.tripExpirationDays }),
            sharingLabel: explorerTier.entitlements.canShare ? enabledLabel : disabledLabel,
            editableSharesLabel: explorerTier.entitlements.canCreateEditableShares ? enabledLabel : disabledLabel,
            proCreationLabel: explorerTier.entitlements.canCreateProTrips ? enabledLabel : disabledLabel,
        };
        return [0, 2, 4].map((index) => t(`tiers.explorer.features.${index}`, {
            ns: 'pricing',
            ...interpolationValues,
        }));
    }, [t]);
    const stripMessage = shouldShowConnectivityStrip ? (
        connectivityState === 'offline'
            ? t(isBrowserOffline ? 'connectivity.tripStrip.offline.browser' : 'connectivity.tripStrip.offline.service')
            : t('connectivity.tripStrip.degraded.service')
    ) : (
        isSyncingQueue
            ? t(`connectivity.tripStrip.syncing${syncCountVariant}`, { count: pendingSyncCount })
            : t(`connectivity.tripStrip.pending${syncCountVariant}`, { count: pendingSyncCount })
    );
    const showContactAction = shouldShowConnectivityStrip && !isBrowserOffline;
    const stripIcon = shouldShowConnectivityStrip
        ? (
            connectivityState === 'offline'
                ? <WifiOff className="h-3.5 w-3.5 shrink-0" />
                : <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        )
        : (isSyncingQueue ? <Spinner className="h-3.5 w-3.5 shrink-0" /> : null);
    const isSlowGeneration = (
        (generationState === 'running' || generationState === 'queued')
        && typeof generationElapsedMs === 'number'
        && generationElapsedMs >= generationTimeoutMs
    );
    const isPendingAuthGeneration = generationState === 'failed' && Boolean(pendingAuthQueueRequestId);

    return (
        <>
            {showSyncStatusStrip && (
                <div className={`px-4 py-2 text-xs sm:px-6 border-b flex items-center justify-between gap-3 ${
                    connectivityState === 'offline'
                        ? 'border-rose-200 bg-rose-50 text-rose-900'
                        : connectivityState === 'degraded'
                            ? 'border-amber-200 bg-amber-50 text-amber-900'
                            : 'border-sky-200 bg-sky-50 text-sky-900'
                }`}>
                    <span className="inline-flex items-center gap-2">
                        {stripIcon}
                        {stripMessage}
                        {connectivityForced && IS_DEV ? ` ${t('connectivity.tripStrip.forcedSuffix')}` : ''}
                    </span>
                    <div className="flex items-center gap-2">
                        {showContactAction && (
                            <a
                                href={supportContactPath}
                                onClick={() => {
                                    trackEvent('trip_connectivity__banner--contact', {
                                        trip_id: tripId,
                                        pending_count: pendingSyncCount,
                                        connectivity_state: connectivityState,
                                        source: 'trip_strip',
                                    });
                                }}
                                className="px-3 py-1 rounded-md bg-white text-xs font-semibold border border-current/20 hover:bg-white/80"
                                {...getAnalyticsDebugAttributes('trip_connectivity__banner--contact', {
                                    trip_id: tripId,
                                    pending_count: pendingSyncCount,
                                    connectivity_state: connectivityState,
                                    source: 'trip_strip',
                                })}
                            >
                                {t('connectivity.banner.actions.contact')}
                            </a>
                        )}
                        {failedSyncCount > 0 && onRetrySyncQueue && (
                            <button
                                type="button"
                                onClick={() => {
                                    trackEvent('trip_connectivity__trip_strip--retry_sync', {
                                        trip_id: tripId,
                                        failed_count: failedSyncCount,
                                        pending_count: pendingSyncCount,
                                        connectivity_state: connectivityState || 'online',
                                    });
                                    onRetrySyncQueue();
                                }}
                                className="px-3 py-1 rounded-md bg-white text-xs font-semibold border border-current/20 hover:bg-white/80"
                                {...getAnalyticsDebugAttributes('trip_connectivity__trip_strip--retry_sync', {
                                    trip_id: tripId,
                                    failed_count: failedSyncCount,
                                    pending_count: pendingSyncCount,
                                    connectivity_state: connectivityState || 'online',
                                })}
                            >
                                {t('connectivity.tripStrip.retry')}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {(generationState === 'failed' || generationState === 'running' || generationState === 'queued') && (
                <div className={`px-4 py-2 text-xs sm:px-6 border-b flex items-center justify-between gap-3 ${
                    generationState === 'failed'
                        ? 'border-rose-200 bg-rose-50 text-rose-900'
                        : 'border-amber-200 bg-amber-50 text-amber-900'
                }`}>
                    <span className="inline-flex items-center gap-2">
                        {generationState === 'failed' ? (
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        ) : (
                            <Spinner className="h-3.5 w-3.5 shrink-0" />
                        )}
                        {generationState === 'failed'
                            ? (
                                isPendingAuthGeneration
                                    ? t('tripPaywall.strip.loginNoDate')
                                    : (generationFailureMessage || t('tripView.generation.strip.failedDefault'))
                            )
                            : (isSlowGeneration
                                ? t('tripView.generation.strip.slow')
                                : t('tripView.generation.strip.running'))}
                    </span>
                    <div className="flex items-center gap-2">
                        {isPendingAuthGeneration && onResolvePendingAuthGeneration && (
                            <button
                                type="button"
                                onClick={() => {
                                    trackEvent('trip_generation__trip_strip--pending_auth_login', {
                                        trip_id: tripId,
                                        source: 'trip_strip',
                                        has_claim: Boolean(pendingAuthQueueRequestId),
                                    });
                                    onResolvePendingAuthGeneration();
                                }}
                                disabled={isResolvingPendingAuthGeneration}
                                className="px-3 py-1 rounded-md bg-white text-xs font-semibold border border-current/20 hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
                                {...getAnalyticsDebugAttributes('trip_generation__trip_strip--pending_auth_login', {
                                    trip_id: tripId,
                                    source: 'trip_strip',
                                    has_claim: Boolean(pendingAuthQueueRequestId),
                                })}
                            >
                                {t('tripPaywall.reactivate.actions.login')}
                            </button>
                        )}
                        {isSlowGeneration && canAbortAndRetryGeneration && onAbortAndRetryGeneration && (
                            <button
                                type="button"
                                onClick={() => {
                                    trackEvent('trip_generation__trip_strip--abort_retry', {
                                        trip_id: tripId,
                                        source: 'trip_strip',
                                    });
                                    onAbortAndRetryGeneration();
                                }}
                                disabled={isRetryingGeneration}
                                className="px-3 py-1 rounded-md bg-white text-xs font-semibold border border-current/20 hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
                                {...getAnalyticsDebugAttributes('trip_generation__trip_strip--abort_retry', {
                                    trip_id: tripId,
                                    source: 'trip_strip',
                                })}
                            >
                                {t('tripView.generation.strip.abortRetry')}
                            </button>
                        )}
                        {isSlowGeneration && onOpenRetryModelSelector && (
                            <button
                                type="button"
                                onClick={onOpenRetryModelSelector}
                                className="px-3 py-1 rounded-md bg-white text-xs font-semibold border border-current/20 hover:bg-white/80"
                            >
                                {t('tripView.generation.strip.changeModel')}
                            </button>
                        )}
                        {generationState === 'failed' && !isPendingAuthGeneration && canRetryGeneration && onRetryGeneration && (
                            <button
                                type="button"
                                onClick={() => {
                                    trackEvent('trip_generation__trip_strip--retry', {
                                        trip_id: tripId,
                                        source: 'trip_strip',
                                    });
                                    onRetryGeneration();
                                }}
                                disabled={isRetryingGeneration}
                                className="px-3 py-1 rounded-md bg-white text-xs font-semibold border border-current/20 hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
                                {...getAnalyticsDebugAttributes('trip_generation__trip_strip--retry', {
                                    trip_id: tripId,
                                    source: 'trip_strip',
                                })}
                            >
                                {isRetryingGeneration
                                    ? t('tripView.generation.strip.retrying')
                                    : t('tripView.generation.strip.retry')}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {hasConflictBackupForTrip && onRestoreConflictBackup && (
                <div className="px-4 sm:px-6 py-2 border-b border-violet-200 bg-violet-50 text-violet-900 text-xs flex items-center justify-between gap-3">
                    <span>{t('connectivity.tripStrip.serverBackup')}</span>
                    <button
                        type="button"
                        onClick={() => {
                            trackEvent('trip_connectivity__trip_strip--restore_backup', {
                                trip_id: tripId,
                            });
                            onRestoreConflictBackup();
                        }}
                        className="px-3 py-1 rounded-md bg-violet-100 text-violet-900 text-xs font-semibold hover:bg-violet-200"
                        {...getAnalyticsDebugAttributes('trip_connectivity__trip_strip--restore_backup', {
                            trip_id: tripId,
                        })}
                    >
                        {t('connectivity.tripStrip.restoreServerVersion')}
                    </button>
                </div>
            )}

            {shareStatus && (
                <div className="px-4 sm:px-6 py-2 border-b border-amber-200 bg-amber-50 text-amber-900 text-xs flex items-center justify-between">
                    <span>
                        {shareStatus === 'view' ? 'View-only shared trip' : 'Shared trip · Editing enabled'}
                    </span>
                    {shareStatus === 'view' && onCopyTrip && (
                        <button
                            type="button"
                            onClick={onCopyTrip}
                            className="px-3 py-1 rounded-md bg-amber-200 text-amber-900 text-xs font-semibold hover:bg-amber-300"
                        >
                            Copy trip
                        </button>
                    )}
                </div>
            )}

            {isAdminFallbackView && (
                <div className="border-b border-indigo-200 bg-indigo-50 px-4 py-3 text-xs text-indigo-900 sm:px-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <p className="font-semibold">
                                {adminOverrideEnabled ? 'Admin override editing is enabled.' : 'Admin fallback view is read-only by default.'}
                            </p>
                            <p className="mt-1 text-[11px] text-indigo-800">
                                Owner: {ownerEmail || 'No email'} · {ownerId || 'Unknown user'}
                            </p>
                            {isTripLockedByArchive && (
                                <p className="mt-1 text-[11px] text-indigo-800">
                                    This trip is archived and stays read-only here.
                                </p>
                            )}
                            {isTripLockedByExpiry && (
                                <p className="mt-1 text-[11px] text-indigo-800">
                                    This trip is expired and stays read-only here.
                                </p>
                            )}
                            {!canEnableAdminOverride && (
                                <p className="mt-1 text-[11px] text-indigo-800">
                                    You do not have trip write permission, so editing cannot be enabled.
                                </p>
                            )}
                            {hasLoadingItems && (
                                <p className="mt-1 text-[11px] text-indigo-800">
                                    This trip has unfinished generation data, so some itinerary details may be missing.
                                </p>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            {ownerUsersUrl && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        trackEvent('trip_view__admin_owner--open_users', {
                                            trip_id: tripId,
                                            owner_id: ownerId || null,
                                        });
                                        onOpenOwnerDrawer();
                                    }}
                                    className="rounded-md border border-indigo-300 bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-900 hover:bg-indigo-200"
                                    {...getAnalyticsDebugAttributes('trip_view__admin_owner--open_users', {
                                        trip_id: tripId,
                                        owner_id: ownerId || null,
                                    })}
                                >
                                    Open owner drawer
                                </button>
                            )}
                            <div className="inline-flex items-center gap-2">
                                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-indigo-800">
                                    Enable editing
                                </span>
                                <label
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                        adminOverrideEnabled ? 'bg-indigo-600' : 'bg-indigo-300'
                                    } ${canEnableAdminOverride ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                                    {...getAnalyticsDebugAttributes('trip_view__admin_override--toggle', {
                                        trip_id: tripId,
                                        enabled: adminOverrideEnabled,
                                    })}
                                >
                                    <input
                                        type="checkbox"
                                        className="sr-only"
                                        checked={adminOverrideEnabled}
                                        disabled={!canEnableAdminOverride}
                                        onChange={(event) => {
                                            if (!canEnableAdminOverride) return;
                                            const checked = event.target.checked;
                                            onAdminOverrideEnabledChange(checked);
                                            trackEvent('trip_view__admin_override--toggle', {
                                                trip_id: tripId,
                                                enabled: checked,
                                            });
                                        }}
                                    />
                                    <span
                                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                                            adminOverrideEnabled ? 'translate-x-5' : 'translate-x-1'
                                        }`}
                                    />
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {shareSnapshotMeta && (
                <div className="px-4 sm:px-6 py-2 border-b border-accent-200 bg-accent-50 text-accent-900 text-xs flex items-center justify-between gap-3">
                    <span>
                        {shareSnapshotMeta.hasNewer
                            ? 'You are viewing an older snapshot. This trip has newer updates.'
                            : 'You are viewing a snapshot version of this shared trip.'}
                    </span>
                    {shareSnapshotMeta.hasNewer && (
                        <button
                            type="button"
                            onClick={onOpenLatestSnapshot}
                            className="px-3 py-1 rounded-md bg-accent-100 text-accent-900 text-xs font-semibold hover:bg-accent-200"
                        >
                            Open latest
                        </button>
                    )}
                </div>
            )}

            {(tripExpiresAtMs || isTripLockedByExpiry) && !isExampleTrip && (
                <div
                    className={`border-b ${
                        isTripLockedByExpiry
                            ? 'border-rose-200 bg-rose-50 text-rose-900'
                            : 'border-sky-200 bg-sky-50 text-sky-900'
                    }`}
                >
                    <div className="px-4 py-4 sm:px-6">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${
                                        isTripLockedByExpiry
                                            ? 'border-rose-200 bg-white text-rose-700'
                                            : 'border-sky-200 bg-white text-sky-700'
                                    }`}>
                                        <AlertTriangle className="h-4 w-4" />
                                    </span>
                                    <p className="min-w-0 text-sm font-semibold leading-6 text-current">
                                        {isPaywallLocked
                                            ? (paywallRequiresLogin
                                                ? (expirationLabel
                                                    ? t('tripPaywall.strip.loginSinceDate', { date: expirationLabel })
                                                    : t('tripPaywall.strip.loginNoDate'))
                                                : (expirationLabel
                                                    ? t('tripPaywall.strip.directSinceDate', { date: expirationLabel })
                                                    : t('tripPaywall.strip.directNoDate')))
                                            : isTripLockedByExpiry
                                                ? `Trip expired${expirationLabel ? ` since ${expirationLabel}` : ''}. It stays read-only until reactivated.`
                                                : `${expirationRelativeLabel || 'Trip access is time-limited'}${expirationLabel ? ` · Ends ${expirationLabel}` : ''}.`}
                                    </p>
                                    {isPaywallLocked ? (
                                        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                                            isTripLockedByExpiry
                                                ? 'border-rose-200 bg-white text-rose-800'
                                                : 'border-sky-200 bg-white text-sky-800'
                                        }`}>
                                            {explorerTier.publicName} · ${explorerTier.monthlyPriceUsd}{t('shared.perMonth', { ns: 'pricing' })}
                                        </span>
                                    ) : null}
                                </div>

                                {isPaywallLocked ? (
                                    <ul className="mt-3 flex flex-wrap gap-2">
                                        {explorerHighlights.map((feature) => (
                                            <li
                                                key={feature}
                                                className={`inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1 text-xs font-medium ${
                                                    isTripLockedByExpiry
                                                        ? 'border-rose-200 text-rose-900'
                                                        : 'border-sky-200 text-sky-900'
                                                }`}
                                            >
                                                <Check size={12} weight="bold" className="shrink-0 text-accent-600" />
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : null}
                            </div>

                            {isPaywallLocked && (
                                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                                    {paywallStripUpgradeCheckoutPath && (
                                        <Link
                                            to={paywallStripUpgradeCheckoutPath}
                                            onClick={() => trackEvent('trip_paywall__strip--upgrade', {
                                                trip_id: tripId,
                                                has_claim: Boolean(pendingAuthQueueRequestId),
                                            })}
                                            className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
                                            {...getAnalyticsDebugAttributes('trip_paywall__strip--upgrade')}
                                        >
                                            {t('checkout.tripEntryCta', { ns: 'pricing' })}
                                        </Link>
                                    )}
                                    <Link
                                        to="/login"
                                        onClick={(event) => onPaywallActivateClick(event, 'trip_paywall__strip--activate', 'trip_paywall_strip')}
                                        className="inline-flex h-10 items-center rounded-lg bg-accent-600 px-4 text-sm font-semibold text-white hover:bg-accent-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
                                    >
                                        {paywallRequiresLogin
                                            ? t('tripPaywall.reactivate.actions.login')
                                            : t('tripPaywall.reactivate.actions.direct')}
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {exampleTripBanner && (
                <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-[1450] sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[420px]">
                    <div className="rounded-2xl border border-accent-200 bg-white/95 px-4 py-3 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-white/85">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-700">Example trip playground</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">Explore freely. Copy when you want to keep and edit.</p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-600">
                            This itinerary is for illustration only and never saves changes.
                            {exampleTripBanner.countries.length > 0 && (
                                <span> Country focus: {exampleTripBanner.countries.join(', ')}.</span>
                            )}
                        </p>
                        <div className="mt-3 flex flex-wrap justify-end gap-2">
                            {exampleTripBanner.onCreateSimilarTrip && (
                                <button
                                    type="button"
                                    onClick={exampleTripBanner.onCreateSimilarTrip}
                                    className="inline-flex h-9 items-center gap-1.5 rounded-md border border-accent-200 bg-white px-3 text-xs font-semibold text-accent-700 hover:bg-accent-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
                                >
                                    <Sparkle size={14} weight="duotone" />
                                    Create similar trip
                                </button>
                            )}
                            {onCopyTrip && (
                                <button
                                    type="button"
                                    onClick={onCopyTrip}
                                    className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent-600 px-3 text-xs font-semibold text-white hover:bg-accent-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
                                >
                                    <CopySimple size={14} weight="duotone" />
                                    Copy trip
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
