import { describe, expect, it } from 'vitest';

import { TRIP_FACTORIES, TRIP_TEMPLATES } from '../../data/exampleTripTemplates';
import { validateTripSchema } from '../../data/exampleTripTemplates/_validation';
import { exampleTripCards } from '../../data/exampleTripCards';
import { isDayTrip, resolveActivityStay } from '../../shared/activityStay';

describe('example trips and day trips', () => {
    it.each(Object.keys(TRIP_FACTORIES))('%s: every activity points at a real stay after ids are suffixed', (templateId) => {
        const trip = TRIP_FACTORIES[templateId]('2026-05-01');
        const cities = trip.items.filter((item) => item.type === 'city');
        const cityIds = new Set(cities.map((city) => city.id));

        expect(validateTripSchema(trip).isValid).toBe(true);
        trip.items.filter((item) => item.type === 'activity').forEach((activity) => {
            expect(activity.stayCityId, activity.id).toBeDefined();
            expect(cityIds.has(activity.stayCityId!), activity.id).toBe(true);
            // The stored stay is also the one every view resolves.
            expect(resolveActivityStay(activity, cities)?.id, activity.id).toBe(activity.stayCityId);
            if (isDayTrip(activity)) expect(activity.coordinates, activity.id).toBeDefined();
        });
    });

    it('shows labelled day trips as day trips', () => {
        const dayTripTitles = Object.values(TRIP_TEMPLATES).flatMap((template) => (
            (template.items || []).filter(isDayTrip).map((item) => item.title)
        ));
        expect(dayTripTitles).toEqual(expect.arrayContaining([
            'Miyajima Island Day Trip',
            'Ayutthaya Ruins Day Trip',
            'Golden Circle Day Tour',
            'Sintra Day Trip: Pena Palace & Regaleira',
        ]));
    });

    it('treats Sintra as a day trip from Lisbon, and the Portugal card counts three stops', () => {
        const portugal = TRIP_TEMPLATES['portugal-coast'];
        const cityTitles = (portugal.items || []).filter((item) => item.type === 'city').map((item) => item.title);
        expect(cityTitles).toEqual(['Lisbon', 'Porto', 'Algarve (Lagos)']);

        const card = exampleTripCards.find((entry) => entry.templateId === 'portugal-coast');
        expect(card?.cityCount).toBe(cityTitles.length);
        Object.values(card?.localized || {}).forEach((localization) => {
            expect(localization?.cities).toHaveLength(cityTitles.length);
        });
    });
});
