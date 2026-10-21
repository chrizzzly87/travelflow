// Shared by planner maps and server-side previews; no browser dependencies.
export const buildRouteCacheKey = (start: { lat: number; lng: number }, end: { lat: number; lng: number }, mode: string): string => {
  const round = (value: number) => value.toFixed(5);
  return `${round(start.lat)},${round(start.lng)}|${round(end.lat)},${round(end.lng)}|${mode}`;
};
