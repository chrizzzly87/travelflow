import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronUp, List, Sparkles } from 'lucide-react';

import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import {
    buildMobileDayPlan,
    buildMobileDayPlanSegments,
    doesMobileDayPlanSegmentContainItem,
    findMobileDayPlanSegmentIndexForItem,
    type MobileDayPlanTransfer,
} from './mobileDayPlanModel';
import { TripMobileDayPanel } from './TripMobileDayPanel';
import { TripMobileDayStrip } from './TripMobileDayStrip';
import { TripMobileTransportModal } from './TripMobileTransportModal';
import type { ITimelineItem, ITrip } from '../../types';

/**
 * `hidden` is the snap that gives the map back. Without it the sheet floors at
 * `peek`, so a traveller who wants to see their whole journey has nowhere to
 * put the itinerary — and collapsing it kept the city selected anyway.
 */
export type TripMobileSheetSnap = 'hidden' | 'peek' | 'half' | 'full';

const SNAP_ORDER: TripMobileSheetSnap[] = ['hidden', 'peek', 'half', 'full'];

/** How far the map slides under the sheet's rounded top edge. */
const MAP_UNDERLAP_PX = 28;

/**
 * Snap sizes are a share of the planner viewport rather than of `vh`: the trip
 * header and status banners already consume part of the screen, and a `vh`
 * sheet would overshoot them.
 */
const SNAP_FRACTION: Record<TripMobileSheetSnap, number> = {
    hidden: 0,
    peek: 0,
    half: 0.58,
    full: 1,
};

/** Floor for the smallest snap, which has to fit the handle and the day strip. */
const PEEK_HEIGHT_PX = 168;

/** Just the drag handle, so the sheet can always be pulled back up. */
const HIDDEN_HEIGHT_PX = 34;

const SNAP_LABEL: Record<TripMobileSheetSnap, string> = {
    hidden: 'Map only',
    peek: 'Days only',
    half: 'Half screen',
    full: 'Full screen',
};

const resolveSnapHeightPx = (snap: TripMobileSheetSnap, containerHeight: number): number => {
    if (snap === 'hidden') return HIDDEN_HEIGHT_PX;
    if (containerHeight <= 0) return PEEK_HEIGHT_PX;
    return Math.max(PEEK_HEIGHT_PX, Math.round(containerHeight * SNAP_FRACTION[snap]));
};

const resolveNearestSnap = (heightPx: number, containerHeight: number): TripMobileSheetSnap => {
    let nearest: TripMobileSheetSnap = 'half';
    let smallestDistance = Number.POSITIVE_INFINITY;
    SNAP_ORDER.forEach((snap) => {
        const distance = Math.abs(resolveSnapHeightPx(snap, containerHeight) - heightPx);
        if (distance < smallestDistance) {
            smallestDistance = distance;
            nearest = snap;
        }
    });
    return nearest;
};

interface TripMobilePlannerShellProps {
    trip: ITrip;
    tripId: string;
    mapNode: React.ReactNode;
    mapViewportRef: React.RefObject<HTMLDivElement | null>;
    timelineCanvas: React.ReactNode;
    timelineControls: React.ReactNode;
    selectedItemId: string | null;
    onSelect: (id: string | null, options?: { multi?: boolean; isCity?: boolean }) => void;
    isPaywallLocked: boolean;
    appLanguage?: string;
    /** Absent when the trip is read-only, which hides the editing affordances. */
    onUpdateItem?: (itemId: string, patch: Partial<ITimelineItem>) => void;
    /** Writes a leg's transport, creating the travel item when it has none. */
    onSetLegTransport?: (
        leg: { fromCityId: string; toCityId: string; travelItemId: string | null },
        mode: string,
    ) => void;
    onAddActivity?: (dayOffset: number) => void;
    onOpenDiscover?: () => void;
}

