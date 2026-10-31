import type { ITimelineItem } from '../types';
import { normalizeTransportMode } from '../shared/transportModes';
import { resolveExplicitActivityStay } from '../shared/activityStay';
import { getDistanceKm } from '../shared/distance';
import { TRAVEL_EMPTY_COLOR } from '../shared/cityColors';
import { getTimelineVisualRange } from './timelineVisualLayout';

export const BASE_PIXELS_PER_DAY = 120; // Width of one day column (Base Zoom 1.0)
export const PIXELS_PER_DAY = BASE_PIXELS_PER_DAY; // Deprecated: Use prop passed from parent for zooming

export interface TimelineBounds {
    startOffset: number;
    endOffset: number;
    dayCount: number;
}

export interface CityOverlapLayoutSlot {
    stackIndex: number;
    stackCount: number;
}

export interface HorizontalTransferLaneInput {
    id: string;
    centerX: number;
    preferredWidth: number;
    minWidth?: number;
    maxWidth?: number;
}

export interface HorizontalTransferLanePlacement {
    id: string;
    centerX: number;
    chipLeft: number;
    chipWidth: number;
    laneIndex: number;
    laneCount: number;
}

export interface VerticalTransferConnectorAnchorOptions {
    cityEdgeInsetPx?: number;
    edgeGapPx?: number;
    minSeparationPx?: number;
}

export interface VerticalTransferConnectorAnchors {
    fromY: number;
    toY: number;
    connectorTop: number;
    connectorBottom: number;
    connectorHeight: number;
}

export const getTimelineBounds = (
    items: ITimelineItem[],
    options: { minDays?: number } = {}
): TimelineBounds => {
    const minDays = Math.max(1, Math.floor(options.minDays ?? 1));
    const visualRange = getTimelineVisualRange(items);

    if (!visualRange) {
        return {
            startOffset: 0,
            endOffset: minDays,
            dayCount: minDays,
        };
    }

    const startOffset = Math.floor(visualRange.startOffset);
    const endOffset = Math.max(startOffset + minDays, Math.ceil(visualRange.endOffset));

    return {
        startOffset,
        endOffset,
        dayCount: endOffset - startOffset,
    };
};

const CITY_OVERLAP_EPSILON = 0.0001;
const CITY_ROUTE_EPSILON = 0.0001;

const getCityRouteOptionIndex = (city: ITimelineItem): number => {
    if (typeof city.cityPlanOptionIndex === 'number' && Number.isFinite(city.cityPlanOptionIndex)) {
        return Math.max(0, Math.floor(city.cityPlanOptionIndex));
    }
    return Number.MAX_SAFE_INTEGER;
};

const compareCityRouteOrder = (a: ITimelineItem, b: ITimelineItem): number => {
    if (a.startDateOffset !== b.startDateOffset) return a.startDateOffset - b.startDateOffset;
    if (a.duration !== b.duration) return b.duration - a.duration;
    const optionDelta = getCityRouteOptionIndex(a) - getCityRouteOptionIndex(b);
    if (optionDelta !== 0) return optionDelta;
    return a.id.localeCompare(b.id);
};

const pickFirstCityRouteOrder = (cities: ITimelineItem[]): ITimelineItem | null => {
    if (cities.length === 0) return null;
    return cities.reduce((winner, city) => (
        compareCityRouteOrder(city, winner) < 0 ? city : winner
    ));
};

const pickCityRouteComponentWinner = (componentCities: ITimelineItem[]): ITimelineItem | null => {
    if (componentCities.length === 0) return null;

    const explicitApproved = componentCities.filter((city) => city.isApproved === true);
    if (explicitApproved.length > 0) {
        return pickFirstCityRouteOrder(explicitApproved);
    }

    const confirmed = componentCities.filter((city) => (city.cityPlanStatus || 'confirmed') !== 'uncertain');
    if (confirmed.length > 0) {
        return pickFirstCityRouteOrder(confirmed);
    }

    return pickFirstCityRouteOrder(componentCities);
};

