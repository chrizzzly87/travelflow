// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { TripWorkspaceMobileNav, TripWorkspaceShell } from '../../../components/tripview/TripWorkspaceShell';
import { TRIP_WORKSPACE_SIDEBAR_STATE_STORAGE_KEY } from '../../../components/tripview/workspace/tripWorkspaceSidebarState';
import { buildTripWorkspacePath, normalizeTripWorkspacePage, resolveTripWorkspaceRouteState } from '../../../shared/tripWorkspace';
import type { ITrip } from '../../../types';

vi.mock('../../../components/GoogleMapsLoader', () => ({
    useGoogleMaps: () => ({
        isLoaded: false,
        loadError: null,
    }),
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => {
            const lookup: Record<string, string> = {
                'tripView.workspace.mobileNavLabel': 'Trip workspace navigation',
                'tripView.workspace.demoBadge': 'Thailand demo',
                'tripView.workspace.demoHint': 'Demo content is mocked until live destination services are wired in.',
                'tripView.workspace.groups.trip': 'Trip',
                'tripView.workspace.groups.destination': 'Destination',
                'tripView.workspace.groups.memories': 'Memories',
                'tripView.workspace.footer.share': 'Share',
                'tripView.workspace.footer.export': 'Export',
                'tripView.workspace.footer.settings': 'Settings',
                'tripView.workspace.pages.overview.label': 'Overview',
                'tripView.workspace.pages.overview.eyebrow': 'Overview',
                'tripView.workspace.pages.overview.title': 'Trip overview',
                'tripView.workspace.pages.overview.description': 'See the trip at a glance.',
                'tripView.workspace.pages.planner.label': 'Planner',
                'tripView.workspace.pages.planner.eyebrow': 'Planner',
                'tripView.workspace.pages.planner.title': 'Planner workspace',
                'tripView.workspace.pages.planner.description': 'Edit the calendar, map, timeline, and selected-stop details in one focused workspace.',
                'tripView.workspace.pages.planner.hint': 'This page is fully live. The destination and language pages around it still use Thailand demo content while we wire real data.',
                'tripView.workspace.pages.bookings.label': 'Bookings',
                'tripView.workspace.pages.bookings.eyebrow': 'Bookings',
                'tripView.workspace.pages.bookings.title': 'Bookings',
                'tripView.workspace.pages.bookings.description': 'Track reservations and missing logistics.',
                'tripView.workspace.pages.travel-kit.label': 'Travel kit',
                'tripView.workspace.pages.travel-kit.eyebrow': 'Travel kit',
                'tripView.workspace.pages.travel-kit.title': 'Travel kit',
                'tripView.workspace.pages.travel-kit.description': 'Keep adapters, emergency info, arrival prep, and checklists close to the route.',
                'tripView.workspace.pages.places.label': 'Places',
                'tripView.workspace.pages.places.eyebrow': 'Places',
                'tripView.workspace.pages.places.title': 'Places',
                'tripView.workspace.pages.places.description': 'Open country and city context.',
                'tripView.workspace.pages.explore.label': 'Explore',
                'tripView.workspace.pages.explore.eyebrow': 'Explore',
                'tripView.workspace.pages.explore.title': 'Explore',
                'tripView.workspace.pages.explore.description': 'Research stays, activities, and events.',
                'tripView.workspace.pages.phrases.label': 'Phrases',
                'tripView.workspace.pages.phrases.eyebrow': 'Phrases',
                'tripView.workspace.pages.phrases.title': 'Phrases',
                'tripView.workspace.pages.phrases.description': 'Keep useful translations close.',
                'tripView.workspace.pages.notes.label': 'Notes',
                'tripView.workspace.pages.notes.eyebrow': 'Notes',
                'tripView.workspace.pages.notes.title': 'Notes',
                'tripView.workspace.pages.notes.description': 'Capture planning notes and diary stubs.',
                'tripView.workspace.pages.photos.label': 'Photos',
                'tripView.workspace.pages.photos.eyebrow': 'Photos',
                'tripView.workspace.pages.photos.title': 'Photos',
                'tripView.workspace.pages.photos.description': 'Preview memory and album space.',
            };
            return lookup[key] ?? key;
        },
    }),
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
});

describe('shared/tripWorkspace', () => {
    it('normalizes legacy and explicit workspace pages', () => {
        expect(normalizeTripWorkspacePage('plan')).toBe('overview');
        expect(normalizeTripWorkspacePage('travel-kit')).toBe('travel-kit');
        expect(normalizeTripWorkspacePage('places')).toBe('places');
        expect(normalizeTripWorkspacePage('unknown')).toBeNull();
    });

    it('resolves workspace route state and page paths', () => {
        expect(resolveTripWorkspaceRouteState('/trip/trip-1/travel-kit')).toEqual({
            kind: 'trip',
            basePath: '/trip/trip-1',
            page: 'travel-kit',
            hasExplicitPage: true,
        });
        expect(resolveTripWorkspaceRouteState('/example/template-1/planner')).toEqual({
            kind: 'example',
            basePath: '/example/template-1',
            page: 'planner',
            hasExplicitPage: true,
        });
        expect(resolveTripWorkspaceRouteState('/s/share-1')).toEqual({
            kind: 'share',
            basePath: '/s/share-1',
            page: null,
            hasExplicitPage: false,
        });
        expect(buildTripWorkspacePath('/trip/trip-1', 'travel-kit')).toBe('/trip/trip-1/travel-kit');
    });
});

