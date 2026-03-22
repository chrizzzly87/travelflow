// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { TripWorkspaceDocumentsPage } from '../../../components/tripview/workspace/TripWorkspaceDocumentsPage';
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

describe('components/tripview/workspace/TripWorkspaceDocumentsPage', () => {
    it('renders the trip dossier, supports verification, and routes quick links back into the workspace', () => {
        const onPageChange = vi.fn();

        render(
            React.createElement(TripWorkspaceDocumentsPage, {
                trip: buildTrip(),
                onPageChange,
            }),
        );

        expect(screen.getByText('Keep packets grouped by route leg and country, not buried by document type')).toBeInTheDocument();

        fireEvent.mouseDown(screen.getByRole('tab', { name: 'Transport' }), { button: 0 });
        fireEvent.click(screen.getByRole('button', { name: 'Border packets' }));
        expect(screen.getByText('Cross-country handoff proofs and next-city anchors.')).toBeInTheDocument();

        fireEvent.mouseDown(screen.getByRole('tab', { name: 'Entry' }), { button: 0 });
        fireEvent.click(screen.getByText('Onward and border proof packet'));
        fireEvent.click(screen.getAllByRole('button', { name: 'Mark verified' })[0]);
        expect(screen.getByRole('button', { name: 'Marked verified' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Open places' }));
        expect(onPageChange).toHaveBeenCalledWith('places');
    });
});
