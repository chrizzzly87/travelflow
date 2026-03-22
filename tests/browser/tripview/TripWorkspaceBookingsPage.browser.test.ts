// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { TripWorkspaceBookingsPage } from '../../../components/tripview/workspace/TripWorkspaceBookingsPage';
import type { ITrip } from '../../../types';

const buildTrip = (): ITrip => ({
    id: 'trip-thailand',
    title: 'Thailand Highlights',
    startDate: '2026-04-10',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    items: [
        {
            id: 'city-bangkok',
            type: 'city',
            title: 'Bangkok',
            startDateOffset: 0,
            duration: 3,
            color: 'bg-amber-500',
        },
    ],
    activityBoard: [
        {
            id: 'explore-bangkok-talad-noi',
            title: 'Talat Noi canal and photo walk',
            cityItemId: 'city-bangkok',
            timelineItemId: 'activity-talad-noi',
            source: 'explore',
            status: 'booked',
            activityType: ['culture', 'sightseeing'],
            description: 'Locked in for the first full Bangkok day.',
            sortOrder: 0,
        },
    ],
});

describe('components/tripview/workspace/TripWorkspaceBookingsPage', () => {
    it('shows booked activities coming from the Explore workflow board', () => {
        render(React.createElement(TripWorkspaceBookingsPage, { trip: buildTrip() }));

        expect(screen.getByText('Booked activities from Explore')).toBeInTheDocument();
        expect(screen.getByText('Talat Noi canal and photo walk')).toBeInTheDocument();
        expect(screen.getByText(/Bangkok • Locked in for the first full Bangkok day\./i)).toBeInTheDocument();
    });
});
