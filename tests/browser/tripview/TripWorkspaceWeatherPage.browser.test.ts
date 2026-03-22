// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { TripWorkspaceWeatherPage } from '../../../components/tripview/workspace/TripWorkspaceWeatherPage';
import type { ITrip } from '../../../types';

const { trackEventMock } = vi.hoisted(() => ({
    trackEventMock: vi.fn(),
}));

vi.mock('../../../services/analyticsService', () => ({
    trackEvent: trackEventMock,
    getAnalyticsDebugAttributes: () => ({}),
}));

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
        {
            id: 'city-chiang-mai',
            type: 'city',
            title: 'Chiang Mai',
            startDateOffset: 3,
            duration: 4,
            color: 'bg-emerald-500',
        },
        {
            id: 'city-krabi',
            type: 'city',
            title: 'Krabi',
            startDateOffset: 7,
            duration: 4,
            color: 'bg-sky-500',
        },
    ],
});

describe('components/tripview/workspace/TripWorkspaceWeatherPage', () => {
    it('renders route weather, switches lenses and stops, and routes quick links back into the workspace', () => {
        const onPageChange = vi.fn();

        render(
            React.createElement(TripWorkspaceWeatherPage, {
                trip: buildTrip(),
                onPageChange,
            }),
        );

        expect(screen.getByText('Bangkok is the condition hinge for this part of the route')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('radio', { name: 'Sea watch' }));
        expect(screen.getAllByText('No sea risk here. Treat Bangkok as the place to recover energy before the weather-sensitive south.').length).toBeGreaterThan(0);

        fireEvent.click(screen.getByRole('radio', { name: 'Krabi / Ao Nang' }));
        expect(screen.getByText('Watch Monday closely')).toBeInTheDocument();
        expect(screen.getByText('This is the weather hinge of the route: sea mood, storm timing, and transfer windows all matter more than the temperature itself.')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Open travel kit' }));
        expect(onPageChange).toHaveBeenCalledWith('travel-kit');
    });
});
