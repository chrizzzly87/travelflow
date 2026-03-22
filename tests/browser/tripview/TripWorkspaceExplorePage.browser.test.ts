// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TripWorkspaceExplorePage } from '../../../components/tripview/workspace/TripWorkspaceExplorePage';
import type { ITrip, ITripActivityBoardCard } from '../../../types';

const analyticsMocks = vi.hoisted(() => ({
    trackEvent: vi.fn(),
    getAnalyticsDebugAttributes: vi.fn(() => ({})),
}));

vi.mock('../../../services/analyticsService', () => analyticsMocks);

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => {
            const lookup: Record<string, string> = {
                'tripView.workspace.explore.modes.discover': 'Discover',
                'tripView.workspace.explore.modes.board': 'Board',
                'tripView.workspace.explore.openBoard': 'Open activity board',
            };
            return lookup[key] ?? key;
        },
    }),
}));

const buildTrip = (overrides: Partial<ITrip> = {}): ITrip => ({
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
            coordinates: { lat: 13.7563, lng: 100.5018 },
        },
        {
            id: 'city-chiang-mai',
            type: 'city',
            title: 'Chiang Mai',
            startDateOffset: 3,
            duration: 4,
            color: 'bg-emerald-500',
            coordinates: { lat: 18.7883, lng: 98.9853 },
        },
        {
            id: 'city-krabi',
            type: 'city',
            title: 'Krabi',
            startDateOffset: 7,
            duration: 4,
            color: 'bg-sky-500',
            coordinates: { lat: 8.0863, lng: 98.9063 },
        },
    ],
    ...overrides,
});

const ExploreHarness: React.FC<{
    initialMode?: 'discover' | 'board';
    initialTrip?: ITrip;
    isMobile?: boolean;
    onScheduleBoardCard?: (card: ITripActivityBoardCard) => void;
}> = ({
    initialMode = 'discover',
    initialTrip = buildTrip(),
    isMobile = false,
    onScheduleBoardCard = vi.fn(),
}) => {
    const [trip, setTrip] = React.useState(initialTrip);
    const [mode, setMode] = React.useState<'discover' | 'board'>(initialMode);

    return React.createElement(TripWorkspaceExplorePage, {
        trip,
        isMobile,
        mode,
        onModeChange: setMode,
        onUpdateActivityBoard: (cards: ITripActivityBoardCard[]) => {
            setTrip((current) => ({
                ...current,
                activityBoard: cards,
            }));
        },
        onScheduleBoardCard,
        onOpenPlannerItem: vi.fn(),
        onRemoveFromItinerary: vi.fn(),
    });
};

describe('components/tripview/workspace/TripWorkspaceExplorePage', () => {
    const resizeObserverDisconnect = vi.fn();

    beforeEach(() => {
        Object.defineProperty(globalThis, 'ResizeObserver', {
            configurable: true,
            writable: true,
            value: class ResizeObserverMock {
                observe() {}
                unobserve() {}
                disconnect() {
                    resizeObserverDisconnect();
                }
            },
        });
        Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
            configurable: true,
            writable: true,
            value: () => false,
        });
        Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
            configurable: true,
            writable: true,
            value: () => {},
        });
        Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', {
            configurable: true,
            writable: true,
            value: () => {},
        });
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
            configurable: true,
            writable: true,
            value: () => {},
        });
    });

    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it('saves activity leads to the board and preserves board filters when switching modes', async () => {
        const user = userEvent.setup({ pointerEventsCheck: 0 });

        render(React.createElement(ExploreHarness));

        const bangkokCard = screen.getByText('Talat Noi canal and photo walk').parentElement as HTMLElement;
        const krabiCard = screen.getByText('Long-tail sunrise limestone loop').parentElement as HTMLElement;

        await user.click(within(bangkokCard).getByRole('button', { name: 'Save to board' }));
        await user.click(within(krabiCard).getByRole('button', { name: 'Save to board' }));
        await user.click(screen.getByRole('tab', { name: 'Board' }));

        expect(screen.getByText('Talat Noi canal and photo walk')).toBeInTheDocument();
        expect(screen.getByText('Long-tail sunrise limestone loop')).toBeInTheDocument();

        await user.click(screen.getByRole('combobox', { name: 'Filter activity board by city' }));
        await user.click(await screen.findByRole('option', { name: 'Bangkok' }));

        expect(screen.getByText('Talat Noi canal and photo walk')).toBeInTheDocument();
        expect(screen.queryByText('Long-tail sunrise limestone loop')).not.toBeInTheDocument();

        await user.click(screen.getByRole('tab', { name: 'Discover' }));
        await user.click(screen.getByRole('tab', { name: 'Board' }));

        expect(screen.getByText('Talat Noi canal and photo walk')).toBeInTheDocument();
        expect(screen.queryByText('Long-tail sunrise limestone loop')).not.toBeInTheDocument();
        expect(analyticsMocks.trackEvent).toHaveBeenCalledWith(
            'trip_workspace__explore_activity_shortlist--create',
            expect.objectContaining({ trip_id: 'trip-thailand' }),
        );
    });

    it('uses menu-based moves on mobile activity cards', async () => {
        const user = userEvent.setup({ pointerEventsCheck: 0 });
        const onScheduleBoardCard = vi.fn();

        render(React.createElement(ExploreHarness, {
            initialMode: 'board',
            isMobile: true,
            onScheduleBoardCard,
            initialTrip: buildTrip({
                activityBoard: [
                    {
                        id: 'explore-bangkok-talad-noi',
                        title: 'Talat Noi canal and photo walk',
                        cityItemId: 'city-bangkok',
                        source: 'explore',
                        status: 'shortlist',
                        activityType: ['culture', 'sightseeing'],
                        description: 'A strong first Bangkok half-day.',
                        sortOrder: 0,
                    },
                ],
            }),
        }));

        await user.click(screen.getByRole('button', { name: 'Open activity card menu' }));
        await user.click(screen.getByRole('menuitem', { name: 'Plan in itinerary' }));

        expect(onScheduleBoardCard).toHaveBeenCalledWith(expect.objectContaining({
            id: 'explore-bangkok-talad-noi',
            status: 'shortlist',
        }));
    });
});