export const buildCityOverlapLayout = (
    cityItems: ITimelineItem[]
): Map<string, CityOverlapLayoutSlot> => {
    const layout = new Map<string, CityOverlapLayoutSlot>();
    if (!Array.isArray(cityItems) || cityItems.length === 0) return layout;

    const sortedCities = [...cityItems]
        .filter((item) => item.type === 'city')
        .sort((a, b) => {
            if (a.startDateOffset === b.startDateOffset) {
                return b.duration - a.duration;
            }
            return a.startDateOffset - b.startDateOffset;
        });

    if (sortedCities.length === 0) return layout;

    const laneEnds: number[] = [];
    const laneByCityId = new Map<string, number>();
    const componentByCityId = new Map<string, number>();
    const componentLaneCount = new Map<number, number>();

    let currentComponentId = 0;
    let currentComponentMaxEnd = Number.NEGATIVE_INFINITY;

    sortedCities.forEach((city) => {
        const start = city.startDateOffset;
        const end = city.startDateOffset + Math.max(0, city.duration);

        const startsNewComponent = start >= (currentComponentMaxEnd - CITY_OVERLAP_EPSILON);
        if (startsNewComponent) {
            currentComponentId += 1;
            currentComponentMaxEnd = end;
            laneEnds.length = 0;
        } else {
            currentComponentMaxEnd = Math.max(currentComponentMaxEnd, end);
        }

        let laneIndex = laneEnds.findIndex((laneEnd) => laneEnd <= (start + CITY_OVERLAP_EPSILON));
        if (laneIndex < 0) {
            laneIndex = laneEnds.length;
            laneEnds.push(end);
        } else {
            laneEnds[laneIndex] = end;
        }

        laneByCityId.set(city.id, laneIndex);
        componentByCityId.set(city.id, currentComponentId);
        componentLaneCount.set(
            currentComponentId,
            Math.max(componentLaneCount.get(currentComponentId) || 1, laneIndex + 1)
        );
    });

    sortedCities.forEach((city) => {
        const componentId = componentByCityId.get(city.id) || 1;
        layout.set(city.id, {
            stackIndex: laneByCityId.get(city.id) || 0,
            stackCount: componentLaneCount.get(componentId) || 1,
        });
    });

    return layout;
};

export const buildApprovedCityRoute = (cityItems: ITimelineItem[]): ITimelineItem[] => {
    const approvedCities = [...cityItems]
        .filter((item) => item.type === 'city' && item.isApproved !== false)
        .sort(compareCityRouteOrder);

    if (approvedCities.length === 0) return [];

    const route: ITimelineItem[] = [];
    let componentCities: ITimelineItem[] = [];
    let componentMaxEnd = Number.NEGATIVE_INFINITY;

    const flushComponent = () => {
        const winner = pickCityRouteComponentWinner(componentCities);
        if (winner) route.push(winner);
        componentCities = [];
        componentMaxEnd = Number.NEGATIVE_INFINITY;
    };

    approvedCities.forEach((city) => {
        const start = city.startDateOffset;
        const end = city.startDateOffset + Math.max(0, city.duration);

        if (componentCities.length === 0) {
            componentCities.push(city);
            componentMaxEnd = end;
            return;
        }

        if (start < (componentMaxEnd - CITY_ROUTE_EPSILON)) {
            componentCities.push(city);
            componentMaxEnd = Math.max(componentMaxEnd, end);
            return;
        }

        flushComponent();
        componentCities.push(city);
        componentMaxEnd = end;
    });

    flushComponent();

    return route.sort(compareCityRouteOrder);
};

