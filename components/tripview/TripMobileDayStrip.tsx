import React, { useCallback, useEffect, useRef } from 'react';

import { TransportModeIcon } from '../TransportModeIcon';
import { getAnalyticsDebugAttributes } from '../../services/analyticsService';
import { buildMobileDayStripNodes, type MobileDayPlanDay, type MobileDayStripLink } from './mobileDayPlanModel';

const DEFAULT_STAY_COLOR = '#64748b';
const TRANSFER_LINK_COLOR = '#cbd5e1';
/** Pointer travel past which a drag is a scroll, not a tap. */
const DRAG_TAP_THRESHOLD_PX = 6;

interface TripMobileDayStripProps {
    tripId: string;
    days: MobileDayPlanDay[];
    activeDayIndex: number;
    onSelectDay: (index: number) => void;
    onSelectTransfer: (dayIndex: number, travelItemId: string | null) => void;
}

const resolveLinkColor = (link: MobileDayStripLink, stayColor: string): string | null => {
    if (link === 'none') return null;
    return link === 'stay' ? stayColor : TRANSFER_LINK_COLOR;
};

const StripLink: React.FC<{ side: 'before' | 'after'; color: string | null }> = ({ side, color }) => {
    if (!color) return null;
    return (
        <span
            aria-hidden="true"
            className={`absolute top-1/2 h-[3px] -translate-y-1/2 ${side === 'before' ? 'start-0 end-1/2' : 'start-1/2 end-0'}`}
            style={{ backgroundColor: color }}
        />
    );
};

