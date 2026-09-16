import React, { useCallback, useEffect, useRef } from 'react';

import { TransportModeIcon } from '../TransportModeIcon';
import { getAnalyticsDebugAttributes } from '../../services/analyticsService';
import {
    buildMobileDayStripNodes,
    type MobileDayPlanDay,
    type MobileDayPlanTransfer,
    type MobileDayStripLink,
} from './mobileDayPlanModel';

const DEFAULT_STAY_COLOR = '#64748b';
const TRANSFER_LINK_COLOR = '#cbd5e1';
const BUBBLE_INTERIOR_COLOR = '#ffffff';
/** Pointer travel past which a drag is a scroll, not a tap. */
const DRAG_TAP_THRESHOLD_PX = 6;

interface TripMobileDayStripProps {
    tripId: string;
    days: MobileDayPlanDay[];
    activeDayIndex: number;
    onSelectDay: (index: number) => void;
    onSelectTransfer: (dayIndex: number, transfer: MobileDayPlanTransfer) => void;
}

const resolveLinkColor = (link: MobileDayStripLink): string | null => {
    if (link.kind === 'none') return null;
    return link.kind === 'stay' ? (link.colorHex || DEFAULT_STAY_COLOR) : TRANSFER_LINK_COLOR;
};

/**
 * Paints the day's ring from the stays it touches.
 *
 * A day spent in one city is a plain ring; a day the traveller moves through
 * is split into an equal arc per stay, in travel order, so a move inside a day
 * is legible without reading the labels. The gradient runs along the strip, so
 * it has to follow the document direction the same way the strip itself does.
 */
const buildRingBackground = (stays: MobileDayPlanDay['stays'], isRtl: boolean): string => {
    const colors = (stays.length > 0 ? stays : [{ colorHex: '' }])
        .map((stay) => stay.colorHex || DEFAULT_STAY_COLOR);
    if (colors.length === 1) return `linear-gradient(${colors[0]}, ${colors[0]})`;

    const stops = colors.map((color, index) => {
        const from = Math.round((index / colors.length) * 1000) / 10;
        const to = Math.round(((index + 1) / colors.length) * 1000) / 10;
        return `${color} ${from}% ${to}%`;
    });
    return `linear-gradient(to ${isRtl ? 'left' : 'right'}, ${stops.join(', ')})`;
};

/**
 * The ring is drawn as a gradient on the border box over an opaque interior on
 * the padding box. A bare border left the ring's inner gap transparent, and the
 * strip's connecting line ran straight through the circle.
 */
const buildBubbleBackground = (ring: string, interior: string): string => (
    `linear-gradient(${interior}, ${interior}) padding-box, ${ring} border-box`
);

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
    const isRtl = typeof document !== 'undefined' && document.documentElement.dir === 'rtl';
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
            className="flex shrink-0 touch-manipulation snap-x snap-mandatory items-stretch overflow-x-auto overscroll-x-contain px-6 pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
                                    data-testid="planner-mobile-transfer-node"
                                    onClick={() => onSelectTransfer(node.dayIndex, transfer)}
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
                // The interior carries the selection, the ring carries the
                // stays: one colour on an ordinary day, an arc each on a day
                // the traveller moves through.
                const bubbleStyle: React.CSSProperties = {
                    borderColor: 'transparent',
                    background: buildBubbleBackground(
                        buildRingBackground(day.stays, isRtl),
                        isActive ? stayColor : BUBBLE_INTERIOR_COLOR,
                    ),
                };

                return (
                    <div key={node.key} className="flex w-[4.25rem] shrink-0 snap-center flex-col items-center">
                        <span className="h-4 text-[10px] font-semibold uppercase leading-4 tracking-[0.1em] text-slate-400">
                            {day.isArrivalDay ? day.monthLabel : ''}
                        </span>
                        <div className="relative flex h-14 w-full items-center justify-center">
                            <StripLink side="before" color={resolveLinkColor(node.linkBefore)} />
                            <StripLink side="after" color={resolveLinkColor(node.linkAfter)} />
                            <button
                                ref={(element) => {
                                    dayButtonRefs.current[dayIndex] = element;
                                }}
                                type="button"
                                role="tab"
                                aria-selected={isActive}
                                onClick={() => onSelectDay(dayIndex)}
                                title={day.fullDateLabel}
                                className={`relative z-10 flex size-12 items-center justify-center rounded-full border-2 p-[3px] text-center transition-[background-color,box-shadow] ${
                                    isActive ? 'shadow-lg' : ''
                                }`}
                                style={bubbleStyle}
                                {...getAnalyticsDebugAttributes('trip_view__mobile_day--select', {
                                    trip_id: tripId,
                                    day_number: day.dayNumber,
                                })}
                            >
                                <span
                                    className={`flex size-full flex-col items-center justify-center rounded-full ${
                                        isActive ? 'text-white' : 'text-slate-700'
                                    }`}
                                >
                                    <span className={`text-[9px] font-semibold uppercase leading-none tracking-[0.08em] ${isActive ? 'text-white/80' : 'text-slate-400'}`}>
                                        {day.weekdayLabel}
                                    </span>
                                    <span className="text-[15px] font-bold leading-tight tabular-nums">
                                        {day.dayOfMonthLabel}
                                    </span>
                                </span>
                                <span className="sr-only">
                                    {day.fullDateLabel}
                                    {day.stays.length > 1
                                        ? `, ${day.stays.map((stay) => stay.title).filter(Boolean).join(' to ')}`
                                        : ''}
                                </span>
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