export const TripMobilePlannerShell: React.FC<TripMobilePlannerShellProps> = ({
    trip,
    tripId,
    mapNode,
    mapViewportRef,
    timelineCanvas,
    timelineControls,
    selectedItemId,
    onSelect,
    isPaywallLocked,
    appLanguage,
    onUpdateItem,
    onSetLegTransport,
    onAddActivity,
    onOpenDiscover,
}) => {
    const days = useMemo(
        () => buildMobileDayPlan(trip, { locale: appLanguage }),
        [appLanguage, trip],
    );
    // The strip walks city-days, not days: a day the traveller moves on appears
    // once in the city being left and once in the one being reached.
    const segments = useMemo(() => buildMobileDayPlanSegments(days), [days]);

    const canEditTransport = Boolean(onSetLegTransport);

    const [snap, setSnap] = useState<TripMobileSheetSnap>('half');
    const [panelMode, setPanelMode] = useState<'days' | 'timeline'>('days');
    const [manualSegmentIndex, setManualSegmentIndex] = useState<number | null>(null);
    const [containerHeight, setContainerHeight] = useState(0);
    const [dragHeightPx, setDragHeightPx] = useState<number | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const contentRef = useRef<HTMLDivElement | null>(null);

    const todayIndex = useMemo(() => segments.findIndex((segment) => segment.isToday), [segments]);
    const fallbackSegmentIndex = todayIndex >= 0 ? todayIndex : 0;
    const activeSegmentIndex = Math.min(
        Math.max(0, manualSegmentIndex ?? fallbackSegmentIndex),
        Math.max(0, segments.length - 1),
    );
    const activeSegment = segments[activeSegmentIndex] ?? null;

    // A selection made elsewhere — a map marker, the timeline — moves the panel
    // to the day holding it. A selection the shown day already contains must
    // not: tapping the third day of a stay selects that stay's city, and
    // jumping to the first day it appears on took the traveller back a day and
    // made every day need two taps.
    useEffect(() => {
        if (!selectedItemId) return;
        if (activeSegment && doesMobileDayPlanSegmentContainItem(activeSegment, selectedItemId)) return;
        const index = findMobileDayPlanSegmentIndexForItem(segments, selectedItemId);
        if (index >= 0) setManualSegmentIndex(index);
    }, [activeSegment, segments, selectedItemId]);

    // Picking something on the map while the sheet is out of the way should
    // bring the sheet back, otherwise the tap looks like it did nothing.
    useEffect(() => {
        if (!selectedItemId) return;
        setSnap((current) => (current === 'hidden' ? 'half' : current));
    }, [selectedItemId]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container || typeof ResizeObserver === 'undefined') return;
        const measure = () => setContainerHeight(Math.round(container.getBoundingClientRect().height));
        const observer = new ResizeObserver(measure);
        observer.observe(container);
        measure();
        return () => {
            observer.disconnect();
        };
    }, []);

    useEffect(() => {
        const content = contentRef.current;
        if (!content || typeof content.scrollTo !== 'function') return;
        content.scrollTo({ top: 0 });
    }, [activeSegmentIndex, panelMode]);

    const sheetHeight = dragHeightPx ?? resolveSnapHeightPx(snap, containerHeight);
    // The leg the picker is open for, which is either a trip item or a leg that
    // has none yet — the second case is why the picker carries the transfer
    // rather than only an item id.
    const [transportEditLeg, setTransportEditLeg] = useState<MobileDayPlanTransfer | null>(null);

    const applySnap = useCallback((next: TripMobileSheetSnap) => {
        setSnap((current) => {
            if (current === next) return current;
            trackEvent('trip_view__mobile_sheet--snap', { trip_id: tripId, snap: next });
            return next;
        });
        // Getting the sheet out of the way means wanting the whole journey back,
        // so the selection goes with it. Leaving a city selected here was what
        // made a collapsed sheet feel stuck on one place.
        if (next === 'hidden') onSelect(null);
    }, [onSelect, tripId]);

    // One control, because the sheet only ever has one useful next state: grow
    // while there is room, and collapse straight back once it is full.
    const isFullyExpanded = snap === 'full';
    const toggleSheet = useCallback(() => {
        if (isFullyExpanded) {
            applySnap('peek');
            return;
        }
        applySnap(snap === 'peek' ? 'half' : 'full');
    }, [applySnap, isFullyExpanded, snap]);

    const dragRef = useRef<{ pointerId: number; startY: number; startHeight: number; moved: boolean } | null>(null);
    const handleDragStart = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (event.button !== undefined && event.button !== 0) return;
        // Capturing the pointer retargets the following pointerup, so the click
        // never reaches the control the gesture started on. The header carries
        // the Ideas button and the view toggles, and none of them fired.
        if ((event.target as Element | null)?.closest?.('button, a, input, [role="button"]')) return;
        dragRef.current = {
            pointerId: event.pointerId,
            startY: event.clientY,
            startHeight: sheetHeight,
            moved: false,
        };
        event.currentTarget.setPointerCapture?.(event.pointerId);
    }, [sheetHeight]);

    const handleDragMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        const delta = drag.startY - event.clientY;
        if (!drag.moved && Math.abs(delta) < 4) return;
        drag.moved = true;
        event.preventDefault();
        const maxHeight = containerHeight > 0 ? containerHeight : drag.startHeight + delta;
        setDragHeightPx(Math.max(PEEK_HEIGHT_PX, Math.min(maxHeight, drag.startHeight + delta)));
    }, [containerHeight]);

    const handleDragEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        dragRef.current = null;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
        if (!drag) return;
        const released = dragHeightPx;
        setDragHeightPx(null);
        if (!drag.moved || released === null) return;
        applySnap(resolveNearestSnap(released, containerHeight));
    }, [applySnap, containerHeight, dragHeightPx]);

    const handleSelectSegment = useCallback((index: number) => {
        const segment = segments[index];
        setManualSegmentIndex(index);
        if (!segment) return;
        trackEvent('trip_view__mobile_day--select', { trip_id: tripId, day_number: segment.dayNumber });
        // Selecting the segment's stay pans the map through the existing
        // selection pipeline instead of a second, parallel camera path.
        if (segment.city) {
            onSelect(segment.city.id, { isCity: true });
        }
    }, [onSelect, segments, tripId]);

    // The strip's transport node is the editing affordance: tapping it opens the
    // picker for that leg. Without editing rights it still selects the leg, so
    // the map and the day panel follow it.
    const handleSelectTransfer = useCallback((segmentIndex: number, transfer: MobileDayPlanTransfer) => {
        setManualSegmentIndex(segmentIndex);
        if (transfer.item) onSelect(transfer.item.id);
        if (!canEditTransport) return;
        trackEvent('trip_view__mobile_transport--open', {
            trip_id: tripId,
            mode: transfer.mode,
            has_item: Boolean(transfer.item),
        });
        setTransportEditLeg(transfer);
    }, [canEditTransport, onSelect, tripId]);

    return (
        <div
            ref={containerRef}
            className="relative h-full w-full overflow-hidden"
        >
            {/*
              * The map reads as a full-bleed background but its element stops
              * just under the sheet's rounded lip. Letting it run the whole
              * height instead made every camera fit frame the route into the
              * part the sheet covers, since fit padding cannot model an
              * overlay.
              */}
            <div
                ref={mapViewportRef}
                data-testid="planner-mobile-map-pane"
                className={`absolute inset-x-0 top-0 bg-secondary ${dragHeightPx === null ? 'transition-[bottom] duration-300 ease-out motion-reduce:transition-none' : ''}`}
                style={{ bottom: Math.max(0, sheetHeight - MAP_UNDERLAP_PX) }}
            >
                {mapNode}
            </div>

            <section
                data-testid="planner-mobile-sheet"
                data-snap={snap}
                aria-label="Trip days"
                className={`absolute inset-x-0 bottom-0 z-[60] flex touch-manipulation flex-col overflow-hidden rounded-t-3xl border-t border-border bg-card shadow-[0_-12px_40px_rgba(15,23,42,0.18)] ${dragHeightPx === null ? 'transition-[height] duration-300 ease-out motion-reduce:transition-none' : ''}`}
                style={{ height: sheetHeight }}
            >
                <div
                    data-testid="planner-mobile-sheet-handle"
                    onPointerDown={handleDragStart}
                    onPointerMove={handleDragMove}
                    onPointerUp={handleDragEnd}
                    onPointerCancel={handleDragEnd}
                    className="relative shrink-0 cursor-grab touch-none select-none px-2 pb-1 pt-2 active:cursor-grabbing"
                >
                    {/* Absolutely centred so it stays on the sheet's axis no
                      * matter how many controls sit beside it. */}
                    <span
                        aria-hidden="true"
                        className="absolute left-1/2 top-2.5 h-1.5 w-11 -translate-x-1/2 rounded-full bg-slate-300"
                    />
                    <div className="flex h-9 items-center justify-between">
                        <div className="inline-flex shrink-0 items-center rounded-full bg-secondary p-0.5">
                            <button
                                type="button"
                                onClick={() => setPanelMode('days')}
                                className={`inline-flex size-8 items-center justify-center rounded-full transition-colors ${panelMode === 'days' ? 'bg-card text-accent-600 shadow-sm' : 'text-muted-foreground'}`}
                                aria-label="Day by day"
                                aria-pressed={panelMode === 'days'}
                                {...getAnalyticsDebugAttributes('trip_view__mobile_panel--days', { trip_id: tripId })}
                            >
                                <CalendarDays size={15} />
                            </button>
                            <button
                                type="button"
                                onClick={() => setPanelMode('timeline')}
                                className={`inline-flex size-8 items-center justify-center rounded-full transition-colors ${panelMode === 'timeline' ? 'bg-card text-accent-600 shadow-sm' : 'text-muted-foreground'}`}
                                aria-label="Full itinerary"
                                aria-pressed={panelMode === 'timeline'}
                                {...getAnalyticsDebugAttributes('trip_view__mobile_panel--timeline', { trip_id: tripId })}
                            >
                                <List size={15} />
                            </button>
                        </div>
                        {onOpenDiscover && (
                            <button
                                type="button"
                                onClick={onOpenDiscover}
                                data-testid="mobile-open-discover"
                                className="ms-auto me-1 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-accent-200 bg-accent-50 px-3 text-xs font-semibold text-accent-700 transition-colors hover:bg-accent-100"
                                {...getAnalyticsDebugAttributes('trip_view__recommendations--open', { trip_id: tripId })}
                            >
                                <Sparkles size={14} />
                                Ideas
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={toggleSheet}
                            data-testid="planner-mobile-sheet-toggle"
                            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary"
                            aria-label={isFullyExpanded ? 'Collapse day panel' : 'Expand day panel'}
                            aria-expanded={isFullyExpanded}
                            {...getAnalyticsDebugAttributes('trip_view__mobile_sheet--toggle', { trip_id: tripId })}
                        >
                            {isFullyExpanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                        </button>
                    </div>
                    <span className="sr-only" role="status" aria-live="polite">{SNAP_LABEL[snap]}</span>
                </div>

                {panelMode === 'days' && (
                    <TripMobileDayStrip
                        tripId={tripId}
                        segments={segments}
                        activeSegmentIndex={activeSegmentIndex}
                        onSelectSegment={handleSelectSegment}
                        onSelectTransfer={handleSelectTransfer}
                    />
                )}

                {panelMode === 'timeline' && (
                    <div className="flex shrink-0 justify-end border-t border-border px-3 py-2">
                        {timelineControls}
                    </div>
                )}

                <div
                    ref={contentRef}
                    data-testid="planner-mobile-day-content"
                    className={`min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-border ${isPaywallLocked ? 'pointer-events-none select-none' : ''}`}
                >
                    {panelMode === 'timeline' ? (
                        <div className="relative h-full w-full">{timelineCanvas}</div>
                    ) : activeSegment ? (
                        <TripMobileDayPanel
                            tripId={tripId}
                            segment={activeSegment}
                            selectedItemId={selectedItemId}
                            onSelect={onSelect}
                            onEditTransport={canEditTransport ? setTransportEditLeg : undefined}
                            onAddActivity={onAddActivity}
                        />
                    ) : (
                        <p className="px-4 py-8 text-sm text-muted-foreground">This trip has no planned days yet.</p>
                    )}
                </div>
            </section>

            {onSetLegTransport && (
                <TripMobileTransportModal
                    tripId={tripId}
                    leg={transportEditLeg}
                    onClose={() => setTransportEditLeg(null)}
                    onSetLegTransport={onSetLegTransport}
                />
            )}
        </div>
    );
};
