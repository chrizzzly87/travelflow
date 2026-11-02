// @vitest-environment jsdom
import React from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot, type Root } from 'react-dom/client';
import { act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makeCityItem, makeTrip } from '../helpers/tripFixtures';
import type { PublicProfilePageData } from '../../shared/publicProfile';

const mocks = vi.hoisted(() => ({
    getPublicTripsPageByUserId: vi.fn(),
    resolvePublicProfileByHandle: vi.fn(),
    auth: {
        isLoading: false,
        isAuthenticated: true,
        isAdmin: true,
        profile: { id: 'user-1', username: 'traveler', publicProfileEnabled: true, passportStickerSelection: [] } as Record<string, unknown>,
    },
}));

// Server rendering has no router; plain anchors keep the markup comparable.
vi.mock('@/app/navigation', () => ({
    NavLink: ({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) => <a href={to} className={className}>{children}</a>,
    Link: ({ to, children, className, onClick }: { to: string; children: React.ReactNode; className?: string; onClick?: () => void }) => <a href={to} className={className} onClick={onClick}>{children}</a>,
    useSearchParams: () => [new URLSearchParams(), () => {}],
}));
vi.mock('../../components/navigation/SiteHeader', () => ({ SiteHeader: () => <header /> }));
vi.mock('../../components/marketing/SiteFooter', () => ({ SiteFooter: () => <footer /> }));
vi.mock('../../services/profileService', () => ({
    getPublicTripsPageByUserId: mocks.getPublicTripsPageByUserId,
    resolvePublicProfileByHandle: mocks.resolvePublicProfileByHandle,
}));
vi.mock('../../services/analyticsService', () => ({ trackEvent: vi.fn(), getAnalyticsDebugAttributes: () => ({}) }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => mocks.auth }));
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en', resolvedLanguage: 'en' } }),
}));

import { PublicProfilePage } from '../../pages/PublicProfilePage';

const data: PublicProfilePageData = {
    status: 'found',
    profile: { id: 'user-1', username: 'traveler', usernameDisplay: 'traveler', displayName: 'Traveler One', firstName: 'Traveler', lastName: 'One', bio: 'Slow travel fan', country: 'TH', city: 'Bangkok' },
    tripsPage: {
        trips: [makeTrip({ id: 'trip-1', title: 'Island Hopping', showOnPublicProfile: true, items: [makeCityItem({ id: 'c1', title: 'Krabi', startDateOffset: 0, duration: 3 })] })],
        hasMore: false,
        nextOffset: 1,
    },
    tripsFailed: false,
};

describe('public profile server rendering', () => {
    it('server-renders the profile and trips, then adds owner and admin UI only after hydration', async () => {
        const tree = <PublicProfilePage username="traveler" data={data} />;
        const html = renderToString(tree);

        // The CDN-cached document has the content but nothing viewer-specific.
        expect(html).toContain('Traveler One');
        expect(html).toContain('Slow travel fan');
        expect(html).toContain('Island Hopping');
        expect(html).not.toContain('summary.editProfile');
        expect(html).not.toContain('publicProfile.visibilityPublic');

        const container = document.createElement('div');
        container.innerHTML = html;
        document.body.appendChild(container);
        const recoverable = vi.fn();
        let root: Root | undefined;
        try {
            await act(async () => { root = hydrateRoot(container, tree, { onRecoverableError: recoverable }); });
            await waitFor(() => expect(container.querySelector('a[href="/profile/settings"]')).not.toBeNull());
            expect(container).toHaveTextContent('publicProfile.visibilityPublic');
            expect(recoverable).not.toHaveBeenCalled();
            expect(mocks.getPublicTripsPageByUserId).not.toHaveBeenCalled();
        } finally {
            await act(async () => root?.unmount());
            container.remove();
        }
    });
});
