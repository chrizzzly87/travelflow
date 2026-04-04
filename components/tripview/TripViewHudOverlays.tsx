import React from 'react';
import { Link } from 'react-router-dom';
import { Article, Check, RocketLaunch, Sparkle, WarningCircle } from '@phosphor-icons/react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PLAN_CATALOG } from '../../config/planCatalog';
import type { TripPaywallActivationMode } from '../../config/paywall';
import type { ShareMode } from '../../types';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';

interface TripViewHudOverlaysProps {
    shareStatus?: ShareMode;
    onCopyTrip?: () => void;
    isPaywallLocked: boolean;
    expirationLabel: string | null;
    tripId: string;
    paywallActivationMode: TripPaywallActivationMode;
    onPaywallActivateClick: (
        event: React.MouseEvent<HTMLAnchorElement>,
        analyticsEvent: 'trip_paywall__strip--activate' | 'trip_paywall__overlay--activate',
        source: 'trip_paywall_strip' | 'trip_paywall_overlay'
    ) => void;
    paywallOverlayUpgradeCheckoutPath?: string | null;
    showGenerationOverlay: boolean;
    generationProgressMessage: string;
    loadingDestinationSummary: string;
    tripDateRange: string;
    tripSpanCompactLabel: string;
    pendingAuthModalStage?: 'hidden' | 'loading' | 'locked';
    onContinuePendingAuth?: () => void;
    isPendingAuthContinueDisabled?: boolean;
    claimConflictModalVisible?: boolean;
    claimConflictShowLoginCta?: boolean;
    claimConflictCreateSimilarPath?: string;
    onClaimConflictLogin?: () => void;
}