export const buildHorizontalTransferLaneLayout = (
    inputs: HorizontalTransferLaneInput[],
    options: { laneCollisionGap?: number } = {}
): HorizontalTransferLanePlacement[] => {
    const laneCollisionGap = Math.max(0, options.laneCollisionGap ?? 6);
    const normalized = inputs
        .map((input, index) => {
            if (!input.id || !Number.isFinite(input.centerX) || !Number.isFinite(input.preferredWidth)) return null;

            const minWidth = Math.max(6, Number.isFinite(input.minWidth) ? (input.minWidth as number) : 6);
            const maxWidthCandidate = Number.isFinite(input.maxWidth) ? (input.maxWidth as number) : input.preferredWidth;
            const maxWidth = Math.max(minWidth, maxWidthCandidate);
            const clampedWidth = Math.min(maxWidth, Math.max(minWidth, input.preferredWidth));
            const chipLeft = input.centerX - (clampedWidth / 2);

            return {
                index,
                id: input.id,
                centerX: input.centerX,
                chipLeft,
                chipWidth: clampedWidth,
                chipRight: chipLeft + clampedWidth,
            };
        })
        .filter((entry): entry is {
            index: number;
            id: string;
            centerX: number;
            chipLeft: number;
            chipWidth: number;
            chipRight: number;
        } => !!entry);

    if (normalized.length === 0) return [];

    const ordered = Array.from(normalized).sort((a, b) => {
        if (a.chipLeft !== b.chipLeft) return a.chipLeft - b.chipLeft;
        if (a.centerX !== b.centerX) return a.centerX - b.centerX;
        return a.index - b.index;
    });

    const laneEndByIndex: number[] = [];
    const laneByInputId = new Map<string, number>();

    ordered.forEach((entry) => {
        let laneIndex = -1;
        for (let i = 0; i < laneEndByIndex.length; i += 1) {
            if (entry.chipLeft >= (laneEndByIndex[i] + laneCollisionGap)) {
                laneIndex = i;
                break;
            }
        }

        if (laneIndex < 0) {
            laneIndex = laneEndByIndex.length;
            laneEndByIndex.push(entry.chipRight);
        } else {
            laneEndByIndex[laneIndex] = entry.chipRight;
        }

        laneByInputId.set(entry.id, laneIndex);
    });

    const laneCount = Math.max(1, laneEndByIndex.length);
    return normalized.map((entry) => ({
        id: entry.id,
        centerX: entry.centerX,
        chipLeft: entry.chipLeft,
        chipWidth: entry.chipWidth,
        laneIndex: laneByInputId.get(entry.id) || 0,
        laneCount,
    }));
};

export const computeVerticalTransferConnectorAnchors = (
    fromBoundaryY: number,
    toBoundaryY: number,
    totalHeight: number,
    options: VerticalTransferConnectorAnchorOptions = {}
): VerticalTransferConnectorAnchors => {
    const cityEdgeInsetPx = Math.max(0, options.cityEdgeInsetPx ?? 4);
    const edgeGapPx = Math.max(0, options.edgeGapPx ?? 1.5);
    const minSeparationPx = Math.max(0, options.minSeparationPx ?? 5);
    const safeTotalHeight = Number.isFinite(totalHeight) ? Math.max(0, totalHeight) : 0;
    const direction = fromBoundaryY <= toBoundaryY ? 1 : -1;

    const fromCityEdgeY = fromBoundaryY - (direction * cityEdgeInsetPx);
    const toCityEdgeY = toBoundaryY + (direction * cityEdgeInsetPx);

    let fromAnchorY = fromCityEdgeY + (direction * edgeGapPx);
    let toAnchorY = toCityEdgeY - (direction * edgeGapPx);
    const signedSeparation = (toAnchorY - fromAnchorY) * direction;
    if (signedSeparation < minSeparationPx) {
        const midpoint = (fromAnchorY + toAnchorY) / 2;
        const halfMinSeparation = minSeparationPx / 2;
        fromAnchorY = midpoint - (direction * halfMinSeparation);
        toAnchorY = midpoint + (direction * halfMinSeparation);
    }

    let low = Math.min(fromAnchorY, toAnchorY);
    let high = Math.max(fromAnchorY, toAnchorY);
    if (low < 0) {
        const delta = -low;
        fromAnchorY += delta;
        toAnchorY += delta;
        low = 0;
        high += delta;
    }
    if (high > safeTotalHeight) {
        const delta = high - safeTotalHeight;
        fromAnchorY -= delta;
        toAnchorY -= delta;
        low = Math.min(fromAnchorY, toAnchorY);
        high = safeTotalHeight;
    }

    const clampY = (value: number): number => Math.max(0, Math.min(safeTotalHeight, value));
    const fromY = clampY(fromAnchorY);
    const toY = clampY(toAnchorY);
    const connectorTop = Math.min(fromY, toY);
    const connectorBottom = Math.max(fromY, toY);
    const connectorHeight = Math.max(4, connectorBottom - connectorTop);

    return { fromY, toY, connectorTop, connectorBottom, connectorHeight };
};

