import type { ITimelineItem } from '../../types';
import { isFiniteLatLngLiteral } from '../../shared/coordinateUtils';
import { isDayTrip, resolveActivityStay, resolveDayTripReturnStay } from '../../shared/activityStay';

type LatLng = { lat: number; lng: number };

/**
 * A day trip as the map draws it: a pin at the destination and a dashed loop
 * from the stay out to it and back (or on to the stay the day ends at).
 *
 * Only day trips whose destination and stay both have a position qualify. One
 * without a destination position is still an activity pin at its stay — the
 * ordinary activity layer handles it, so nothing disappears from the map.
 */
export interface TripMapDayTripDescriptor {
    id: string;
    title: string;
    destinationLabel: string;
    destination: LatLng;
    stayId: string;
    stayColor: string;
    returnStayId: string;
    outboundPath: [LatLng, LatLng];
    returnPath: [LatLng, LatLng];
    /** Last day of the trip this outing occupies, for past-day fading. */
    endDayOffset: number;
}

const toLatLng = (value: { lat: number; lng: number }): LatLng => ({ lat: value.lat, lng: value.lng });

export const buildTripMapDayTripDescriptors = (items: ITimelineItem[]): TripMapDayTripDescriptor[] => {
    const cities = items
        .filter((item) => item.type === 'city' && isFiniteLatLngLiteral(item.coordinates))
        .sort((left, right) => left.startDateOffset - right.startDateOffset);
    if (cities.length === 0) return [];

    return items
        .filter((item) => isDayTrip(item) && isFiniteLatLngLiteral(item.coordinates))
        .sort((left, right) => left.startDateOffset - right.startDateOffset)
        .flatMap((item) => {
            const stay = resolveActivityStay(item, cities);
            if (!stay?.coordinates) return [];
            const returnStay = resolveDayTripReturnStay(item, cities) ?? stay;
            if (!returnStay.coordinates) return [];
            const destination = toLatLng(item.coordinates!);
            return [{
                id: item.id,
                title: item.title,
                destinationLabel: (item.location || item.title).split(',')[0].trim() || item.title,
                destination,
                stayId: stay.id,
                stayColor: stay.color,
                returnStayId: returnStay.id,
                outboundPath: [toLatLng(stay.coordinates), destination],
                returnPath: [destination, toLatLng(returnStay.coordinates)],
                endDayOffset: item.startDateOffset + Math.max(item.duration, 0),
            }];
        });
};

/** Ids the ordinary activity-pin layer must skip because the day-trip layer draws them. */
export const collectDayTripMarkerIds = (descriptors: TripMapDayTripDescriptor[]): Set<string> => (
    new Set(descriptors.map((descriptor) => descriptor.id))
);

/**
 * Whether the day trip's two legs retrace the same line. They do unless the
 * day ends at another stay, and then only one line is worth drawing.
 */
export const isDayTripRoundTrip = (descriptor: TripMapDayTripDescriptor): boolean => (
    descriptor.returnStayId === descriptor.stayId
);

const escapeHtml = (value: string): string => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const COMPASS_SVG = (size: number) => (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:${size}px;height:${size}px;display:block;" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">`
    + '<circle cx="12" cy="12" r="10"/>'
    + '<path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"/>'
    + '</svg>'
);

/**
 * Pin markup for a day-trip destination: a stay-coloured disc with a compass
 * and the destination name underneath. Shown at every zoom level, like a city,
 * because the whole point is to see where the outing goes.
 */
export const buildDayTripMarkerHtml = ({
    label,
    color,
    size,
    isSelected,
    selectedOutlineColor,
    showLabel = true,
}: {
    label: string;
    color: string;
    size: number;
    isSelected: boolean;
    selectedOutlineColor: string;
    showLabel?: boolean;
}): string => {
    const iconSize = Math.round(size * 0.58);
    const safeLabel = escapeHtml(label);
    const ring = isSelected
        ? `0 0 0 3px #ffffff, 0 0 0 5px ${selectedOutlineColor}`
        : '0 0 0 2px #ffffff, 0 2px 8px rgba(15,23,42,0.28)';
    const labelMarkup = showLabel && safeLabel
        ? `<div data-role="day-trip-marker-label" style="position:absolute;top:calc(100% + 4px);left:50%;transform:translateX(-50%);white-space:nowrap;pointer-events:none;background:rgba(255,255,255,0.94);color:#0f172a;border-radius:9999px;padding:2px 8px;font-size:11px;font-weight:600;line-height:1.35;box-shadow:0 2px 6px rgba(15,23,42,0.18);">${safeLabel}</div>`
        : '';
    return `
        <div data-day-trip-marker="true" style="position:relative;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;line-height:1;user-select:none;">
            <div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;border-radius:9999px;background:${color};color:#ffffff;box-shadow:${ring};">
                ${COMPASS_SVG(iconSize)}
            </div>
            ${labelMarkup}
        </div>
    `;
};
