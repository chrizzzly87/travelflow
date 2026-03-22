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

        expect(screen.getByText('Bangkok is the active route-weather lens')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('radio', { name: 'Sea watch' }));
        expect(screen.getAllByText(/No sea risk here/i).length).toBeGreaterThan(0);

        fireEvent.click(screen.getByRole('button', { name: /Krabi \/ Ao Nang This is the weather hinge/i }));
        expect(screen.getByText('Krabi / Ao Nang is the active route-weather lens')).toBeInTheDocument();
        expect(screen.getAllByText(/Keep one flexible coast day/i).length).toBeGreaterThan(0);

        fireEvent.click(screen.getByRole('button', { name: 'Open travel kit' }));
        expect(onPageChange).toHaveBeenCalledWith('travel-kit');
    });
});