export const findTravelBetweenCities = (
    items: ITimelineItem[],
    fromCity: ITimelineItem,
    toCity: ITimelineItem
): ITimelineItem | null => {
    const fromEnd = fromCity.startDateOffset + fromCity.duration;
    const toStart = toCity.startDateOffset;
    const windowStart = Math.min(fromEnd, toStart) - 0.6;
    const windowEnd = Math.max(fromEnd, toStart) + 0.6;

    const candidates = items.filter(i =>
        (i.type === 'travel' || i.type === 'travel-empty') &&
        i.startDateOffset >= windowStart &&
        i.startDateOffset <= windowEnd
    );

    if (candidates.length === 0) return null;

    return candidates.reduce((nearest, candidate) => {
        const nearestDistance = Math.abs(nearest.startDateOffset - fromEnd);
        const candidateDistance = Math.abs(candidate.startDateOffset - fromEnd);
        return candidateDistance < nearestDistance ? candidate : nearest;
    });
};

export interface TravelLegMetrics {
    travelItem: ITimelineItem;
    fromCity: ITimelineItem;
    toCity: ITimelineItem;
    distanceKm: number | null;
}

export const getTravelLegMetrics = (items: ITimelineItem[]): TravelLegMetrics[] => {
    const cities = items
        .filter(item => item.type === 'city')
        .sort((a, b) => a.startDateOffset - b.startDateOffset);

    const legs: TravelLegMetrics[] = [];
    for (let i = 0; i < cities.length - 1; i++) {
        const fromCity = cities[i];
        const toCity = cities[i + 1];
        const travelItem = findTravelBetweenCities(items, fromCity, toCity);
        if (!travelItem) continue;
        const distanceKm = fromCity.coordinates && toCity.coordinates
            ? getDistanceKm(fromCity.coordinates, toCity.coordinates)
            : null;
        legs.push({ travelItem, fromCity, toCity, distanceKm });
    }

    return legs;
};

export const getTravelLegMetricsForItem = (
    items: ITimelineItem[],
    travelItemId: string
): TravelLegMetrics | null => {
    const legs = getTravelLegMetrics(items);
    return legs.find(leg => leg.travelItem.id === travelItemId) || null;
};

export const getTripDistanceKm = (items: ITimelineItem[]): number => {
    return getTravelLegMetrics(items)
        .map((leg) => {
            const airDistance = leg.distanceKm;
            if (!Number.isFinite(airDistance)) return null;

            const mode = normalizeTransportMode(leg.travelItem.transportMode);
            const routeDistance = leg.travelItem.routeDistanceKm;

            if (mode === 'plane') return airDistance;
            if (Number.isFinite(routeDistance)) return routeDistance as number;
            return airDistance;
        })
        .filter((distance): distance is number => Number.isFinite(distance))
        .reduce((sum, distance) => sum + distance, 0);
};

const isTravelItem = (item: ITimelineItem): boolean =>
    item.type === 'travel' || item.type === 'travel-empty';

const cityPairKey = (fromId: string, toId: string): string => `${fromId}->${toId}`;

/**
 * Removes a timeline item. When the removed item is a city, also removes the
 * items that are positionally linked to it and would otherwise be orphaned:
 * - the travel segments on its inbound/outbound boundaries (travel items are
 *   linked to city pairs positionally via `findTravelBetweenCities`),
 * - the activities whose start offset falls inside the city's day window
 *   (the same ownership rule `reorderSelectedCities` uses to move activities
 *   with their city),
 * - all travel items when the last remaining city is removed (no city pair
 *   can exist anymore).
 * Non-city items are removed without side effects.
 */