export const TripMobileDayStrip: React.FC<TripMobileDayStripProps> = ({
    tripId,
    days,
    activeDayIndex,
    onSelectDay,
    onSelectTransfer,
}) => {
    const nodes = React.useMemo(() => buildMobileDayStripNodes(days), [days]);
    const scrollerRef = useRef<HTMLDivElement | null>(null);
    const dayButtonRefs = useRef<Record<number, HTMLButtonElement | null>>({});

    // Drag-to-scroll: a mouse cannot flick a touch scroller, so the strip is
    // dragged directly. `suppressClickRef` keeps the release from also firing
    // the button the drag happened to start on.
    const dragRef = useRef<{ pointerId: number; startX: number; startScrollLeft: number; moved: boolean } | null>(null);
    const suppressClickRef = useRef(false);

    const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (event.pointerType === 'touch') return; // Native touch scrolling is better than ours.
        const scroller = scrollerRef.current;
        if (!scroller || event.button !== 0) return;
        dragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startScrollLeft: scroller.scrollLeft,
            moved: false,
        };
        suppressClickRef.current = false;
    }, []);

    const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        const scroller = scrollerRef.current;
        if (!drag || !scroller || drag.pointerId !== event.pointerId) return;

        const deltaX = event.clientX - drag.startX;
        if (!drag.moved && Math.abs(deltaX) < DRAG_TAP_THRESHOLD_PX) return;

        if (!drag.moved) {
            drag.moved = true;
            suppressClickRef.current = true;
            // Snapping fights a drag in progress; it is restored on release.
            scroller.style.scrollSnapType = 'none';
            scroller.setPointerCapture?.(event.pointerId);
        }
        event.preventDefault();
        scroller.scrollLeft = drag.startScrollLeft - deltaX;
    }, []);

    const endDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        const scroller = scrollerRef.current;
        dragRef.current = null;
        if (!drag || !scroller) return;
        scroller.releasePointerCapture?.(event.pointerId);
        if (!drag.moved) return;
        scroller.style.scrollSnapType = '';
    }, []);

    // Centring the active pill is a scroll side effect on a node the component
    // does not otherwise own, so it stays in an effect.
    useEffect(() => {
        const button = dayButtonRefs.current[activeDayIndex];
        if (!button || typeof button.scrollIntoView !== 'function') return;
        button.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, [activeDayIndex]);

    const handleClickCapture = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        if (!suppressClickRef.current) return;
        suppressClickRef.current = false;
        event.preventDefault();
        event.stopPropagation();
    }, []);

    return (
        <div
            ref={scrollerRef}
            role="tablist"
            aria-label="Trip days"
            data-testid="planner-mobile-day-strip"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onClickCapture={handleClickCapture}
            className="flex shrink-0 snap-x snap-mandatory items-stretch overflow-x-auto overscroll-x-contain px-6 pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
            {nodes.map((node) => {
                if (node.kind === 'transfer') {
                    const { transfer } = node;
                    const scheduleLabel = [
                        transfer.departureTime ? `Departs ${transfer.departureTime}` : null,
                        transfer.durationLabel,
                        transfer.arrivalTime ? `arrives ${transfer.arrivalTime}` : null,
                    ].filter(Boolean).join(' · ');

                    return (
                        <div key={node.key} className="flex w-14 shrink-0 flex-col items-center">
                            <span className="h-4 text-[10px] font-semibold leading-4 tabular-nums text-slate-500">
                                {transfer.departureTime || ''}
                            </span>
                            <div className="relative flex h-14 w-full items-center justify-center">
                                <StripLink side="before" color={TRANSFER_LINK_COLOR} />
                                <StripLink side="after" color={TRANSFER_LINK_COLOR} />
                                <button
                                    type="button"
                                    onClick={() => onSelectTransfer(node.dayIndex, transfer.item?.id ?? null)}
                                    title={`${transfer.modeLabel} to ${transfer.toCityTitle}${scheduleLabel ? ` — ${scheduleLabel}` : ''}`}
                                    className="relative z-10 inline-flex size-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 shadow-sm transition-colors hover:border-slate-400 hover:text-accent-600"
                                    {...getAnalyticsDebugAttributes('trip_view__mobile_transfer--select', {
                                        trip_id: tripId,
                                        mode: transfer.mode,
                                    })}
                                >
                                    <TransportModeIcon mode={transfer.mode as never} size={15} />
                                    <span className="sr-only">
                                        {`${transfer.modeLabel} to ${transfer.toCityTitle}${scheduleLabel ? `, ${scheduleLabel}` : ''}`}
                                    </span>
                                </button>
                            </div>
                            <span className="flex h-7 flex-col items-center justify-start text-[10px] leading-[1.15] tabular-nums text-slate-400">
                                {transfer.durationLabel && <span>{transfer.durationLabel}</span>}
                                {transfer.arrivalTime && (
                                    <span className="font-semibold text-slate-500">{transfer.arrivalTime}</span>
                                )}
                            </span>
                        </div>
                    );
                }

                const { day, dayIndex } = node;
                const isActive = dayIndex === activeDayIndex;
                const stayColor = day.cityColorHex || DEFAULT_STAY_COLOR;

                return (
                    <div key={node.key} className="flex w-[4.25rem] shrink-0 snap-center flex-col items-center">
                        <span className="h-4 text-[10px] font-semibold uppercase leading-4 tracking-[0.1em] text-slate-400">
                            {day.isArrivalDay ? day.monthLabel : ''}
                        </span>
                        <div className="relative flex h-14 w-full items-center justify-center">
                            <StripLink side="before" color={resolveLinkColor(node.linkBefore, stayColor)} />
                            <StripLink side="after" color={resolveLinkColor(node.linkAfter, stayColor)} />
                            <button
                                ref={(element) => {
                                    dayButtonRefs.current[dayIndex] = element;
                                }}
                                type="button"
                                role="tab"
                                aria-selected={isActive}
                                onClick={() => onSelectDay(dayIndex)}
                                title={day.fullDateLabel}
                                className={`relative z-10 flex size-12 flex-col items-center justify-center rounded-full border-2 text-center transition-[background-color,box-shadow] ${
                                    isActive ? 'text-white shadow-lg' : 'bg-white text-slate-700'
                                }`}
                                style={{
                                    borderColor: stayColor,
                                    backgroundColor: isActive ? stayColor : undefined,
                                }}
                                {...getAnalyticsDebugAttributes('trip_view__mobile_day--select', {
                                    trip_id: tripId,
                                    day_number: day.dayNumber,
                                })}
                            >
                                <span className={`text-[9px] font-semibold uppercase leading-none tracking-[0.08em] ${isActive ? 'text-white/80' : 'text-slate-400'}`}>
                                    {day.weekdayLabel}
                                </span>
                                <span className="text-[15px] font-bold leading-tight tabular-nums">
                                    {day.dayOfMonthLabel}
                                </span>
                                <span className="sr-only">{day.fullDateLabel}</span>
                            </button>
                        </div>
                        <span className="flex h-7 items-start justify-center pt-0.5">
                            {day.isToday && (
                                <span className="rounded-full bg-accent-50 px-1.5 py-px text-[9px] font-bold uppercase tracking-[0.08em] text-accent-700">
                                    Today
                                </span>
                            )}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};
