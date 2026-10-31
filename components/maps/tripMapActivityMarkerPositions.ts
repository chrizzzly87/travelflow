import type { ActivityType, ITimelineItem } from '../../types';
import { pickPrimaryActivityType } from '../../utils';
import { isFiniteLatLngLiteral } from '../../shared/coordinateUtils';
import { buildOverlappingMarkerPosition, buildTripMapCoordinateGroupKey } from './tripMapCityOverlayModel';
import { resolveActivityOwnerCity } from './tripMapCityFraming';

/**
 * Where each activity pin sits: its own coordinates or its stay's, fanned
 * out when several share a spot. Moved verbatim from `ItineraryMap.tsx`.
 */

export const ACTIVITY_MARKER_OVERLAP_RADIUS_METERS = 260;
export const ACTIVITY_CITY_FALLBACK_MIN_SLOTS = 4;
export const MARKER_COORDINATE_GROUP_PRECISION = 5;

export type ResolvedActivityMarker = {
    id: string;
    title: string;
    type: ActivityType;
    baseCoordinates: google.maps.LatLngLiteral;
    position: google.maps.LatLngLiteral;
    coordinateSource: 'activity' | 'city';
    /** Last day of the trip this activity occupies, for past-day fading. */
    endDayOffset: number;
};

export const resolveActivityMarkerPositions = (
    items: ITimelineItem[],
    skipActivityIds: ReadonlySet<string> = new Set(),
): ResolvedActivityMarker[] => {
    const cityItems = items
        .filter((item): item is ITimelineItem => item.type === 'city' && isFiniteLatLngLiteral(item.coordinates))
        .sort((left, right) => left.startDateOffset - right.startDateOffset);
    const activities = items
        .filter((item): item is ITimelineItem => item.type === 'activity')
        .sort((left, right) => {
            if (left.startDateOffset !== right.startDateOffset) return left.startDateOffset - right.startDateOffset;
            return left.title.localeCompare(right.title);
        });

    const candidates: Array<{
        id: string;
        title: string;
        type: ActivityType;
        baseCoordinates: google.maps.LatLngLiteral;
        coordinateSource: 'activity' | 'city';
        endDayOffset: number;
    }> = [];
    for (const activity of activities) {
        // Day trips with a destination get their own pin and route.
        if (skipActivityIds.has(activity.id)) continue;
        const activityCoordinates = isFiniteLatLngLiteral(activity.coordinates) ? activity.coordinates : null;
        const ownerCity = activityCoordinates ? null : resolveActivityOwnerCity(activity, cityItems);
        const baseCoordinates = activityCoordinates || ownerCity?.coordinates || null;
        if (!isFiniteLatLngLiteral(baseCoordinates)) continue;
        const primaryType = pickPrimaryActivityType(activity.activityType);
        candidates.push({
            id: activity.id,
            title: activity.title,
            type: primaryType,
            baseCoordinates,
            coordinateSource: activityCoordinates ? 'activity' : 'city',
            endDayOffset: activity.startDateOffset + Math.max(activity.duration, 0),
        });
    }

    const groupedByCoordinates = new Map<string, number[]>();
    candidates.forEach((candidate, index) => {
        const key = buildTripMapCoordinateGroupKey(candidate.baseCoordinates, MARKER_COORDINATE_GROUP_PRECISION);
        if (!key) return;
        const grouped = groupedByCoordinates.get(key) ?? [];
        grouped.push(index);
        groupedByCoordinates.set(key, grouped);
    });

    return candidates.map((candidate, index) => {
        const key = buildTripMapCoordinateGroupKey(candidate.baseCoordinates, MARKER_COORDINATE_GROUP_PRECISION);
        const grouped = key ? (groupedByCoordinates.get(key) ?? []) : [];
        const overlapIndex = Math.max(0, grouped.indexOf(index));
        const overlapCount = candidate.coordinateSource === 'city'
            ? Math.max(ACTIVITY_CITY_FALLBACK_MIN_SLOTS, grouped.length)
            : grouped.length;
        const position = buildOverlappingMarkerPosition(
            candidate.baseCoordinates,
            overlapIndex,
            overlapCount,
            ACTIVITY_MARKER_OVERLAP_RADIUS_METERS,
        );
        return {
            ...candidate,
            position,
        };
    });
};