export const removeTimelineItemWithLinkedItems = (
    items: ITimelineItem[],
    id: string
): ITimelineItem[] => {
    const target = items.find(item => item.id === id);
    if (!target) return items;
    if (target.type !== 'city') {
        return items.filter(item => item.id !== id);
    }

    const idsToRemove = new Set<string>([id]);

    const cities = items
        .filter(item => item.type === 'city')
        .sort((a, b) => a.startDateOffset - b.startDateOffset);
    const cityIndex = cities.findIndex(city => city.id === id);
    const previousCity = cityIndex > 0 ? cities[cityIndex - 1] : null;
    const nextCity = cityIndex >= 0 && cityIndex < cities.length - 1 ? cities[cityIndex + 1] : null;

    if (cities.length <= 1) {
        items.forEach(item => {
            if (isTravelItem(item)) idsToRemove.add(item.id);
        });
    } else {
        if (previousCity) {
            const inboundTravel = findTravelBetweenCities(items, previousCity, target);
            if (inboundTravel) idsToRemove.add(inboundTravel.id);
        }
        if (nextCity) {
            const outboundTravel = findTravelBetweenCities(items, target, nextCity);
            if (outboundTravel) idsToRemove.add(outboundTravel.id);
        }
    }

    const epsilon = 0.00001;
    const cityItemsForStay = items.filter(item => item.type === 'city');
    const cityStart = target.startDateOffset;
    const cityEnd = target.startDateOffset + target.duration;
    items.forEach(item => {
        if (item.type !== 'activity') return;
        const explicitStay = resolveExplicitActivityStay(item, cityItemsForStay);
        if (explicitStay) {
            if (explicitStay.id === target.id) idsToRemove.add(item.id);
            return;
        }
        if (item.startDateOffset >= (cityStart - epsilon) && item.startDateOffset < (cityEnd - epsilon)) {
            idsToRemove.add(item.id);
        }
    });

    return items.filter(item => !idsToRemove.has(item.id));
};

