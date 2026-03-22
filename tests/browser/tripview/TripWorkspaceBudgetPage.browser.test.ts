// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

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

        expect(screen.getByText('See trip total, country rollups, and city pressure without turning this into accounting software')).toBeInTheDocument();
        const workingTotalCard = screen.getByText('Working total').closest('div') as HTMLElement;
        const workingTotal = () => within(workingTotalCard).getByText(/€[\d,]+/).textContent;
        const initialTotal = workingTotal();

        fireEvent.click(screen.getByRole('radio', { name: /Comfort/i }));
        const comfortTotal = workingTotal();
        expect(comfortTotal).not.toBe(initialTotal);

        fireEvent.click(screen.getByRole('switch', { name: 'Include reserve fund' }));
        expect(workingTotal()).not.toBe(comfortTotal);

        fireEvent.click(screen.getByRole('radio', { name: 'Transport' }));
        expect(screen.queryByText('Bangkok stays')).not.toBeInTheDocument();
        expect(screen.queryByText('Krabi signature day')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Open bookings' }));
        expect(onPageChange).toHaveBeenCalledWith('bookings');
    });
});
