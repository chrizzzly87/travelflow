import React, { useLayoutEffect, useState } from 'react';

import type { ITimelineItem } from '../../types';
import { isDayTrip, resolveActivityStay, resolveDayTripReturnStay } from '../../shared/activityStay';

export interface DayTripCalendarConnector {
    dayTripId: string;
    stayId: string;
    returnStayId: string | null;
    color: string;
}

/**
 * Which day trips to connect to their stay in the calendar. Lines only appear
 * for the selection — a selected day trip, or every day trip of a selected
 * stay — because a permanent line per day trip would cross the transfer lane
 * all over the calendar.
 */
export const buildDayTripCalendarConnectors = ({
    items,
    selectedItemId,
    selectedCityIds = [],
    resolveColor,
}: {
    items: ITimelineItem[];
    selectedItemId: string | null;
    selectedCityIds?: string[];
    resolveColor: (stay: ITimelineItem) => string;
}): DayTripCalendarConnector[] => {
    const cities = items.filter((item) => item.type === 'city');
    const selectedStayIds = new Set(selectedCityIds);
    if (selectedItemId && cities.some((city) => city.id === selectedItemId)) selectedStayIds.add(selectedItemId);

    return items.flatMap((item) => {
        if (!isDayTrip(item)) return [];
        const stay = resolveActivityStay(item, cities);
        if (!stay) return [];
        const returnStay = resolveDayTripReturnStay(item, cities);
        const returnStayId = returnStay && returnStay.id !== stay.id ? returnStay.id : null;
        const isSelected = item.id === selectedItemId
            || selectedStayIds.has(stay.id)
            || (returnStayId !== null && selectedStayIds.has(returnStayId));
        if (!isSelected) return [];
        return [{ dayTripId: item.id, stayId: stay.id, returnStayId, color: resolveColor(stay) }];
    });
};

interface ConnectorPath {
    key: string;
    d: string;
    color: string;
}

const cssEscape = (value: string): string => (
    typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(value) : value.replace(/"/g, '\\"')
);

/**
 * Dashed lines from a stay bar down to its day trips. Positions come from the
 * rendered blocks, since the city and activity lanes have no shared geometry;
 * measuring the DOM after layout is exactly the external sync an effect is for.
 */
export const DayTripCalendarConnectors: React.FC<{
    containerRef: React.RefObject<HTMLElement>;
    connectors: DayTripCalendarConnector[];
    /** Changes whenever block geometry may have moved (zoom, edits). */
    layoutKey: string;
}> = ({ containerRef, connectors, layoutKey }) => {
    const [paths, setPaths] = useState<ConnectorPath[]>([]);
    const connectorKey = connectors.map((connector) => `${connector.dayTripId}:${connector.stayId}:${connector.returnStayId ?? ''}:${connector.color}`).join('|');

    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container || connectors.length === 0) {
            setPaths([]);
            return undefined;
        }

        const measure = () => {
            const origin = container.getBoundingClientRect();
            const rectOf = (selector: string) => {
                const element = container.querySelector(selector);
                if (!element) return null;
                const rect = element.getBoundingClientRect();
                return {
                    left: rect.left - origin.left,
                    right: rect.right - origin.left,
                    top: rect.top - origin.top,
                    bottom: rect.bottom - origin.top,
                };
            };

            const next = connectors.flatMap((connector): ConnectorPath[] => {
                const block = rectOf(`[data-activity-id="${cssEscape(connector.dayTripId)}"]`);
                const stay = rectOf(`[data-city-id="${cssEscape(connector.stayId)}"]`);
                if (!block || !stay) return [];
                const blockX = (block.left + block.right) / 2;
                // Drop straight down from the stay bar; the block normally sits
                // inside the stay's days, but clamp so the line always starts on it.
                const stayX = Math.min(Math.max(blockX, stay.left + 6), stay.right - 6);
                const bend = Math.max(12, (block.top - stay.bottom) / 2);
                const out: ConnectorPath[] = [{
                    key: `${connector.dayTripId}:out`,
                    color: connector.color,
                    d: `M ${stayX} ${stay.bottom} C ${stayX} ${stay.bottom + bend}, ${blockX} ${block.top - bend}, ${blockX} ${block.top}`,
                }];
                if (connector.returnStayId) {
                    const returnStay = rectOf(`[data-city-id="${cssEscape(connector.returnStayId)}"]`);
                    if (returnStay) {
                        const fromX = Math.min(block.right - 4, blockX + 8);
                        const toX = Math.min(Math.max(fromX, returnStay.left + 6), returnStay.right - 6);
                        out.push({
                            key: `${connector.dayTripId}:return`,
                            color: connector.color,
                            d: `M ${fromX} ${block.top} C ${fromX} ${block.top - bend}, ${toX} ${returnStay.bottom + bend}, ${toX} ${returnStay.bottom}`,
                        });
                    }
                }
                return out;
            });
            setPaths(next);
        };

        measure();
        if (typeof ResizeObserver === 'undefined') return undefined;
        const observer = new ResizeObserver(measure);
        observer.observe(container);
        return () => observer.disconnect();
        // connectorKey stands in for `connectors`, which is a new array each render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [connectorKey, layoutKey, containerRef]);

    if (paths.length === 0) return null;
    return (
        <svg
            className="pointer-events-none absolute inset-0 z-[15] size-full overflow-visible"
            aria-hidden="true"
            data-day-trip-connectors="true"
        >
            {paths.map((path) => (
                <path
                    key={path.key}
                    d={path.d}
                    fill="none"
                    stroke={path.color}
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeDasharray="5 4"
                    strokeOpacity={0.9}
                />
            ))}
        </svg>
    );
};
