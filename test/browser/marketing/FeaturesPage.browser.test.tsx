// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import featuresLocale from '../../../locales/en/features.json';

const trackEventMock = vi.fn();
const warmRouteAssetsMock = vi.fn();
const originalGetContext = HTMLCanvasElement.prototype.getContext;
const { runtimeLocationSnapshot } = vi.hoisted(() => ({
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
    ensureRuntimeLocationLoaded: vi.fn().mockResolvedValue(runtimeLocationSnapshot),
    subscribeRuntimeLocation: () => () => undefined,
}));

const getNestedValue = (key: string): unknown => key.split('.').reduce<unknown>((current, part) => {
    if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
        return (current as Record<string, unknown>)[part];
    }
    return undefined;
}, featuresLocale as unknown);

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: { returnObjects?: boolean }) => {
            const value = getNestedValue(key);
            if (options?.returnObjects) return value;
            return typeof value === 'string' ? value : key;
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
        HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as typeof HTMLCanvasElement.prototype.getContext;
    });

    afterEach(() => {
        cleanup();
        HTMLCanvasElement.prototype.getContext = originalGetContext;
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

    it('keeps the globe wrapper width-constrained for mobile layouts', () => {
        render(
            <MemoryRouter initialEntries={['/features']}>
                <FeaturesPage />
            </MemoryRouter>
        );

        const globe = screen.getByRole('img', { name: featuresLocale.globe.accessibility });

        expect(globe.className).toContain('w-full');
        expect(globe.className).toContain('max-w-[34rem]');
        expect(globe.className).not.toContain('aspect-[1.02/0.98]');
        expect(globe.className).not.toContain('min-h-[480px]');
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
