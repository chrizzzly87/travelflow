import React, { useCallback, useEffect, useRef } from 'react';

import { TransportModeIcon } from '../TransportModeIcon';
import { getAnalyticsDebugAttributes } from '../../services/analyticsService';
import {
    buildMobileDayStripNodes,
    type MobileDayPlanSegment,
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
    segments: MobileDayPlanSegment[];
    activeSegmentIndex: number;
    onSelectSegment: (index: number) => void;
    onSelectTransfer: (segmentIndex: number, transfer: MobileDayPlanTransfer) => void;
}

const resolveLinkColor = (link: MobileDayStripLink): string | null => {
    if (link.kind === 'none') return null;
    return link.kind === 'stay' ? (link.colorHex || DEFAULT_STAY_COLOR) : TRANSFER_LINK_COLOR;
};

/**
 * A circle is one city-day, so its ring is that stay's colour.
 */
const buildRingBackground = (colorHex: string): string => {
    const color = colorHex || DEFAULT_STAY_COLOR;
    return `linear-gradient(${color}, ${color})`;
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
    segments,
    activeSegmentIndex,
    onSelectSegment,
    onSelectTransfer,
}) => {
    const nodes = React.useMemo(() => buildMobileDayStripNodes(segments), [segments]);
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
        const button = dayButtonRefs.current[activeSegmentIndex];
        if (!button || typeof button.scrollIntoView !== 'function') return;
        button.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, [activeSegmentIndex]);

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
                    // A leg with no transport set still has to read as one: the
                    // node is how it gets given one, and an empty label made it
                    // look like decoration.
                    const durationLabel = transfer.durationLabel || 'n/a';
                    const scheduleLabel = [
                        transfer.departureTime ? `Departs ${transfer.departureTime}` : null,
                        transfer.durationLabel || 'duration not set',
                        transfer.arrivalTime ? `arrives ${transfer.arrivalTime}` : null,
                    ].filter(Boolean).join(' · ');
                    const modeLabel = transfer.item ? transfer.modeLabel : 'Transport not set';

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
                                    onClick={() => onSelectTransfer(node.segmentIndex, transfer)}
                                    title={`${modeLabel} to ${transfer.toCityTitle}${scheduleLabel ? ` — ${scheduleLabel}` : ''}`}
                                    className="relative z-10 inline-flex size-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 shadow-sm transition-colors hover:border-slate-400 hover:text-accent-600"
                                    {...getAnalyticsDebugAttributes('trip_view__mobile_transfer--select', {
                                        trip_id: tripId,
                                        mode: transfer.mode,
                                    })}
                                >
                                    <TransportModeIcon mode={transfer.mode as never} size={15} />
                                    <span className="sr-only">
                                        {`${modeLabel} to ${transfer.toCityTitle}${scheduleLabel ? `, ${scheduleLabel}` : ''}`}
                                    </span>
                                </button>
                            </div>
                            <span
                                data-testid="planner-mobile-transfer-duration"
                                className="flex h-7 flex-col items-center justify-start text-[10px] leading-[1.15] tabular-nums text-slate-400"
                            >
                                <span>{durationLabel}</span>
                                {transfer.arrivalTime && (
                                    <span className="font-semibold text-slate-500">{transfer.arrivalTime}</span>
                                )}
                            </span>
                        </div>
                    );
                }

                const { segment, segmentIndex } = node;
                const isActive = segmentIndex === activeSegmentIndex;
                const stayColor = segment.cityColorHex || DEFAULT_STAY_COLOR;
                // The ring is the city, the interior is the selection.
                const bubbleStyle: React.CSSProperties = {
                    borderColor: 'transparent',
                    background: buildBubbleBackground(
                        buildRingBackground(segment.cityColorHex),
                        isActive ? stayColor : BUBBLE_INTERIOR_COLOR,
                    ),
                };

                return (
                    <div key={node.key} className="flex w-[4.25rem] shrink-0 snap-center flex-col items-center">
                        <span className="h-4 text-[10px] font-semibold uppercase leading-4 tracking-[0.1em] text-slate-400">
                            {segment.isStayStart ? segment.monthLabel : ''}
                        </span>
                        <div className="relative flex h-14 w-full items-center justify-center">
                            <StripLink side="before" color={resolveLinkColor(node.linkBefore)} />
                            <StripLink side="after" color={resolveLinkColor(node.linkAfter)} />
                            <button
                                ref={(element) => {
                                    dayButtonRefs.current[segmentIndex] = element;
                                }}
                                type="button"
                                role="tab"
                                aria-selected={isActive}
                                onClick={() => onSelectSegment(segmentIndex)}
                                title={segment.stay?.title
                                    ? `${segment.fullDateLabel} — ${segment.stay.title}`
                                    : segment.fullDateLabel}
                                className={`relative z-10 flex size-12 items-center justify-center rounded-full border-2 p-[3px] text-center transition-[background-color,box-shadow] ${
                                    isActive ? 'shadow-lg' : ''
                                }`}
                                style={bubbleStyle}
                                {...getAnalyticsDebugAttributes('trip_view__mobile_day--select', {
                                    trip_id: tripId,
                                    day_number: segment.dayNumber,
                                })}
                            >
                                <span
                                    className={`flex size-full flex-col items-center justify-center rounded-full ${
                                        isActive ? 'text-white' : 'text-slate-700'
                                    }`}
                                >
                                    <span className={`text-[9px] font-semibold uppercase leading-none tracking-[0.08em] ${isActive ? 'text-white/80' : 'text-slate-400'}`}>
                                        {segment.weekdayLabel}
                                    </span>
                                    <span className="text-[15px] font-bold leading-tight tabular-nums">
                                        {segment.dayOfMonthLabel}
                                    </span>
                                </span>
                                <span className="sr-only">
                                    {segment.fullDateLabel}
                                    {segment.stay?.title ? `, ${segment.stay.title}` : ''}
                                </span>
                            </button>
                        </div>
                        <span className="flex h-7 items-start justify-center pt-0.5">
                            {segment.isToday && (
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
