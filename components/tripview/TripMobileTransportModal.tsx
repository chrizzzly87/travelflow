import React, { useCallback } from 'react';

import { Drawer, DrawerContent } from '../ui/drawer';
import { TransportModeIcon } from '../TransportModeIcon';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { normalizeTransportMode, TRANSPORT_MODE_UI_ORDER } from '../../shared/transportModes';
import type { TransportMode } from '../../types';
import type { MobileDayPlanTransfer } from './mobileDayPlanModel';

interface TripMobileTransportModalProps {
    tripId: string;
    /** The leg being edited; null closes the picker. */
    leg: MobileDayPlanTransfer | null;
    onClose: () => void;
    onSetLegTransport: (
        legRef: { fromCityId: string; toCityId: string; travelItemId: string | null },
        mode: string,
    ) => void;
}

const formatModeLabel = (mode: TransportMode): string => (
    mode === 'na' ? 'N/A' : `${mode.charAt(0).toUpperCase()}${mode.slice(1)}`
);

/**
 * Mobile equivalent of the details panel's transport picker.
 *
 * It works on the leg rather than on a travel item, because a generated trip
 * can hold two stays with no travel item between them at all: picking a mode
 * there has to create the leg, not silently do nothing.
 */
export const TripMobileTransportModal: React.FC<TripMobileTransportModalProps> = ({
    tripId,
    leg,
    onClose,
    onSetLegTransport,
}) => {
    const currentMode = leg?.item ? normalizeTransportMode(leg.mode) : null;

    const selectMode = useCallback((mode: TransportMode) => {
        if (!leg) return;
        const nextMode = normalizeTransportMode(mode);
        if (leg.item && nextMode === normalizeTransportMode(leg.mode)) {
            onClose();
            return;
        }

        trackEvent('trip_view__mobile_transport--change', {
            trip_id: tripId,
            item_id: leg.item?.id ?? 'new',
            mode: nextMode,
        });
        onSetLegTransport(
            {
                fromCityId: leg.fromCityId,
                toCityId: leg.toCityId,
                travelItemId: leg.item?.id ?? null,
            },
            nextMode,
        );
        onClose();
    }, [leg, onClose, onSetLegTransport, tripId]);

    const legLabel = [leg?.fromCityTitle, leg?.toCityTitle].filter(Boolean).join(' → ');

    return (
        <Drawer open={Boolean(leg)} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DrawerContent
                accessibleTitle="Change transport"
                accessibleDescription={`Choose how this leg${legLabel ? ` from ${legLabel}` : ''} is travelled.`}
                className="pb-[max(1rem,env(safe-area-inset-bottom))]"
            >
                <div className="px-4 pt-4" data-testid="mobile-transport-modal">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Transport
                    </p>
                    {legLabel && (
                        <p className="mt-1 truncate text-base font-semibold text-foreground">{legLabel}</p>
                    )}
                    {leg && !leg.item && (
                        <p className="mt-1 text-xs text-muted-foreground">
                            This journey has no transport yet. Pick one to add it.
                        </p>
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
                                            : 'border-border bg-card text-muted-foreground hover:border-border'
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
                        className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl px-4 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary"
                    >
                        Cancel
                    </button>
                </div>
            </DrawerContent>
        </Drawer>
    );
};
