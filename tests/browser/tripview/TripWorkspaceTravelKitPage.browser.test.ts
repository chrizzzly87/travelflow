// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

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
        const readyCard = screen.getByText('Ready now').parentElement as HTMLElement;
        const initialReadyCount = within(readyCard).getByText(/\d+\/\d+/).textContent;

        fireEvent.mouseDown(screen.getByRole('tab', { name: 'Water and coast' }), { button: 0 });
        fireEvent.click(screen.getByRole('checkbox', { name: 'Protect one flexible day for Thai coast weather' }));

        expect(within(readyCard).getByText(/\d+\/\d+/).textContent).not.toBe(initialReadyCount);

        fireEvent.click(screen.getByRole('button', { name: '250 EUR' }));
        expect(screen.getByText(/local-cash demo/i)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Coast day' }));
        expect(screen.getByText('Protects the weather-sensitive Thai island leg.')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Open phrases' }));
        expect(onPageChange).toHaveBeenCalledWith('phrases');
    });
});
