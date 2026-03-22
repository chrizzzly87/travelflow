// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { TripWorkspaceBudgetPage } from '../../../components/tripview/workspace/TripWorkspaceBudgetPage';
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

describe('components/tripview/workspace/TripWorkspaceBudgetPage', () => {
    it('renders the budget workspace, updates scenario totals, and routes quick links back into the workspace', () => {
        const onPageChange = vi.fn();

        render(
            React.createElement(TripWorkspaceBudgetPage, {
                trip: buildTrip(),
                onPageChange,
            }),
        );

        expect(screen.getByText('See where the route is actually expensive, flexible, or quietly risky')).toBeInTheDocument();
        expect(screen.getByText('€3,270')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('radio', { name: 'Comfort' }));
        expect(screen.getByText('€4,720')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('switch', { name: 'Include reserve fund' }));
        expect(screen.getByText('€4,100')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('radio', { name: 'Transport' }));
        expect(screen.getAllByText('Bangkok → Chiang Mai flight').length).toBeGreaterThan(0);
        expect(screen.queryByText('Bangkok arrival stay')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Open bookings' }));
        expect(onPageChange).toHaveBeenCalledWith('bookings');
    });
});
