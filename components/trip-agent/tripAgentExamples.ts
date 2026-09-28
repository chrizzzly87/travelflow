import type { TFunction } from 'i18next';

import type { TripAgentContextRef } from '../../shared/tripAgent';
import type { ITrip } from '../../types';

export type TripAgentExampleKey = 'pace' | 'stays' | 'route' | 'dayTrip' | 'review';

export interface TripAgentExample {
    key: TripAgentExampleKey;
    /** Short pill text. */
    label: string;
    /** The prompt the pill writes into the field, ready to adjust. */
    prompt: string;
}

/** Examples that name a stop, so they show how an @mention narrows a request. */
const CITY_EXAMPLES: TripAgentExampleKey[] = ['pace', 'stays', 'dayTrip'];
const TRIP_EXAMPLES: TripAgentExampleKey[] = ['route', 'review'];

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
    const keys: TripAgentExampleKey[] = city
        ? ['pace', 'stays', 'route', 'dayTrip', 'review']
        : TRIP_EXAMPLES;
    return keys.map((key) => ({
        key,
        label: t(`tripAgent.examples.${key}.label`),
        prompt: CITY_EXAMPLES.includes(key)
            ? t(`tripAgent.examples.${key}.prompt`, { city: `@${city}` })
            : t(`tripAgent.examples.${key}.prompt`),
    }));
};
