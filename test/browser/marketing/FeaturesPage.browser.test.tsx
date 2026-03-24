// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import featuresLocale from '../../../locales/en/features.json';

const trackEventMock = vi.fn();
const warmRouteAssetsMock = vi.fn();
const originalGetContext = HTMLCanvasElement.prototype.getContext;
const originalIntersectionObserver = globalThis.IntersectionObserver;
const observerInstances: MockIntersectionObserver[] = [];

const {
    ensureRuntimeLocationLoadedMock,
    fetchNearbyAirportsMock,
    runtimeLocationSnapshot,
} = vi.hoisted(() => ({
    ensureRuntimeLocationLoadedMock: vi.fn(),
    fetchNearbyAirportsMock: vi.fn(),
    runtimeLocationSnapshot: {
        available: false,
        source: 'unavailable' as const,
        fetchedAt: null,
        loading: false,
        location: {
            city: null,
            countryCode: null,
            countryName: null,
            subdivisionCode: null,
            subdivisionName: null,
            latitude: null,
            longitude: null,
            timezone: null,
            postalCode: null,
        },
    },
}));

class MockIntersectionObserver {
    readonly callback: IntersectionObserverCallback;
    readonly elements = new Set<Element>();
    readonly observe = vi.fn((element: Element) => {
        this.elements.add(element);
    });
    readonly disconnect = vi.fn(() => {
        this.elements.clear();
    });
    readonly unobserve = vi.fn((element: Element) => {
        this.elements.delete(element);
    });
    readonly takeRecords = vi.fn(() => []);

    constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
        observerInstances.push(this);
    }
}

const triggerIntersection = (
    target: Element,
    options?: { intersectionRatio?: number; isIntersecting?: boolean },
) => {
    const intersectionRatio = options?.intersectionRatio ?? 1;
    const isIntersecting = options?.isIntersecting ?? true;

    observerInstances.forEach((observer) => {
        if (!observer.elements.has(target)) return;

        observer.callback([
            {
                boundingClientRect: target.getBoundingClientRect(),
                intersectionRatio,
                intersectionRect: target.getBoundingClientRect(),
                isIntersecting,
                rootBounds: null,
                target,
                time: Date.now(),
            } as IntersectionObserverEntry,
        ], observer as unknown as IntersectionObserver);
    });
};

vi.mock('cobe', () => ({
    default: () => {
        throw new Error('webgl unavailable');
    },
}));

vi.mock('../../../components/marketing/MarketingLayout', () => ({
    MarketingLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../../services/analyticsService', () => ({
    trackEvent: (...args: unknown[]) => trackEventMock(...args),
    getAnalyticsDebugAttributes: () => ({}),
}));

vi.mock('../../../services/navigationPrefetch', () => ({
    warmRouteAssets: (...args: unknown[]) => warmRouteAssetsMock(...args),
}));

vi.mock('../../../services/runtimeLocationService', () => ({
    getRuntimeLocationSnapshot: () => runtimeLocationSnapshot,
    ensureRuntimeLocationLoaded: (...args: unknown[]) => ensureRuntimeLocationLoadedMock(...args),
    subscribeRuntimeLocation: () => () => undefined,
}));

vi.mock('../../../services/nearbyAirportsService', () => ({
    fetchNearbyAirports: (...args: unknown[]) => fetchNearbyAirportsMock(...args),
}));

const getNestedValue = (key: string): unknown => key.split('.').reduce<unknown>((current, part) => {
    if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
        return (current as Record<string, unknown>)[part];
    }
    return undefined;
}, featuresLocale as unknown);

const interpolateString = (template: string, options?: Record<string, unknown>) => template.replace(
    /\{(\w+)\}/g,
    (_, key: string) => {
        const value = options?.[key];
        return value == null ? `{${key}}` : String(value);
    },
);

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: { returnObjects?: boolean } & Record<string, unknown>) => {
            const value = getNestedValue(key);
            if (options?.returnObjects) return value;
            return typeof value === 'string' ? interpolateString(value, options) : key;
        },
        i18n: {
            language: 'en',
            resolvedLanguage: 'en',
        },
    }),
}));

import { FeaturesPage } from '../../../pages/FeaturesPage';

