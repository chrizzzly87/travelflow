import type { TFunction } from 'i18next';

import type { TripAgentContextRef } from '../../shared/tripAgent';
import { isDayTrip } from '../../shared/activityStay';
import type { ITrip } from '../../types';

/**
 * Day-trip prompts for the chat's "/" menu, adapted to what the traveller has
 * selected: a day trip can be changed or removed, an ordinary activity turned
 * into one, a stay asked for one, and the whole trip always can be.
 * Most specific first, so the likely intent sits at the top of the menu.
 */
export const buildTripAgentDayTripPresets = ({
    t,
    trip,
    contextRefs,
}: {
    t: TFunction;
    trip: Pick<ITrip, 'items'>;
    contextRefs: TripAgentContextRef[];
}): string[] => {
    const presets: string[] = [];

    const activityRef = contextRefs.find((contextRef) => contextRef.kind === 'activity');
    const activity = activityRef ? trip.items.find((item) => item.id === activityRef.id) : undefined;
    if (activity) {
        if (isDayTrip(activity)) {
            presets.push(t('tripAgent.presetChangeDayTrip', { activity: activity.title }));
            presets.push(t('tripAgent.presetRemoveDayTrip', { activity: activity.title }));
        } else {
            presets.push(t('tripAgent.presetMakeDayTrip', { activity: activity.title }));
        }
    }

    const cityRef = contextRefs.find((contextRef) => contextRef.kind === 'city');
    if (cityRef) presets.push(t('tripAgent.presetDayTripFrom', { city: cityRef.label }));

    if (trip.items.some((item) => item.type === 'city')) presets.push(t('tripAgent.presetDayTrips'));
    return presets;
};