export const reorderSelectedCities = (
    items: ITimelineItem[],
    selectedCityIds: string[],
    desiredSelectedOrder: string[]
): ITimelineItem[] => {
    const cityItems = items
        .filter(item => item.type === 'city')
        .sort((a, b) => a.startDateOffset - b.startDateOffset);

    if (cityItems.length < 2) return items;

    const selectedSet = new Set(selectedCityIds);
    if (selectedSet.size < 2) return items;

    const selectedInTimeline = cityItems.filter(city => selectedSet.has(city.id));
    if (selectedInTimeline.length < 2) return items;

    const normalizedDesiredOrder = desiredSelectedOrder.filter(id => selectedSet.has(id));
    const desiredSet = new Set(normalizedDesiredOrder);
    if (
        normalizedDesiredOrder.length !== selectedInTimeline.length ||
        desiredSet.size !== selectedInTimeline.length ||
        selectedInTimeline.some(city => !desiredSet.has(city.id))
    ) {
        return items;
    }

    const unchanged = selectedInTimeline.every((city, index) => city.id === normalizedDesiredOrder[index]);
    if (unchanged) return items;

    const cityById = new Map(cityItems.map(city => [city.id, city]));
    const oldStartByCityId = new Map(cityItems.map(city => [city.id, city.startDateOffset]));

    const replacementQueue = [...normalizedDesiredOrder];
    const reorderedCitySequence: ITimelineItem[] = cityItems.map(city => {
        if (!selectedSet.has(city.id)) return city;
        const replacementId = replacementQueue.shift();
        if (!replacementId) return city;
        return cityById.get(replacementId) || city;
    });

    const newStartByCityId = new Map<string, number>();
    let cursor = 0;
    reorderedCitySequence.forEach(city => {
        newStartByCityId.set(city.id, cursor);
        cursor += city.duration;
    });

    const cityOwnerForOffset = (offset: number): string | null => {
        const epsilon = 0.00001;
        for (const city of cityItems) {
            const start = city.startDateOffset;
            const end = city.startDateOffset + city.duration;
            if (offset >= (start - epsilon) && offset < (end - epsilon)) {
                return city.id;
            }
        }
        return null;
    };

    const updatedNonTravelItems = items
        .filter(item => !isTravelItem(item))
        .map(item => {
            if (item.type === 'city') {
                const newStart = newStartByCityId.get(item.id);
                if (newStart === undefined) return item;
                return { ...item, startDateOffset: newStart };
            }

            if (item.type === 'activity') {
                const ownerCityId = resolveExplicitActivityStay(item, cityItems)?.id
                    ?? cityOwnerForOffset(item.startDateOffset);
                if (!ownerCityId) return item;
                const oldStart = oldStartByCityId.get(ownerCityId);
                const newStart = newStartByCityId.get(ownerCityId);
                if (oldStart === undefined || newStart === undefined) return item;
                const delta = newStart - oldStart;
                if (Math.abs(delta) < 0.000001) return item;
                return { ...item, startDateOffset: Math.max(0, item.startDateOffset + delta) };
            }

            return item;
        });

    const oldBoundaries = cityItems.slice(0, -1).map((fromCity, index) => {
        const toCity = cityItems[index + 1];
        const key = cityPairKey(fromCity.id, toCity.id);
        const travel = findTravelBetweenCities(items, fromCity, toCity);
        return { key, travel };
    });

    const oldPairSet = new Set(oldBoundaries.map(boundary => boundary.key));
    const oldPairTravel = new Map<string, ITimelineItem>();
    oldBoundaries.forEach(boundary => {
        if (boundary.travel && !oldPairTravel.has(boundary.key)) {
            oldPairTravel.set(boundary.key, boundary.travel);
        }
    });

    const oldBoundaryTravels = oldBoundaries
        .map(boundary => boundary.travel)
        .filter((travel): travel is ITimelineItem => !!travel);
    const oldLinkedTravelIds = new Set(oldBoundaryTravels.map(travel => travel.id));
    const nonBoundaryTravelItems = items
        .filter(isTravelItem)
        .filter(item => !oldLinkedTravelIds.has(item.id))
        .map(item => ({ ...item }));

    const usedTravelIds = new Set<string>();
    const takeTravelSource = (pairKey: string, index: number): ITimelineItem | null => {
        const exactMatch = oldPairTravel.get(pairKey);
        if (exactMatch && !usedTravelIds.has(exactMatch.id)) {
            usedTravelIds.add(exactMatch.id);
            return exactMatch;
        }

        const indexed = oldBoundaries[index]?.travel;
        if (indexed && !usedTravelIds.has(indexed.id)) {
            usedTravelIds.add(indexed.id);
            return indexed;
        }

        const fallback = oldBoundaryTravels.find(travel => !usedTravelIds.has(travel.id));
        if (fallback) {
            usedTravelIds.add(fallback.id);
            return fallback;
        }

        return null;
    };

    const rebuiltBoundaryTravelItems: ITimelineItem[] = [];
    for (let index = 0; index < reorderedCitySequence.length - 1; index++) {
        const fromCity = reorderedCitySequence[index];
        const toCity = reorderedCitySequence[index + 1];
        const pairKey = cityPairKey(fromCity.id, toCity.id);
        const sourceTravel = takeTravelSource(pairKey, index);
        const fromStart = newStartByCityId.get(fromCity.id) ?? fromCity.startDateOffset;
        const boundaryStart = fromStart + fromCity.duration;
        const isChangedAdjacency = !oldPairSet.has(pairKey);

        if (sourceTravel) {
            const rebuilt = {
                ...sourceTravel,
                startDateOffset: boundaryStart,
                duration: Math.max(0.05, sourceTravel.duration || 0.2),
            };

            if (isChangedAdjacency) {
                rebuilt.type = 'travel-empty';
                rebuilt.transportMode = 'na';
                rebuilt.color = TRAVEL_EMPTY_COLOR;
                rebuilt.title = `Travel to ${toCity.title}`;
                rebuilt.description = 'Transport not set';
            } else if (rebuilt.type === 'travel-empty') {
                rebuilt.transportMode = 'na';
                rebuilt.color = TRAVEL_EMPTY_COLOR;
                rebuilt.title = `Travel to ${toCity.title}`;
                rebuilt.description = rebuilt.description || 'Transport not set';
            }

            rebuiltBoundaryTravelItems.push(rebuilt);
            continue;
        }

        rebuiltBoundaryTravelItems.push({
            id: `travel-relinked-${Date.now()}-${index}`,
            type: 'travel-empty',
            title: `Travel to ${toCity.title}`,
            startDateOffset: boundaryStart,
            duration: 0.2,
            color: TRAVEL_EMPTY_COLOR,
            description: 'Transport not set',
            transportMode: 'na',
        });
    }

    return [...updatedNonTravelItems, ...nonBoundaryTravelItems, ...rebuiltBoundaryTravelItems];
};
