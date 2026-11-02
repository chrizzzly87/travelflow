/**
 * The pieces every "open this place in a map app" link is built from.
 *
 * There are two such features and they are deliberately different:
 *
 * - **Viewing** a place — the map pin callout and the details panel. Universal
 *   `https` links only (`mapDeepLinkService`), because a scheme URL dead-ends
 *   on a device without that app while an https link opens the native app when
 *   it is installed and the web map when it is not.
 * - **Getting directions** to a place — the itinerary and the idea cards.
 *   Platform-aware (`mapDirectionsLinks`), because Android resolves `geo:`
 *   through its own "open with" chooser, which offers Waze and the rest and is
 *   better than anything we can draw in-app.
 *
 * What they must not differ on is what a valid coordinate is, how a position is
 * written into a URL, and how a place's name and address are combined into a
 * search term. Those lived twice, with two spellings of the same dedupe rule,
 * until the two features met. They live here now.
 */

import type { ICoordinates } from '../types';

/**
 * A coordinate we are willing to put in a link.
 *
 * The range check is not pedantry: a swapped lat/lng pair is the common bug,
 * and a longitude in the latitude slot is usually still finite. Better to fall
 * back to a text search than to send somebody to the wrong hemisphere.
 */
export const hasUsableCoordinates = (
    coordinates: ICoordinates | null | undefined,
): coordinates is ICoordinates => (
    Boolean(coordinates)
    && Number.isFinite(coordinates!.lat)
    && Number.isFinite(coordinates!.lng)
    && Math.abs(coordinates!.lat) <= 90
    && Math.abs(coordinates!.lng) <= 180
);

/**
 * Six decimals is roughly 10cm — more than a map pin needs, and it keeps the
 * links short and stable enough to compare in a test.
 */
export const formatLatLng = (coordinates: ICoordinates): string => (
    `${Number(coordinates.lat.toFixed(6))},${Number(coordinates.lng.toFixed(6))}`
);

/**
 * Combines the two things we know about a place into one search term.
 *
 * Both features need this because an activity often has no coordinates of its
 * own, and "Belém" on its own lands anywhere.
 *
 * Either side can be the redundant one. A stored address usually already *ends*
 * with the city ("Rua de Belém 84, Lisbon" + "Lisbon") and a resolved location
 * usually already *starts* with the name ("Louvre" + "Louvre, Paris"); in both
 * cases the longer string is the complete one.
 *
 * The two checks are deliberately not symmetric, because a title can mention a
 * city in passing and dropping the city there leaves a search term that finds
 * nothing:
 *
 * - "Old Taipei Temple and Street-Food Quest" + "Taipei" — contains it, but the
 *   title is a name somebody invented, so the city still has to be appended.
 * - "Lisbon Cathedral by night" + "Lisbon" — starts with it, same story.
 *
 * So the qualifier is dropped only when the place already *ends* with it, which
 * is what an address that was built by appending a city looks like. The
 * qualifier wins only when it is the fuller form of the place, which is what a
 * resolved location looks like.
 */
export const composePlaceQuery = (
    primary: string | null | undefined,
    context: string | null | undefined,
): string => {
    const place = (primary ?? '').trim();
    const qualifier = (context ?? '').trim();
    if (!qualifier) return place;
    if (!place) return qualifier;

    const placeLower = place.toLocaleLowerCase();
    const qualifierLower = qualifier.toLocaleLowerCase();

    // "Rua de Belém 84, Lisbon" + "Lisbon" — the city is already appended.
    if (placeLower.endsWith(qualifierLower)) return place;
    // "Louvre" + "Louvre, Paris" — the qualifier is the complete description.
    if (qualifierLower.startsWith(placeLower) || qualifierLower.endsWith(placeLower)) return qualifier;
    return `${place}, ${qualifier}`;
};
