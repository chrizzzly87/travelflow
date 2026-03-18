export type FlightRoutePoint = {
  lat: number;
  lng: number;
};

export interface FlightRouteVisualPaths {
  airPath: FlightRoutePoint[];
  groundPath: FlightRoutePoint[];
}

const MIN_CURVE_SAMPLES = 16;
const MAX_CURVE_SAMPLES = 36;

const clamp = (value: number, min: number, max: number): number => (
  Math.min(max, Math.max(min, value))
);

export const buildCurvedFlightPath = (
  start: FlightRoutePoint,
  end: FlightRoutePoint,
  samples = 24,
): FlightRoutePoint[] => {
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
  const curveLift = clamp(distance * 0.18, 0.22, 4.4);

  const upwardControl = {
    x: baseMidPoint.x + (normalizedPerpendicular.x * curveLift),
    y: baseMidPoint.y + (normalizedPerpendicular.y * curveLift),
  };
  const downwardControl = {
    x: baseMidPoint.x - (normalizedPerpendicular.x * curveLift),
    y: baseMidPoint.y - (normalizedPerpendicular.y * curveLift),
  };
  const controlPoint = upwardControl.y >= downwardControl.y ? upwardControl : downwardControl;
  const stepCount = clamp(Math.round(samples), MIN_CURVE_SAMPLES, MAX_CURVE_SAMPLES);

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
): FlightRouteVisualPaths => ({
  airPath: buildCurvedFlightPath(start, end),
  groundPath: [start, end],
});
