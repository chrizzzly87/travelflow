/**
 * Curved flight geometry shared by the interactive trip map, the client-side
 * static map builders and the `/api/trip-map-preview` edge function.
 *
 * The planner map draws a plane leg as an arc; a preview card that asks a
 * routing provider for driving directions on the same leg gets nothing back
 * and falls through to a straight line, so the card and the map disagree.
 * Both now derive the arc from this one implementation.
 */

export type FlightRoutePoint = {
  lat: number;
  lng: number;
};

export interface FlightRouteVisualPaths {
  airPath: FlightRoutePoint[];
  groundPath: FlightRoutePoint[];
}

export interface FlightRouteCurveOptions {
  samples?: number;
  liftRatio?: number;
  minLift?: number;
  maxLift?: number;
}

const MIN_CURVE_SAMPLES = 16;
const MAX_CURVE_SAMPLES = 36;

/**
 * Static previews pay for every sample twice: once in the encoded polyline and
 * again in the URL-encoded overlay segment. Sixteen samples still read as a
 * smooth arc at card size while keeping a long itinerary inside Mapbox's URL cap.
 */
export const FLIGHT_PREVIEW_CURVE_OPTIONS: FlightRouteCurveOptions = {
  samples: 16,
  liftRatio: 0.18,
  minLift: 0.22,
  maxLift: 4.4,
};

const clamp = (value: number, min: number, max: number): number => (
  Math.min(max, Math.max(min, value))
);

export const buildCurvedFlightPath = (
  start: FlightRoutePoint,
  end: FlightRoutePoint,
  options: number | FlightRouteCurveOptions = 24,
): FlightRoutePoint[] => {
  const normalizedOptions = typeof options === 'number'
    ? { samples: options }
    : options;
  const midLatitude = (start.lat + end.lat) / 2;
  const longitudeScale = Math.max(0.28, Math.cos((midLatitude * Math.PI) / 180));
  const startPoint = { x: start.lng * longitudeScale, y: start.lat };
  const endPoint = { x: end.lng * longitudeScale, y: end.lat };
  const deltaX = endPoint.x - startPoint.x;
  const deltaY = endPoint.y - startPoint.y;
  const distance = Math.hypot(deltaX, deltaY);

  if (!Number.isFinite(distance) || distance <= 0.001) {
    return [start, end];
  }

  const baseMidPoint = {
    x: (startPoint.x + endPoint.x) / 2,
    y: (startPoint.y + endPoint.y) / 2,
  };
  const normalizedPerpendicular = {
    x: -deltaY / distance,
    y: deltaX / distance,
  };
  const curveLift = clamp(
    distance * (normalizedOptions.liftRatio ?? 0.18),
    normalizedOptions.minLift ?? 0.22,
    normalizedOptions.maxLift ?? 4.4,
  );

  const upwardControl = {
    x: baseMidPoint.x + (normalizedPerpendicular.x * curveLift),
    y: baseMidPoint.y + (normalizedPerpendicular.y * curveLift),
  };
  const downwardControl = {
    x: baseMidPoint.x - (normalizedPerpendicular.x * curveLift),
    y: baseMidPoint.y - (normalizedPerpendicular.y * curveLift),
  };
  const controlPoint = upwardControl.y >= downwardControl.y ? upwardControl : downwardControl;
  const stepCount = clamp(
    Math.round(normalizedOptions.samples ?? 24),
    MIN_CURVE_SAMPLES,
    MAX_CURVE_SAMPLES,
  );

  return Array.from({ length: stepCount + 1 }, (_, index) => {
    const t = index / stepCount;
    const oneMinusT = 1 - t;
    const projectedX = (oneMinusT * oneMinusT * startPoint.x)
      + (2 * oneMinusT * t * controlPoint.x)
      + (t * t * endPoint.x);
    const projectedY = (oneMinusT * oneMinusT * startPoint.y)
      + (2 * oneMinusT * t * controlPoint.y)
      + (t * t * endPoint.y);

    return {
      lat: projectedY,
      lng: projectedX / longitudeScale,
    };
  });
};

export const buildFlightRouteVisualPaths = (
  start: FlightRoutePoint,
  end: FlightRoutePoint,
  options?: FlightRouteCurveOptions,
): FlightRouteVisualPaths => ({
  airPath: buildCurvedFlightPath(start, end, options),
  groundPath: [start, end],
});

/** Arc used by every static preview (card, example card, share image). */
export const buildFlightPreviewCurvePath = (
  start: FlightRoutePoint,
  end: FlightRoutePoint,
): FlightRoutePoint[] => buildCurvedFlightPath(start, end, FLIGHT_PREVIEW_CURVE_OPTIONS);
