/**
 * Review state of a trip's saved ideas, and what the map draws for them.
 *
 * - `saved`: the traveller saved it. Drawn at full strength. It stays an idea
 *   with its pin; saving never turns it into an activity.
 * - `pending`: arrived without a decision — an import from Google My Maps.
 *   Drawn faded, and offers Save / Skip.
 * - `skipped`: looked at and declined. Not drawn; listed under Skipped, and
 *   kept on the trip so a re-import does not bring it back.
 *
 * No `review` at all is an idea from before review existed: a library idea
 * someone kept in the deck (saved), or a My Maps import (never decided on, so
 * pending). Saving always writes `saved`, so the two never get confused.
 */

import { pickPrimaryActivityType, type ActivityType } from './activityTypes';
import type { SavedRecommendation } from './recommendations';
import { isMyMapsIdeaId } from './googleMyMaps';

export type IdeaReview = 'pending' | 'saved' | 'skipped';

type ReviewedIdea = Pick<SavedRecommendation, 'review' | 'recommendationId'>;

export const isIdeaPending = (idea: ReviewedIdea): boolean => (
    idea.review === 'pending' || (idea.review === undefined && isMyMapsIdeaId(idea.recommendationId))
);
export const isIdeaSkipped = (idea: ReviewedIdea): boolean => idea.review === 'skipped';

/** Saved and to-review ideas: everything the Kept list and the map show. */
export const listActiveIdeas = (saved: SavedRecommendation[]): SavedRecommendation[] => (
    saved.filter((idea) => !isIdeaSkipped(idea))
);

export const setIdeaReview = <T extends { saved: SavedRecommendation[] }>(
    state: T,
    recommendationId: string,
    review: IdeaReview,
): T => ({
    ...state,
    saved: state.saved.map((idea) => (
        idea.recommendationId === recommendationId ? { ...idea, review } : idea
    )),
});

export interface MapIdeaMarker {
    id: string;
    title: string;
    lat: number;
    lng: number;
    type: ActivityType;
    pending: boolean;
    /** What the pin's card shows. */
    summary: string;
    address: string | null;
    cityName: string | null;
    /** The first source with a link that is not the map it came from, e.g. the Instagram post. */
    source: { label: string; url: string } | null;
}

const hostOf = (url: string): string | null => {
    try {
        return new URL(url).hostname;
    } catch {
        return null;
    }
};

const pickIdeaSourceLink = (idea: SavedRecommendation): MapIdeaMarker['source'] => {
    const link = idea.sources.find((entry) => entry.kind !== 'google_maps' && entry.url && hostOf(entry.url));
    if (!link?.url) return null;
    return { label: link.handle || hostOf(link.url) || link.url, url: link.url };
};

/** Ideas with a position that are not skipped, in the shape the map draws. */
export const buildMapIdeaMarkers = (saved: SavedRecommendation[] | undefined): MapIdeaMarker[] => (
    listActiveIdeas(saved ?? []).flatMap((idea) => {
        const { lat, lng } = idea.location;
        if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
            return [];
        }
        return [{
            id: idea.recommendationId,
            title: idea.title,
            lat,
            lng,
            type: pickPrimaryActivityType(idea.activityTypes),
            pending: isIdeaPending(idea),
            summary: idea.summary || idea.description || '',
            address: idea.location.address,
            cityName: idea.cityName,
            source: pickIdeaSourceLink(idea),
        }];
    })
);

/** Changes whenever a pin would look different, so the map rebuilds only then. */
export const buildMapIdeaSignature = (markers: MapIdeaMarker[]): string => markers
    .map((marker) => `${marker.id}|${marker.pending ? 'p' : 'k'}|${marker.type}|${marker.lat},${marker.lng}`)
    .join('||');