export const TripViewHudOverlays: React.FC<TripViewHudOverlaysProps> = ({
    shareStatus,
    onCopyTrip,
    isPaywallLocked,
    expirationLabel,
    tripId,
    paywallActivationMode,
    onPaywallActivateClick,
    paywallOverlayUpgradeCheckoutPath = null,
    showGenerationOverlay,
    generationProgressMessage,
    loadingDestinationSummary,
    tripDateRange,
    tripSpanCompactLabel,
    pendingAuthModalStage = 'hidden',
    onContinuePendingAuth,
    isPendingAuthContinueDisabled = false,
    claimConflictModalVisible = false,
    claimConflictShowLoginCta = false,
    claimConflictCreateSimilarPath = '/create-trip',
    onClaimConflictLogin,
}) => {
    const { t } = useTranslation(['common', 'pricing']);
    const paywallRequiresLogin = paywallActivationMode === 'login_modal';
    const showPendingAuthModal = pendingAuthModalStage !== 'hidden';
    const showClaimConflictModal = claimConflictModalVisible;
    const explorerTier = PLAN_CATALOG.tier_mid;
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

    return (
        <>
            {shareStatus === 'view' && onCopyTrip && (
                <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-[1400]">
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/95 backdrop-blur px-4 py-3 shadow-lg text-amber-900 text-sm">
                        <div className="font-semibold">View-only trip</div>
                        <div className="text-xs text-amber-800 mt-1">
                            You can change visual settings, but edits to the itinerary are disabled.
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3">
                            <span className="text-[11px] text-amber-700">Copy to edit your own version.</span>
                            <button
                                type="button"
                                onClick={onCopyTrip}
                                className="px-3 py-1.5 rounded-lg bg-amber-200 text-amber-900 text-xs font-semibold hover:bg-amber-300"
                            >
                                Copy trip
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isPaywallLocked && (
                <div className="fixed inset-0 z-[1490] flex items-end sm:items-center justify-center p-3 sm:p-4 pointer-events-none">
                    <div className="pointer-events-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                        <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_320px]">
                            <div className="px-5 py-5 sm:px-6 sm:py-6">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-700">
                                            {t('tripPaywall.overlay.eyebrow')}
                                        </p>
                                        <h2 className="mt-2 text-2xl font-semibold leading-tight tracking-tight text-slate-900">
                                            {paywallRequiresLogin
                                                ? t('tripPaywall.overlay.title.login')
                                                : t('tripPaywall.overlay.title.direct')}
                                        </h2>
                                    </div>
                                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent-200 bg-accent-50 text-accent-700">
                                        <WarningCircle size={20} weight="duotone" />
                                    </span>
                                </div>

                                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                                    {paywallRequiresLogin
                                        ? t('tripPaywall.overlay.description.login')
                                        : t('tripPaywall.overlay.description.direct')}
                                </p>

                                <div className="mt-4 flex flex-wrap gap-2">
                                    <span className="inline-flex items-center rounded-full border border-accent-200 bg-accent-50 px-3 py-1 text-xs font-semibold text-accent-800">
                                        {explorerTier.publicName} · ${explorerTier.monthlyPriceUsd}{t('shared.perMonth', { ns: 'pricing' })}
                                    </span>
                                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                                        {expirationLabel
                                            ? t('tripPaywall.overlay.footer.withDate', { date: expirationLabel })
                                            : t('tripPaywall.overlay.footer.noDate')}
                                    </span>
                                </div>

                                <div className="mt-6 flex flex-wrap gap-2">
                                    <Link
                                        to="/faq"
                                        onClick={() => trackEvent('trip_paywall__overlay--faq', { trip_id: tripId })}
                                        className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
                                    >
                                        <Article size={15} weight="duotone" />
                                        Visit FAQ
                                    </Link>
                                    {paywallOverlayUpgradeCheckoutPath && (
                                        <Link
                                            to={paywallOverlayUpgradeCheckoutPath}
                                            onClick={() => trackEvent('trip_paywall__overlay--upgrade', { trip_id: tripId })}
                                            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-accent-200 bg-accent-50 px-4 text-sm font-semibold text-accent-800 hover:bg-accent-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
                                        >
                                            <Sparkle size={15} weight="duotone" />
                                            {t('checkout.tripEntryCta', { ns: 'pricing' })}
                                        </Link>
                                    )}
                                    <Link
                                        to="/login"
                                        onClick={(event) => onPaywallActivateClick(event, 'trip_paywall__overlay--activate', 'trip_paywall_overlay')}
                                        className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-accent-600 px-4 text-sm font-semibold text-white hover:bg-accent-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
                                    >
                                        <RocketLaunch size={15} weight="duotone" />
                                        {paywallRequiresLogin
                                            ? t('tripPaywall.reactivate.actions.login')
                                            : t('tripPaywall.reactivate.actions.direct')}
                                    </Link>
                                </div>
                            </div>

                            <aside className="border-t border-slate-200 bg-slate-50/80 px-5 py-5 md:border-l md:border-t-0 sm:px-6 sm:py-6">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                                    {t('checkout.whatsIncluded', { ns: 'pricing' })}
                                </p>
                                <ul className="mt-4 space-y-3">
                                    {explorerHighlights.map((feature) => (
                                        <li key={feature} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                                            <Check size={16} weight="bold" className="mt-1 shrink-0 text-accent-600" />
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </aside>
                        </div>
                    </div>
                </div>
            )}

            {showPendingAuthModal && (
                <div className="fixed inset-0 z-[1495] flex items-end justify-center bg-slate-950/45 p-3 backdrop-blur-sm sm:items-center sm:p-4">
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="trip-pending-auth-title"
                        className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
                    >
                        {pendingAuthModalStage === 'loading' ? (
                            <div className="px-5 py-5 sm:px-6 sm:py-6">
                                <div className="flex items-start gap-4">
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-50 text-accent-700">
                                        <Loader2 size={20} className="animate-spin" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-700">
                                            {t('tripView.pendingAuth.eyebrowLoading')}
                                        </p>
                                        <h2 id="trip-pending-auth-title" className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                                            {t('tripView.pendingAuth.titleLoading')}
                                        </h2>
                                        <p className="mt-2 text-sm leading-6 text-slate-600">
                                            {t('tripView.pendingAuth.descriptionLoading')}
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                                    {loadingDestinationSummary} • {tripDateRange} • {tripSpanCompactLabel}
                                </div>
                            </div>
                        ) : (
                            <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_240px]">
                                <div className="px-5 py-5 sm:px-6 sm:py-6">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-700">
                                                {t('tripView.pendingAuth.eyebrowLocked')}
                                            </p>
                                            <h2 id="trip-pending-auth-title" className="mt-2 text-2xl font-semibold leading-tight tracking-tight text-slate-900">
                                                {t('tripView.pendingAuth.titleLocked')}
                                            </h2>
                                        </div>
                                        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent-200 bg-accent-50 text-accent-700">
                                            <WarningCircle size={20} weight="duotone" />
                                        </span>
                                    </div>

                                    <p className="mt-3 text-sm leading-6 text-slate-600">
                                        {t('tripView.pendingAuth.descriptionLocked')}
                                    </p>

                                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                                        {loadingDestinationSummary} • {tripDateRange} • {tripSpanCompactLabel}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            trackEvent('trip_generation__pending_auth_modal--continue', {
                                                trip_id: tripId,
                                                source: 'trip_pending_auth_modal',
                                            });
                                            onContinuePendingAuth?.();
                                        }}
                                        disabled={isPendingAuthContinueDisabled}
                                        className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-accent-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                                        {...getAnalyticsDebugAttributes('trip_generation__pending_auth_modal--continue', {
                                            trip_id: tripId,
                                            source: 'trip_pending_auth_modal',
                                        })}
                                    >
                                        {t('tripView.pendingAuth.cta')}
                                    </button>
                                </div>

                                <aside className="border-t border-slate-200 bg-slate-50/80 px-5 py-5 md:border-l md:border-t-0 sm:px-6 sm:py-6">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                                        {t('tripView.pendingAuth.benefitsTitle')}
                                    </p>
                                    <ul className="mt-4 space-y-3">
                                        {[
                                            t('tripView.pendingAuth.benefits.keep'),
                                            t('tripView.pendingAuth.benefits.background'),
                                            t('tripView.pendingAuth.benefits.sync'),
                                        ].map((benefit) => (
                                            <li key={benefit} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                                                <Check size={16} weight="bold" className="mt-1 shrink-0 text-accent-600" />
                                                <span>{benefit}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </aside>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {showGenerationOverlay && (
                <div className="pointer-events-none absolute inset-0 z-[1800] flex items-center justify-center p-4 sm:p-6">
                    <div className="w-full max-w-xl rounded-2xl border border-accent-100 bg-white/95 shadow-xl backdrop-blur-sm px-5 py-4">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-accent-100 text-accent-600 flex items-center justify-center shrink-0">
                                <Loader2 size={18} className="animate-spin" />
                            </div>
                            <div className="min-w-0">
                                <div className="text-sm font-semibold text-accent-900 truncate">Planning your trip</div>
                                <div className="text-xs text-gray-600 truncate">{generationProgressMessage}</div>
                            </div>
                        </div>
                        <div className="mt-3 text-xs text-gray-500">
                            {loadingDestinationSummary} • {tripDateRange} • {tripSpanCompactLabel}
                        </div>
                        <div className="mt-3 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full w-1/2 bg-gradient-to-r from-accent-500 to-accent-600 animate-pulse rounded-full" />
                        </div>
                    </div>
                </div>
            )}

            {showClaimConflictModal && (
                <div className="fixed inset-0 z-[1496] flex items-end justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:items-center sm:p-4">
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="trip-claim-conflict-title"
                        className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
                    >
                        <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_220px]">
                            <div className="px-5 py-5 sm:px-6 sm:py-6">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-700">
                                            {t('tripView.claimConflict.eyebrow')}
                                        </p>
                                        <h2 id="trip-claim-conflict-title" className="mt-2 text-2xl font-semibold leading-tight tracking-tight text-slate-900">
                                            {t('tripView.claimConflict.title')}
                                        </h2>
                                    </div>
                                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent-200 bg-accent-50 text-accent-700">
                                        <WarningCircle size={20} weight="duotone" />
                                    </span>
                                </div>

                                <p className="mt-3 text-sm leading-6 text-slate-600">
                                    {claimConflictShowLoginCta
                                        ? t('tripView.claimConflict.descriptionLoggedOut')
                                        : t('tripView.claimConflict.descriptionLoggedIn')}
                                </p>

                                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                                    {loadingDestinationSummary} • {tripDateRange} • {tripSpanCompactLabel}
                                </div>

                                <div className="mt-5 flex flex-wrap gap-2">
                                    {claimConflictShowLoginCta && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                trackEvent('trip_generation__claim_conflict_modal--login', {
                                                    trip_id: tripId,
                                                    source: 'trip_claim_conflict_modal',
                                                });
                                                onClaimConflictLogin?.();
                                            }}
                                            className="inline-flex h-11 items-center justify-center rounded-xl bg-accent-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
                                            {...getAnalyticsDebugAttributes('trip_generation__claim_conflict_modal--login', {
                                                trip_id: tripId,
                                                source: 'trip_claim_conflict_modal',
                                            })}
                                        >
                                            {t('tripView.claimConflict.loginCta')}
                                        </button>
                                    )}
                                    <Link
                                        to={claimConflictCreateSimilarPath}
                                        onClick={() => {
                                            trackEvent('trip_generation__claim_conflict_modal--create_similar', {
                                                trip_id: tripId,
                                                source: 'trip_claim_conflict_modal',
                                            });
                                        }}
                                        className={`inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 ${
                                            claimConflictShowLoginCta
                                                ? 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                                                : 'bg-accent-600 text-white hover:bg-accent-700'
                                        }`}
                                        {...getAnalyticsDebugAttributes('trip_generation__claim_conflict_modal--create_similar', {
                                            trip_id: tripId,
                                            source: 'trip_claim_conflict_modal',
                                        })}
                                    >
                                        {t('tripView.claimConflict.createSimilarCta')}
                                    </Link>
                                </div>
                            </div>

                            <aside className="border-t border-slate-200 bg-slate-50/80 px-5 py-5 md:border-l md:border-t-0 sm:px-6 sm:py-6">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                                    {t('tripView.claimConflict.benefitsTitle')}
                                </p>
                                <ul className="mt-4 space-y-3">
                                    {[
                                        t('tripView.claimConflict.benefits.prefill'),
                                        t('tripView.claimConflict.benefits.adjust'),
                                    ].map((benefit) => (
                                        <li key={benefit} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                                            <Check size={16} weight="bold" className="mt-1 shrink-0 text-accent-600" />
                                            <span>{benefit}</span>
                                        </li>
                                    ))}
                                </ul>
                            </aside>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
