import React, { useCallback } from 'react';

import { Drawer, DrawerContent } from '../ui/drawer';
import { TransportModeIcon } from '../TransportModeIcon';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { normalizeTransportMode, TRANSPORT_MODE_UI_ORDER } from '../../shared/transportModes';
import { TRAVEL_COLOR } from '../../utils';
import type { ITimelineItem, TransportMode } from '../../types';

interface TripMobileTransportModalProps {
    tripId: string;
    travelItem: ITimelineItem | null;
    fromCityTitle?: string;
    toCityTitle?: string;
    onClose: () => void;
    onUpdateItem: (itemId: string, patch: Partial<ITimelineItem>) => void;
}

const formatModeLabel = (mode: TransportMode): string => (
    mode === 'na' ? 'N/A' : `${mode.charAt(0).toUpperCase()}${mode.slice(1)}`
);

/**
 * Mobile equivalent of the details panel's transport picker.
 *
 * It writes the same patch the desktop picker does — the item becomes a travel
 * item in the chosen mode, keeping a non-zero duration — so a leg edited on a
 * phone is indistinguishable from one edited on a desktop.
 */
export const TripMobileTransportModal: React.FC<TripMobileTransportModalProps> = ({
    tripId,
    travelItem,
    fromCityTitle,
    toCityTitle,
    onClose,
    onUpdateItem,
}) => {
    const currentMode = normalizeTransportMode(travelItem?.transportMode);

    const selectMode = useCallback((mode: TransportMode) => {
        if (!travelItem) return;
        const nextMode = normalizeTransportMode(mode);
        if (nextMode === currentMode) {
            onClose();
            return;
        }

        trackEvent('trip_view__mobile_transport--change', {
            trip_id: tripId,
            item_id: travelItem.id,
            mode: nextMode,
        });
        onUpdateItem(travelItem.id, {
            type: 'travel',
            transportMode: nextMode,
            title: `${formatModeLabel(nextMode)} Travel`,
            color: TRAVEL_COLOR,
            duration: Math.max(0.1, travelItem.duration),
        });
        onClose();
    }, [currentMode, onClose, onUpdateItem, travelItem, tripId]);

    const legLabel = [fromCityTitle, toCityTitle].filter(Boolean).join(' → ');

    return (
        <Drawer open={Boolean(travelItem)} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DrawerContent
                accessibleTitle="Change transport"
                accessibleDescription={`Choose how this leg${legLabel ? ` from ${legLabel}` : ''} is travelled.`}
                className="pb-[max(1rem,env(safe-area-inset-bottom))]"
            >
                <div className="px-4 pt-4" data-testid="mobile-transport-modal">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Transport
                    </p>
                    {legLabel && (
                        <p className="mt-1 truncate text-base font-semibold text-slate-900">{legLabel}</p>
                    )}

                    <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
                        {(TRANSPORT_MODE_UI_ORDER as TransportMode[]).map((mode) => {
                            const isActive = mode === currentMode;
                            return (
                                <button
                                    key={mode}
                                    type="button"
                                    onClick={() => selectMode(mode)}
                                    aria-pressed={isActive}
                                    className={`flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-xl border-2 transition-colors ${
                                        isActive
                                            ? 'border-accent-500 bg-accent-50 text-accent-700'
                                            : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                                    }`}
                                    {...getAnalyticsDebugAttributes('trip_view__mobile_transport--change', {
                                        trip_id: tripId,
                                        mode,
                                    })}
                                >
                                    <TransportModeIcon mode={mode} size={22} />
                                    <span className="text-[10px] font-bold uppercase tracking-wide">
                                        {formatModeLabel(mode)}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl px-4 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-50"
                    >
                        Cancel
                    </button>
                </div>
            </DrawerContent>
        </Drawer>
    );
};
