// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ authenticated: false, trackEvent: vi.fn() }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: mocks.authenticated }) }));
vi.mock('../../hooks/useSafeRouteLocation', () => ({ useSafeRouteLocation: () => ({ pathname: '/' }) }));
vi.mock('@/app/navigation', () => ({ Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a> }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => ({ 'common:nav.myTrips': 'My trips', 'common:buttons.seeExampleTrips': 'See example trips' }[key] ?? key) }) }));
vi.mock('gradient-shimmer', () => ({ GradientShimmer: ({ children }: any) => <span>{children}</span> }));
vi.mock('../../components/marketing/PlaneWindow/PlaneWindow', () => ({ PlaneWindow: () => null }));
vi.mock('../../services/analyticsService', () => ({ trackEvent: mocks.trackEvent, getAnalyticsDebugAttributes: () => ({}) }));
import { HeroSection } from '../../components/marketing/HeroSection';
beforeEach(() => { vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })); });
afterEach(() => { cleanup(); mocks.authenticated = false; vi.clearAllMocks(); });
describe('homepage account call to action', () => {
    it('replaces examples with My trips only for a verified signed-in session', async () => {
        const { rerender } = render(<HeroSection />);
        expect(screen.getByRole('link', { name: 'See example trips' })).toHaveAttribute('href', '#examples');
        expect(screen.queryByRole('link', { name: 'My trips' })).toBeNull();
        mocks.authenticated = true;
        rerender(<HeroSection />);
        expect(screen.queryByRole('link', { name: 'See example trips' })).toBeNull();
        const myTrips = screen.getByRole('link', { name: 'My trips' });
        expect(myTrips).toHaveAttribute('href', '/profile');
        await userEvent.setup().click(myTrips);
        expect(mocks.trackEvent).toHaveBeenCalledWith('home__hero_cta--my_trips');
    });
});
