import React from 'react';
import { Link } from 'react-router-dom';
import { Article, RocketLaunch, WarningCircle } from '@phosphor-icons/react';
import { Loader2 } from 'lucide-react';

import type { ShareMode } from '../../types';
import { trackEvent } from '../../services/analyticsService';

interface TripViewHudOverlaysProps {
    shareStatus?: ShareMode;
    onCopyTrip?: () => void;
    isPaywallLocked: boolean;
    expirationLabel: string | null;
    tripId: string;
    onPaywallLoginClick: (
        event: React.MouseEvent<HTMLAnchorElement>,
        analyticsEvent: 'trip_paywall__strip--activate' | 'trip_paywall__overlay--activate',
        source: 'trip_paywall_strip' | 'trip_paywall_overlay'
    ) => void;
    showGenerationOverlay: boolean;
    generationProgressMessage: string;
    loadingDestinationSummary: string;
    tripDateRange: string;
    tripTotalDaysLabel: string;
}

export const TripViewHudOverlays: React.FC<TripViewHudOverlaysProps> = ({
    shareStatus,
    onCopyTrip,
    isPaywallLocked,
    expirationLabel,
    tripId,
    onPaywallLoginClick,
    showGenerationOverlay,
    generationProgressMessage,
    loadingDestinationSummary,
    tripDateRange,
    tripTotalDaysLabel,
}) => {
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
                    <div className="pointer-events-auto w-full max-w-xl rounded-2xl bg-gradient-to-br from-accent-200/60 via-rose-100/70 to-amber-100/80 p-[1px] shadow-2xl">
                        <div className="relative overflow-hidden rounded-[15px] border border-white/70 bg-white/95 px-5 py-5 backdrop-blur">
                            <div className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-accent-200/40 blur-2xl" />
                            <div className="pointer-events-none absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-rose-100/70 blur-2xl" />

                            <div className="relative flex items-start gap-3.5">
                                <div className="min-w-0 flex-1">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-700">Trip preview paused</p>
                                    <div className="mt-1 text-lg font-semibold leading-tight text-slate-900">
                                        Keep this plan alive and unlock every detail
                                    </div>
                                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                                        Continue where you left off with a free TravelFlow account.
                                        You will regain full editing, destination names, and map routing instantly.
                                    </p>
                                </div>
                                <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-accent-200 bg-accent-50 text-accent-700">
                                    <WarningCircle size={20} weight="duotone" />
                                </span>
                            </div>
                            <div className="relative mt-4 flex flex-wrap justify-end gap-2">
                                <Link
                                    to="/faq"
                                    onClick={() => trackEvent('trip_paywall__overlay--faq', { trip_id: tripId })}
                                    className="inline-flex h-9 items-center gap-1.5 rounded-md border border-accent-200 bg-white px-3 text-xs font-semibold text-accent-700 hover:bg-accent-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
                                >
                                    <Article size={14} weight="duotone" />
                                    Visit FAQ
                                </Link>
                                <Link
                                    to="/login"
                                    onClick={(event) => onPaywallLoginClick(event, 'trip_paywall__overlay--activate', 'trip_paywall_overlay')}
                                    className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent-600 px-3 text-xs font-semibold text-white hover:bg-accent-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
                                >
                                    <RocketLaunch size={14} weight="duotone" />
                                    Reactivate trip
                                </Link>
                            </div>

                            <div className="relative mt-4 border-t border-slate-200 pt-3">
                                <p className="text-[11px] leading-relaxed text-slate-500">
                                    {expirationLabel ? `Expired on ${expirationLabel}. ` : ''}
                                    Preview mode stays visible, while advanced planning controls unlock after activation.
                                </p>
                            </div>
                        </div>
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
                            {loadingDestinationSummary} • {tripDateRange} • {tripTotalDaysLabel} days
                        </div>
                        <div className="mt-3 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full w-1/2 bg-gradient-to-r from-accent-500 to-accent-600 animate-pulse rounded-full" />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