describe('components/tripview/TripWorkspaceShell', () => {
    beforeEach(() => {
        window.localStorage.clear();
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: vi.fn().mockImplementation((query: string) => ({
                matches: !query.includes('max-width'),
                media: query,
                onchange: null,
                addListener: vi.fn(),
                removeListener: vi.fn(),
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                dispatchEvent: vi.fn(),
            })),
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        cleanup();
    });

    it('renders the desktop sidebar, overview widgets, and persists icon-collapse state', async () => {
        const onPageChange = vi.fn();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-04-12T12:00:00Z'));

        render(
            React.createElement(TripWorkspaceShell, {
                trip: buildTrip(),
                tripMeta: {
                    dateRange: 'Apr 10 – Apr 20, 2026',
                    totalDaysLabel: '11',
                    cityCount: 3,
                    distanceLabel: '1,540 km',
                    summaryLine: 'Apr 10 – Apr 20 • 11 days • 3 cities',
                },
                activePage: 'overview',
                onPageChange,
                plannerPage: React.createElement('div', { 'data-testid': 'planner-page' }, 'planner'),
                selectedItem: null,
                selectedCities: [],
                travelerWarnings: [],
                isMobile: false,
                onOpenTripInfoModal: vi.fn(),
                onOpenShare: vi.fn(),
                onOpenSettings: vi.fn(),
            }),
        );

        const sidebarContainer = screen.getByTestId('trip-workspace-sidebar');
        const sidebar = sidebarContainer.closest('[data-slot="sidebar"]');
        const sidebarFrame = document.querySelector('[data-slot="sidebar-container"]');

        expect(sidebar).not.toBeNull();
        expect(sidebarFrame).not.toBeNull();
        expect(sidebar).toHaveAttribute('data-state', 'expanded');
        expect(sidebarFrame).toHaveClass('absolute', 'inset-y-0', 'h-full');
        fireEvent.click(screen.getByRole('button', { name: 'Travel kit' }));
        fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));

        expect(screen.getAllByText('Thailand Highlights').length).toBeGreaterThan(0);
        expect(screen.getByText('Thailand demo')).toBeInTheDocument();
        expect(screen.getByText('Trip overview')).toBeInTheDocument();
        expect(screen.getByText('See the route day by day')).toBeInTheDocument();
        expect(screen.getByText('Follow the route across Thailand')).toBeInTheDocument();
        expect(screen.getByText('Today in Bangkok')).toBeInTheDocument();
        expect(sidebar).toHaveAttribute('data-state', 'collapsed');
        expect(onPageChange).toHaveBeenCalledWith('travel-kit');

        expect(window.localStorage.getItem(TRIP_WORKSPACE_SIDEBAR_STATE_STORAGE_KEY)).toBe('collapsed');

        cleanup();

        render(
            React.createElement(TripWorkspaceShell, {
                trip: buildTrip(),
                tripMeta: {
                    dateRange: 'Apr 10 – Apr 20, 2026',
                    totalDaysLabel: '11',
                    cityCount: 3,
                    distanceLabel: '1,540 km',
                    summaryLine: 'Apr 10 – Apr 20 • 11 days • 3 cities',
                },
                activePage: 'overview',
                onPageChange,
                plannerPage: React.createElement('div', { 'data-testid': 'planner-page' }, 'planner'),
                selectedItem: null,
                selectedCities: [],
                travelerWarnings: [],
                isMobile: false,
                onOpenTripInfoModal: vi.fn(),
                onOpenShare: vi.fn(),
                onOpenSettings: vi.fn(),
            }),
        );

        expect(screen.getByTestId('trip-workspace-sidebar').closest('[data-slot="sidebar"]')).toHaveAttribute('data-state', 'collapsed');
    });

    it('keeps planner-only content inside the planner page shell', () => {
        render(
            React.createElement(TripWorkspaceShell, {
                trip: buildTrip(),
                tripMeta: {
                    dateRange: 'Apr 10 – Apr 20, 2026',
                    totalDaysLabel: '11',
                    cityCount: 3,
                    distanceLabel: '1,540 km',
                    summaryLine: 'Apr 10 – Apr 20 • 11 days • 3 cities',
                },
                activePage: 'planner',
                onPageChange: vi.fn(),
                plannerPage: React.createElement('div', { 'data-testid': 'planner-page' }, 'planner'),
                selectedItem: null,
                selectedCities: [],
                travelerWarnings: [],
                isMobile: false,
                onOpenTripInfoModal: vi.fn(),
                onOpenShare: vi.fn(),
                onOpenSettings: vi.fn(),
            }),
        );

        expect(screen.getByTestId('planner-page')).toBeInTheDocument();
        expect(screen.queryByText('Trip overview')).not.toBeInTheDocument();
    });

    it('renders the mobile bottom navigation and forwards taps', () => {
        const onPageChange = vi.fn();

        render(
            React.createElement(TripWorkspaceMobileNav, {
                tripId: 'trip-thailand',
                activePage: 'overview',
                onPageChange,
            }),
        );

        fireEvent.click(screen.getByRole('button', { name: 'Travel kit' }));

        expect(screen.getByLabelText('Trip workspace navigation')).toBeInTheDocument();
        expect(onPageChange).toHaveBeenCalledWith('travel-kit');
    });
});
