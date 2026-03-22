import { describe, expect, it } from 'vitest';

import { createSoutheastAsiaBackpackingTrip } from '../../data/exampleTripTemplates/southeastAsiaBackpacking';
import {
    buildTripWorkspaceDemoDataset,
    resolveTripWorkspaceDefaultContextSelection,
} from '../../components/tripview/workspace/tripWorkspaceDemoData';

describe('components/tripview/workspace/tripWorkspaceDemoData', () => {
    it('builds the SEA workspace dataset from the homepage example and preserves return border crossings', () => {
        const trip = createSoutheastAsiaBackpackingTrip('2099-01-10');
        const dataset = buildTripWorkspaceDemoDataset(trip);

        expect(dataset.countries.map((country) => country.code)).toEqual(['TH', 'KH', 'VN', 'LA']);
        expect(dataset.cities.map((city) => city.title)).toEqual(expect.arrayContaining([
            'Bangkok',
            'Siem Reap',
            'Phnom Penh',
            'Kampot',
            'Ho Chi Minh City',
            'Hoi An',
            'Hanoi',
            'Ninh Binh',
            'Sapa',
            'Vang Vieng',
            'Luang Prabang',
            'Chiang Mai',
        ]));
        expect(dataset.routeSummary.borderCrossings.map((crossing) => `${crossing.fromCode}->${crossing.toCode}`)).toEqual([
            'TH->KH',
            'KH->VN',
            'VN->LA',
            'LA->TH',
        ]);
    });

    it('defaults the workspace context to the first route stop for future trips', () => {
        const trip = createSoutheastAsiaBackpackingTrip('2099-01-10');
        const dataset = buildTripWorkspaceDemoDataset(trip);

        expect(resolveTripWorkspaceDefaultContextSelection(trip, dataset)).toEqual({
            countryCode: 'TH',
            cityGuideId: 'bangkok',
        });
    });
});
