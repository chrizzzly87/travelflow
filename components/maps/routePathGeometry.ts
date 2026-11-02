/**
 * Distance and shape checks for computed route paths, used to reject a
 * "route" that is really a straight line. Moved verbatim from `ItineraryMap.tsx`.
 */

export const EARTH_RADIUS_KM = 6371;

export const estimateGreatCircleDistanceKm = (
    start: google.maps.LatLngLiteral,
    end: google.maps.LatLngLiteral,
): number => {
    const toRadians = (value: number) => value * (Math.PI / 180);
    const dLat = toRadians(end.lat - start.lat);
    const dLng = toRadians(end.lng - start.lng);
    const startLat = toRadians(start.lat);
    const endLat = toRadians(end.lat);

    const haversine = (
        Math.sin(dLat / 2) * Math.sin(dLat / 2)
        + Math.cos(startLat) * Math.cos(endLat) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
    );
    const angularDistance = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
    return EARTH_RADIUS_KM * angularDistance;
};

export const computeMaxPathDeviationMeters = (
    path: google.maps.LatLngLiteral[],
    start: google.maps.LatLngLiteral,
    end: google.maps.LatLngLiteral,
): number => {
    if (path.length < 3) return 0;

    const meanLatRadians = ((start.lat + end.lat) / 2) * (Math.PI / 180);
    const metersPerDegreeLat = 111_320;
    const metersPerDegreeLng = metersPerDegreeLat * Math.max(0.01, Math.cos(meanLatRadians));
    const toProjected = (point: google.maps.LatLngLiteral) => ({
        x: point.lng * metersPerDegreeLng,
        y: point.lat * metersPerDegreeLat,
    });

    const startProjected = toProjected(start);
    const endProjected = toProjected(end);
    const dx = endProjected.x - startProjected.x;
    const dy = endProjected.y - startProjected.y;
    const denominator = (dx * dx) + (dy * dy);
    if (denominator <= 0) return 0;

    let maxDeviation = 0;
    for (let index = 1; index < path.length - 1; index += 1) {
        const point = toProjected(path[index]);
        const projectionFactor = ((point.x - startProjected.x) * dx + (point.y - startProjected.y) * dy) / denominator;
        const clampedFactor = Math.max(0, Math.min(1, projectionFactor));
        const projectedX = startProjected.x + (clampedFactor * dx);
        const projectedY = startProjected.y + (clampedFactor * dy);
        const deviation = Math.hypot(point.x - projectedX, point.y - projectedY);
        if (deviation > maxDeviation) {
            maxDeviation = deviation;
        }
    }

    return maxDeviation;
};

export const isRoutePathLikelyStraight = (
    path: google.maps.LatLngLiteral[],
    start: google.maps.LatLngLiteral,
    end: google.maps.LatLngLiteral,
    mode: string,
): boolean => {
    const modeRequiresHigherShapeFidelity = mode === 'bus' || mode === 'train';
    const minimumPathPointCount = modeRequiresHigherShapeFidelity ? 4 : 3;
    if (path.length < minimumPathPointCount) return true;

    const straightMeters = estimateGreatCircleDistanceKm(start, end) * 1000;
    if (!Number.isFinite(straightMeters) || straightMeters <= 0) return true;

    let pathMeters = 0;
    for (let idx = 1; idx < path.length; idx++) {
        pathMeters += estimateGreatCircleDistanceKm(path[idx - 1], path[idx]) * 1000;
    }

    const ratio = pathMeters / straightMeters;
    const minimumDetourRatio = modeRequiresHigherShapeFidelity ? 1.05 : 1.015;
    const minimumDeviationMeters = Math.max(
        modeRequiresHigherShapeFidelity ? 550 : 450,
        Math.min(modeRequiresHigherShapeFidelity ? 8_500 : 3_500, straightMeters * (modeRequiresHigherShapeFidelity ? 0.022 : 0.015)),
    );
    const maxDeviationMeters = computeMaxPathDeviationMeters(path, start, end);

    const hasStraightLikeDetour = ratio > 0 && ratio < minimumDetourRatio;
    const hasStraightLikeShape = maxDeviationMeters < minimumDeviationMeters;
    return hasStraightLikeDetour || hasStraightLikeShape;
};
