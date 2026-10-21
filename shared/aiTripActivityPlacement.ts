/**
 * Turns the placement part of a model-produced activity into timeline fields.
 *
 * Shared by the three builders that turn a prepared itinerary into timeline
 * items (the async worker, the client service and the benchmark), so a day trip
 * reads the same whichever path generated it. Every activity is stamped with
 * the stay it was generated for; a day trip additionally carries its
 * destination and position, marked as coming from the model.
 */

export interface ModelActivityPlacementFields {
  location: string;
  stayCityId: string;
  activityKind?: "day-trip";
  coordinates?: { lat: number; lng: number };
  coordinatesSource?: "ai";
}

const toFiniteNumber = (value: unknown): number | null => {
  const parsed = typeof value === "string" && value.trim() !== "" ? Number(value.trim()) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
};

export const buildModelActivityPlacementFields = (
  activity: Record<string, unknown>,
  stay: { id: string; name: string },
): ModelActivityPlacementFields => {
  const base: ModelActivityPlacementFields = { location: stay.name, stayCityId: stay.id };
  if (activity.isDayTrip !== true) return base;

  const destination = typeof activity.destination === "string" ? activity.destination.trim() : "";
  const lat = toFiniteNumber(activity.lat);
  const lng = toFiniteNumber(activity.lng);
  if (!destination || lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return base;
  }
  return {
    location: destination,
    stayCityId: stay.id,
    activityKind: "day-trip",
    coordinates: { lat, lng },
    coordinatesSource: "ai",
  };
};