describe('pages/FeaturesPage', () => {
    beforeEach(() => {
        cleanup();
        trackEventMock.mockReset();
        warmRouteAssetsMock.mockReset();
        ensureRuntimeLocationLoadedMock.mockReset();
        fetchNearbyAirportsMock.mockReset();
        ensureRuntimeLocationLoadedMock.mockResolvedValue(runtimeLocationSnapshot);
        HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as typeof HTMLCanvasElement.prototype.getContext;
        observerInstances.splice(0, observerInstances.length);
        Object.defineProperty(globalThis, 'IntersectionObserver', {
            configurable: true,
            value: MockIntersectionObserver,
            writable: true,
        });
    });

    afterEach(() => {
        cleanup();
        HTMLCanvasElement.prototype.getContext = originalGetContext;
        Object.defineProperty(globalThis, 'IntersectionObserver', {
            configurable: true,
            value: originalIntersectionObserver,
            writable: true,
        });
    });

    it('renders the new hero CTAs and tracks hero clicks', () => {
        render(
            <MemoryRouter initialEntries={['/features']}>
                <FeaturesPage />
            </MemoryRouter>
        );

        const startPlanningCta = screen.getAllByRole('link', { name: featuresLocale.hero.primaryCta })[0];
        const seeExamplesCta = screen.getByRole('link', { name: featuresLocale.hero.secondaryCta });

        fireEvent.click(startPlanningCta);
        fireEvent.click(seeExamplesCta);

        expect(trackEventMock).toHaveBeenCalledWith('features__hero_cta--start_planning');
        expect(trackEventMock).toHaveBeenCalledWith('features__hero_cta--see_examples');
    });

    it('shows the globe fallback card when interactive globe setup fails', async () => {
        render(
            <MemoryRouter initialEntries={['/features']}>
                <FeaturesPage />
            </MemoryRouter>
        );

        expect(screen.getByRole('heading', { name: /ready to go/i })).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByText(featuresLocale.globe.fallbackTitle)).toBeInTheDocument();
        });

        expect(screen.getByText(featuresLocale.globe.fallbackDescription)).toBeInTheDocument();
    });

    it('keeps the globe compact enough for the original hero layout while reducing dead space', () => {
        render(
            <MemoryRouter initialEntries={['/features']}>
                <FeaturesPage />
            </MemoryRouter>
        );

        const globe = screen.getByRole('img', { name: featuresLocale.globe.accessibility });

        expect(globe.className).toContain('w-full');
        expect(globe.className).toContain('max-w-[35rem]');
        expect(globe.className).toContain('h-[min(90vw,25rem)]');
        expect(globe.className).not.toContain('aspect-[1.02/0.98]');
        expect(globe.className).not.toContain('min-h-[480px]');
    });

    it('prefetches the nearby-airport lookup before full visibility but flips the departure board only when the card is visible enough', async () => {
        ensureRuntimeLocationLoadedMock.mockResolvedValue({
            available: true,
            source: 'netlify-context',
            fetchedAt: '2026-03-23T09:00:00.000Z',
            loading: false,
            location: {
                city: 'Berlin',
                countryCode: 'DE',
                countryName: 'Germany',
                subdivisionCode: 'DE-BE',
                subdivisionName: 'Berlin',
                latitude: 52.52,
                longitude: 13.405,
                timezone: 'Europe/Berlin',
                postalCode: '10115',
            },
        });
        fetchNearbyAirportsMock.mockResolvedValue({
            dataVersion: 'test-airports',
            origin: { lat: 52.52, lng: 13.405 },
            airports: [
                {
                    airDistanceKm: 18.5,
                    rank: 1,
                    airport: {
                        ident: 'EDDB',
                        iataCode: 'BER',
                        icaoCode: 'EDDB',
                        name: 'Berlin Brandenburg Airport',
                        municipality: 'Berlin',
                        subdivisionName: 'Berlin',
                        regionCode: 'DE-BE',
                        countryCode: 'DE',
                        countryName: 'Germany',
                        latitude: 52.3667,
                        longitude: 13.5033,
                        timezone: 'Europe/Berlin',
                        airportType: 'large_airport',
                        scheduledService: true,
                        isCommercial: true,
                        commercialServiceTier: 'major',
                        isMajorCommercial: true,
                    },
                },
            ],
        });
        render(
            <MemoryRouter initialEntries={['/features']}>
                <FeaturesPage />
            </MemoryRouter>
        );
        const airportCard = screen.getByTestId('features-airport-card');

        expect(airportCard.className).toContain('md:col-span-6');
        expect(screen.getByRole('img', { name: 'DXB' })).toBeInTheDocument();
        expect(screen.getByRole('img', { name: 'CDG' })).toBeInTheDocument();
        expect(screen.getByTestId('features-airport-route').className).toContain('justify-between');
        expect(fetchNearbyAirportsMock).not.toHaveBeenCalled();

        triggerIntersection(airportCard, { intersectionRatio: 0.2, isIntersecting: true });

        await waitFor(() => {
            expect(ensureRuntimeLocationLoadedMock).toHaveBeenCalled();
            expect(fetchNearbyAirportsMock).toHaveBeenCalledWith(expect.objectContaining({
                lat: 52.52,
                lng: 13.405,
                limit: 5,
                minimumServiceTier: 'major',
            }));
        });

        expect(screen.getByRole('img', { name: 'DXB' })).toBeInTheDocument();
        expect(screen.queryByRole('img', { name: 'BER' })).not.toBeInTheDocument();

        triggerIntersection(airportCard, { intersectionRatio: 0.5, isIntersecting: true });
        await Promise.resolve();

        expect(screen.getByRole('img', { name: 'DXB' })).toBeInTheDocument();
        expect(screen.queryByRole('img', { name: 'BER' })).not.toBeInTheDocument();

        triggerIntersection(airportCard, { intersectionRatio: 1, isIntersecting: true });

        await waitFor(() => {
            expect(screen.getByRole('img', { name: 'BER' })).toBeInTheDocument();
        });

        expect(screen.queryByText(/starting near berlin/i)).not.toBeInTheDocument();
    });

    it('keeps the origin marker above the globe canvas', () => {
        render(
            <MemoryRouter initialEntries={['/features']}>
                <FeaturesPage />
            </MemoryRouter>
        );

        const globe = screen.getByRole('img', { name: featuresLocale.globe.accessibility });
        const originMarkerLayer = globe.firstElementChild;

        expect(originMarkerLayer).not.toBeNull();
        expect(originMarkerLayer).toHaveClass('z-20');
    });
});
