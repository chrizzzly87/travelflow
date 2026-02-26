import React from 'react';
import { Link } from 'react-router-dom';
import { CopySimple, Sparkle } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';

import type { ShareMode } from '../../types';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import type { ConnectivityState } from '../../services/supabaseHealthMonitor';
import { Spinner } from '../ui/spinner';

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
    onPaywallLoginClick: (
        event: React.MouseEvent<HTMLAnchorElement>,
        analyticsEvent: 'trip_paywall__strip--activate' | 'trip_paywall__overlay--activate',
        source: 'trip_paywall_strip' | 'trip_paywall_overlay'
    ) => void;
    tripId: string;
    connectivityState?: ConnectivityState;
    connectivityForced?: boolean;
    pendingSyncCount?: number;
    failedSyncCount?: number;
    isSyncingQueue?: boolean;
    onRetrySyncQueue?: () => void;
    hasConflictBackupForTrip?: boolean;
    onRestoreConflictBackup?: () => void;
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
    onPaywallLoginClick,
    tripId,
    connectivityState,
    connectivityForced = false,
    pendingSyncCount = 0,
    failedSyncCount = 0,
    isSyncingQueue = false,
    onRetrySyncQueue,
    hasConflictBackupForTrip = false,
    onRestoreConflictBackup,
    exampleTripBanner,
}) => {
    const { t } = useTranslation('common');
    const shouldShowConnectivityStrip = Boolean(connectivityState && connectivityState !== 'online');
    const shouldShowSyncStrip = pendingSyncCount > 0 || isSyncingQueue;
    const queueCountVariant = pendingSyncCount === 0 ? 'None' : (pendingSyncCount === 1 ? 'One' : 'Many');
    const syncCountVariant = pendingSyncCount === 1 ? 'One' : 'Many';

    return (
        <>
            {shouldShowConnectivityStrip && (
                <div className={`px-4 sm:px-6 py-2 border-b text-xs flex items-center justify-between gap-3 ${
                    connectivityState === 'offline'
                        ? 'border-rose-200 bg-rose-50 text-rose-900'
                        : 'border-amber-200 bg-amber-50 text-amber-900'
                }`}>
                    <span>
                        {t(`connectivity.tripStrip.${connectivityState}.message${queueCountVariant}`, { count: pendingSyncCount })}
                        {connectivityForced ? ` ${t('connectivity.tripStrip.forcedSuffix')}` : ''}
                    </span>
                    {failedSyncCount > 0 && onRetrySyncQueue && (
                        <button
                            type="button"
                            onClick={() => {
                                trackEvent('trip_connectivity__trip_strip--retry_sync', {
                                    trip_id: tripId,
                                    failed_count: failedSyncCount,
                                    pending_count: pendingSyncCount,
                                    connectivity_state: connectivityState,
                                });
                                onRetrySyncQueue();
                            }}
                            className="px-3 py-1 rounded-md bg-white text-xs font-semibold border border-current/20 hover:bg-white/80"
                            {...getAnalyticsDebugAttributes('trip_connectivity__trip_strip--retry_sync', {
                                trip_id: tripId,
                                failed_count: failedSyncCount,
                                pending_count: pendingSyncCount,
                                connectivity_state: connectivityState,
                            })}
                        >
                            {t('connectivity.tripStrip.retry')}
                        </button>
                    )}
                </div>
            )}

            {shouldShowSyncStrip && (
                <div className="px-4 sm:px-6 py-2 border-b border-sky-200 bg-sky-50 text-sky-900 text-xs flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2">
                        {isSyncingQueue && <Spinner className="h-3.5 w-3.5" />}
                        {isSyncingQueue
                            ? t(`connectivity.tripStrip.syncing${syncCountVariant}`, { count: pendingSyncCount })
                            : t(`connectivity.tripStrip.pending${syncCountVariant}`, { count: pendingSyncCount })}
                    </span>
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
                            className="px-3 py-1 rounded-md bg-sky-100 text-sky-900 text-xs font-semibold hover:bg-sky-200"
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
                    className={`px-4 sm:px-6 py-2 border-b text-xs flex items-center justify-between gap-3 ${
                        isTripLockedByExpiry
                            ? 'border-rose-200 bg-rose-50 text-rose-900'
                            : 'border-sky-200 bg-sky-50 text-sky-900'
                    }`}
                >
                    <span>
                        {isPaywallLocked
                            ? `Trip preview paused${expirationLabel ? ` since ${expirationLabel}` : ''}. Reactivate to unlock full planning mode.`
                            : isTripLockedByExpiry
                                ? `Trip expired${expirationLabel ? ` since ${expirationLabel}` : ''}. It stays read-only until reactivated.`
                                : `${expirationRelativeLabel || 'Trip access is time-limited'}${expirationLabel ? ` · Ends ${expirationLabel}` : ''}.`}
                    </span>
                    {isPaywallLocked && (
                        <Link
                            to="/login"
                            onClick={(event) => onPaywallLoginClick(event, 'trip_paywall__strip--activate', 'trip_paywall_strip')}
                            className="px-3 py-1 rounded-md bg-rose-100 text-rose-900 text-xs font-semibold hover:bg-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
                        >
                            Reactivate trip
                        </Link>
                    )}
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
