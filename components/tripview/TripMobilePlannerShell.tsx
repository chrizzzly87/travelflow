import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, List, Rows3 } from 'lucide-react';

import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { buildMobileDayPlan, findMobileDayPlanIndexForItem } from './mobileDayPlanModel';
import { TripMobileDayPanel } from './TripMobileDayPanel';
import type { ITrip } from '../../types';

export type TripMobileSheetSnap = 'peek' | 'half' | 'full';

const SNAP_ORDER: TripMobileSheetSnap[] = ['peek', 'half', 'full'];

/** How far the map slides under the sheet's rounded top edge. */
const MAP_UNDERLAP_PX = 28;

/**
 * The sheet is sized as a share of the planner viewport rather than of `vh`:
 * the trip header and status banners already consume part of the screen, and a
 * `vh` sheet would overshoot them.
 */
const SNAP_HEIGHT: Record<TripMobileSheetSnap, string> = {
    peek: 'var(--tf-mobile-sheet-peek)',
    half: '58%',
    full: '100%',
};

const SNAP_LABEL: Record<TripMobileSheetSnap, string> = {
    peek: 'Days only',
    half: 'Half screen',
    full: 'Full screen',
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
}) => {
    const days = useMemo(
        () => buildMobileDayPlan(trip, { locale: appLanguage }),
        [appLanguage, trip],
    );

    const [snap, setSnap] = useState<TripMobileSheetSnap>('half');
    const [panelMode, setPanelMode] = useState<'days' | 'timeline'>('days');
    const [manualDayIndex, setManualDayIndex] = useState<number | null>(null);
    const dayStripRef = useRef<HTMLDivElement | null>(null);
    const sheetRef = useRef<HTMLElement | null>(null);
    const [sheetHeight, setSheetHeight] = useState(0);
    const dayButtonRefs = useRef<Record<number, HTMLButtonElement | null>>({});
    const contentRef = useRef<HTMLDivElement | null>(null);

    // Selection made anywhere else (a map marker, the details drawer) decides
    // which day is shown, so the panel never drifts away from the map.
    const selectionDayIndex = useMemo(
        () => findMobileDayPlanIndexForItem(days, selectedItemId),
        [days, selectedItemId],
    );
    const todayIndex = useMemo(() => days.findIndex((day) => day.isToday), [days]);
    const fallbackDayIndex = todayIndex >= 0 ? todayIndex : 0;
    const activeDayIndex = Math.min(
        Math.max(0, selectionDayIndex >= 0 ? selectionDayIndex : manualDayIndex ?? fallbackDayIndex),
        Math.max(0, days.length - 1),
    );
    const activeDay = days[activeDayIndex] ?? null;

    // The sheet height is a laid-out value the map needs as a number, and only
    // the browser can measure it, so it is read back through a ResizeObserver.
    useEffect(() => {
        const sheet = sheetRef.current;
        if (!sheet || typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(() => {
            setSheetHeight(Math.round(sheet.getBoundingClientRect().height));
        });
        observer.observe(sheet);
        setSheetHeight(Math.round(sheet.getBoundingClientRect().height));
        return () => {
            observer.disconnect();
        };
    }, []);

    // Keeping the active pill centred is a scroll side effect on a DOM node the
    // component does not otherwise own, so it stays in an effect.
    useEffect(() => {
        const button = dayButtonRefs.current[activeDayIndex];
        if (!button || !dayStripRef.current) return;
        if (typeof button.scrollIntoView !== 'function') return;
        button.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, [activeDayIndex]);

    useEffect(() => {
        const content = contentRef.current;
        if (!content || typeof content.scrollTo !== 'function') return;
        content.scrollTo({ top: 0 });
    }, [activeDayIndex, panelMode]);

    const stepSnap = useCallback((direction: 1 | -1) => {
        setSnap((current) => {
            const index = SNAP_ORDER.indexOf(current);
            const nextIndex = Math.min(SNAP_ORDER.length - 1, Math.max(0, index + direction));
            const next = SNAP_ORDER[nextIndex];
            if (next !== current) {
                trackEvent('trip_view__mobile_sheet--snap', { trip_id: tripId, snap: next });
            }
            return next;
        });
    }, [tripId]);

    const dragStartRef = useRef<{ y: number; snap: TripMobileSheetSnap } | null>(null);
    const handleDragStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
        const touch = event.touches[0];
        if (!touch) return;
        dragStartRef.current = { y: touch.clientY, snap };
    }, [snap]);
    const handleDragEnd = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
        const start = dragStartRef.current;
        dragStartRef.current = null;
        const touch = event.changedTouches[0];
        if (!start || !touch) return;
        const delta = start.y - touch.clientY;
        if (Math.abs(delta) < 32) return;
        stepSnap(delta > 0 ? 1 : -1);
    }, [stepSnap]);

    const handleSelectDay = useCallback((index: number) => {
        const day = days[index];
        setManualDayIndex(index);
        if (!day) return;
        trackEvent('trip_view__mobile_day--select', { trip_id: tripId, day_number: day.dayNumber });
        // Selecting the day's stay pans the map with the existing selection
        // pipeline instead of a second, parallel camera path.
        if (day.city) {
            onSelect(day.city.id, { isCity: true });
        }
    }, [days, onSelect, tripId]);

    return (
        <div
            className="relative h-full w-full overflow-hidden"
            style={{ '--tf-mobile-sheet-peek': '7.5rem' } as React.CSSProperties}
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
                className="absolute inset-x-0 top-0 bg-gray-100 transition-[bottom] duration-300 ease-out motion-reduce:transition-none"
                style={{ bottom: Math.max(0, sheetHeight - MAP_UNDERLAP_PX) }}
            >
                {mapNode}
            </div>

            <section
                ref={sheetRef}
                data-testid="planner-mobile-sheet"
                data-snap={snap}
                aria-label="Trip days"
                className="absolute inset-x-0 bottom-0 z-[60] flex flex-col overflow-hidden rounded-t-3xl border-t border-slate-200 bg-white shadow-[0_-12px_40px_rgba(15,23,42,0.18)] transition-[height] duration-300 ease-out motion-reduce:transition-none"
                style={{ height: SNAP_HEIGHT[snap] }}
            >
                <div
                    className="shrink-0 px-2 pt-1.5"
                    onTouchStart={handleDragStart}
                    onTouchEnd={handleDragEnd}
                >
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => stepSnap(-1)}
                            disabled={snap === 'peek'}
                            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 disabled:text-slate-300 disabled:hover:bg-transparent"
                            aria-label="Shrink day panel"
                            {...getAnalyticsDebugAttributes('trip_view__mobile_sheet--shrink', { trip_id: tripId })}
                        >
                            <ChevronDown size={18} />
                        </button>
                        <div className="flex flex-1 justify-center py-1.5" aria-hidden="true">
                            <span className="h-1.5 w-11 rounded-full bg-slate-300" />
                        </div>
                        <div className="inline-flex shrink-0 items-center rounded-full bg-slate-100 p-0.5">
                            <button
                                type="button"
                                onClick={() => setPanelMode('days')}
                                className={`inline-flex size-8 items-center justify-center rounded-full transition-colors ${panelMode === 'days' ? 'bg-white text-accent-600 shadow-sm' : 'text-slate-500'}`}
                                aria-label="Day by day"
                                aria-pressed={panelMode === 'days'}
                                {...getAnalyticsDebugAttributes('trip_view__mobile_panel--days', { trip_id: tripId })}
                            >
                                <Rows3 size={15} />
                            </button>
                            <button
                                type="button"
                                onClick={() => setPanelMode('timeline')}
                                className={`inline-flex size-8 items-center justify-center rounded-full transition-colors ${panelMode === 'timeline' ? 'bg-white text-accent-600 shadow-sm' : 'text-slate-500'}`}
                                aria-label="Full itinerary"
                                aria-pressed={panelMode === 'timeline'}
                                {...getAnalyticsDebugAttributes('trip_view__mobile_panel--timeline', { trip_id: tripId })}
                            >
                                <List size={15} />
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={() => stepSnap(1)}
                            disabled={snap === 'full'}
                            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 disabled:text-slate-300 disabled:hover:bg-transparent"
                            aria-label="Expand day panel"
                            {...getAnalyticsDebugAttributes('trip_view__mobile_sheet--expand', { trip_id: tripId })}
                        >
                            <ChevronUp size={18} />
                        </button>
                    </div>
                    <span className="sr-only" role="status" aria-live="polite">{SNAP_LABEL[snap]}</span>
                </div>

                {panelMode === 'days' && (
                    <div
                        ref={dayStripRef}
                        role="tablist"
                        aria-label="Trip days"
                        data-testid="planner-mobile-day-strip"
                        className="flex shrink-0 gap-2 overflow-x-auto overscroll-x-contain px-3 pb-2.5 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    >
                        {days.map((day, index) => {
                            const isActive = index === activeDayIndex;
                            return (
                                <button
                                    key={day.dayOffset}
                                    ref={(node) => {
                                        dayButtonRefs.current[index] = node;
                                    }}
                                    type="button"
                                    role="tab"
                                    aria-selected={isActive}
                                    onClick={() => handleSelectDay(index)}
                                    title={day.fullDateLabel}
                                    className={`relative flex size-14 shrink-0 flex-col items-center justify-center rounded-full border text-center transition-colors ${
                                        isActive
                                            ? 'border-transparent bg-accent-600 text-white shadow-md'
                                            : 'border-slate-200 bg-white text-slate-600'
                                    }`}
                                    {...getAnalyticsDebugAttributes('trip_view__mobile_day--select', {
                                        trip_id: tripId,
                                        day_number: day.dayNumber,
                                    })}
                                >
                                    <span className="text-[10px] font-semibold uppercase tracking-[0.1em] opacity-80">
                                        {day.weekdayLabel}
                                    </span>
                                    <span className="text-[15px] font-bold leading-tight tabular-nums">
                                        {day.dayOfMonthLabel}
                                    </span>
                                    {day.city && (
                                        <span
                                            aria-hidden="true"
                                            className={`absolute bottom-1.5 size-1.5 rounded-full ${isActive ? 'ring-1 ring-white/70' : ''}`}
                                            style={{ backgroundColor: day.cityColorHex || 'var(--tf-accent-500, #4f46e5)' }}
                                        />
                                    )}
                                    <span className="sr-only">{day.fullDateLabel}</span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {panelMode === 'timeline' && (
                    <div className="flex shrink-0 justify-end border-t border-slate-100 px-3 py-2">
                        {timelineControls}
                    </div>
                )}

                <div
                    ref={contentRef}
                    data-testid="planner-mobile-day-content"
                    className={`min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-slate-100 ${isPaywallLocked ? 'pointer-events-none select-none' : ''}`}
                >
                    {panelMode === 'timeline' ? (
                        <div className="relative h-full w-full">{timelineCanvas}</div>
                    ) : activeDay ? (
                        <TripMobileDayPanel
                            tripId={tripId}
                            day={activeDay}
                            selectedItemId={selectedItemId}
                            onSelect={onSelect}
                        />
                    ) : (
                        <p className="px-4 py-8 text-sm text-slate-500">This trip has no planned days yet.</p>
                    )}
                </div>
            </section>
        </div>
    );
};
