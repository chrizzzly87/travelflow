// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { TripWorkspaceTravelKitPage } from '../../../components/tripview/workspace/TripWorkspaceTravelKitPage';
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
            id: 'city-krabi',
            type: 'city',
            title: 'Krabi',
            startDateOffset: 3,
            duration: 4,
            color: 'bg-sky-500',
        },
    ],
});

describe('components/tripview/workspace/TripWorkspaceTravelKitPage', () => {
    it('renders interactive travel support tools and routes quick links back into the workspace', () => {
        const onPageChange = vi.fn();

        render(
            React.createElement(TripWorkspaceTravelKitPage, {
                trip: buildTrip(),
                onPageChange,
            }),
        );

        expect(screen.getByText('Keep the useful little things one click from the route')).toBeInTheDocument();
        expect(screen.getByText('2/6')).toBeInTheDocument();

        fireEvent.mouseDown(screen.getByRole('tab', { name: 'Island leg' }), { button: 0 });
        fireEvent.click(screen.getByRole('checkbox', { name: 'Protect one flexible day for sea and transfer changes' }));

        expect(screen.getByText('3/6')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: '250 EUR' }));
        expect(screen.getByText('9,750 THB')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Temple and city day' }));
        expect(screen.getByText('A lighter city kit works better than carrying everything all day in Bangkok or Chiang Mai.')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Open phrases' }));
        expect(onPageChange).toHaveBeenCalledWith('phrases');
    });
});
