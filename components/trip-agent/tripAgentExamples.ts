import type { TFunction } from 'i18next';

import type { TripAgentContextRef } from '../../shared/tripAgent';
import type { ITrip } from '../../types';

export type TripAgentExampleKey = 'activities' | 'food' | 'stays' | 'dayTrip' | 'review';

export interface TripAgentExample {
    key: TripAgentExampleKey;
    /** Short pill text. */
    label: string;
    /** The prompt the pill writes into the field, ready to adjust. */
    prompt: string;
}

/**
 * Most useful first. The planner already builds a sensible route, so the
 * examples lean towards filling it (things to do, food, stays, day trips)
 * rather than reworking it. Those name a stop, which shows how an @mention
 * narrows a request.
 */
const CITY_EXAMPLES: TripAgentExampleKey[] = ['activities', 'food', 'stays', 'dayTrip'];
const TRIP_EXAMPLES: TripAgentExampleKey[] = ['review'];

/**
 * Starting points for the empty chat, written into the prompt instead of sent,
 * so the traveller can adapt them first. They name a real stop of this trip as
 * an @mention: the one selected in the planner, else the first stop.
 */
export const buildTripAgentExamples = ({
    t,
    trip,
    contextRefs,
}: {
    t: TFunction;
    trip: Pick<ITrip, 'items'>;
    contextRefs: TripAgentContextRef[];
}): TripAgentExample[] => {
    const selectedCity = contextRefs.find((contextRef) => contextRef.kind === 'city')?.label;
    const firstCity = trip.items.find((item) => item.type === 'city')?.title;
    const city = (selectedCity || firstCity || '').trim();
    const keys: TripAgentExampleKey[] = city ? [...CITY_EXAMPLES, ...TRIP_EXAMPLES] : TRIP_EXAMPLES;
    return keys.map((key) => ({
        key,
        label: t(`examples.${key}.label`),
        prompt: CITY_EXAMPLES.includes(key)
            ? t(`examples.${key}.prompt`, { city: `@${city}` })
            : t(`examples.${key}.prompt`),
    }));
};
