// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { createInstance } from 'i18next';
import { useFocusTrap } from '../../../hooks/useFocusTrap';
import common from '../../../locales/en/common.json';
import { decodeTripPrefill } from '../../../services/tripPrefillDecoder';
import type { TripGenerationInputSnapshot } from '../../../types';

const mocks = vi.hoisted(() => ({ loginModal: vi.fn(() => ({ isLoginModalOpen: false })) }));
vi.mock('../../../hooks/useLoginModal', () => ({ useLoginModal: mocks.loginModal }));

vi.mock('@/app/navigation', () => ({
    Link: React.forwardRef<HTMLAnchorElement, React.PropsWithChildren<{ to: string }>>(({ to, children, ...props }, ref) => <a href={to} ref={ref} {...props}>{children}</a>),
}));
vi.mock('../../../services/analyticsService', () => ({ trackEvent: vi.fn(), getAnalyticsDebugAttributes: () => ({}) }));
import { TripClaimConflictDialog } from '../../../components/tripview/TripClaimConflictDialog';

afterEach(cleanup);
const snapshot: TripGenerationInputSnapshot = {
    flow: 'wizard', destinationLabel: 'Mallorca', startDate: '2026-06-01', endDate: '2026-06-08',
    createdAt: '2026-01-01T00:00:00Z',
    payload: { wizardBranch: 'known_destinations_flexible_dates', options: {
        countries: ['Mallorca, Spain'], startDestination: 'Mallorca, Spain', destinationOrder: ['Mallorca, Spain'],
        selectedIslandNames: ['Mallorca, Spain'], travelerType: 'friends', travelerDetails: { friendsCount: 4 },
        transportPreferences: ['car'], notes: 'Keep our beaches', routeLock: true,
    } },
};

const setup = async (loggedOut = true) => {
    mocks.loginModal.mockReturnValue({ isLoginModalOpen: false });
    const i18n = createInstance();
    await i18n.use(initReactI18next).init({ lng: 'en', resources: { en: { common } }, defaultNS: 'common' });
    const onLogin = vi.fn();
    render(<I18nextProvider i18n={i18n}>
        <button>Outside</button>
        <TripClaimConflictDialog tripId="trip-1" claimConflictTrip={{ title: 'Island trip', aiMeta: {
            provider: 'openai', model: 'gpt-5.4', generatedAt: '2026-01-01T00:00:00Z',
            generation: { state: 'failed', inputSnapshot: snapshot },
        } }} claimConflictPathname="/de/trip/trip-1" claimConflictShowLoginCta={loggedOut}
            onClaimConflictLogin={onLogin} loadingDestinationSummary="Mallorca" tripDateRange="June 1–8" tripSpanCompactLabel="8 days" />
    </I18nextProvider>);
    return onLogin;
};

describe('claim conflict recovery ownership', () => {
    it('has the complete normalized localized prefill in the first displayed link', async () => {
        await setup();
        // Synchronous query: no secondary render fills or repairs the destination.
        const link = screen.getByRole('link', { name: common.tripView.claimConflict.createSimilarCta });
        const href = new URL(link.getAttribute('href')!, 'https://travelflow.local');
        expect(href.pathname).toBe('/de/create-trip/wizard');
        expect(decodeTripPrefill(href.searchParams.get('prefill')!)).toMatchObject({
            countries: ['Mallorca'], notes: 'Keep our beaches',
            meta: { draft: { startDestination: 'Mallorca', selectedIslandNames: ['Mallorca'], routeLock: true,
                travelerDetails: { friendsCount: 4 }, transportPreferences: ['car'] } },
        });
    });

    it('focuses a real action, traps outside focus and preserves explicit recovery choices', async () => {
        const onLogin = await setup();
        const dialog = screen.getByRole('dialog', { name: common.tripView.claimConflict.title });
        const login = screen.getByRole('button', { name: common.tripView.claimConflict.loginCta });
        await waitFor(() => expect(document.activeElement).toBe(login));
        screen.getByRole('button', { name: 'Outside', hidden: true }).focus();
        expect(dialog.contains(document.activeElement)).toBe(true);
        fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
        expect(dialog).toBeInTheDocument();
        fireEvent.click(login);
        expect(onLogin).toHaveBeenCalledOnce();
    });

    it('focuses the complete create-similar action when already signed in', async () => {
        await setup(false);
        const link = screen.getByRole('link', { name: common.tripView.claimConflict.createSimilarCta });
        await waitFor(() => expect(document.activeElement).toBe(link));
        expect(screen.queryByRole('button', { name: common.tripView.claimConflict.loginCta })).toBeNull();
    });

    it('hands focus to the existing login trap and restores the recovery action after closing login', async () => {
        const i18n = createInstance();
        await i18n.use(initReactI18next).init({ lng: 'en', resources: { en: { common } }, defaultNS: 'common' });
        const LoginFocusBoundary = ({ onClose }: { onClose: () => void }) => {
            const containerRef = React.useRef<HTMLDivElement>(null);
            const closeRef = React.useRef<HTMLButtonElement>(null);
            // AuthModal uses this exact shared custom focus trap rather than Radix.
            useFocusTrap({ isActive: true, containerRef, initialFocusRef: closeRef });
            return <div ref={containerRef} role="dialog" aria-label="Authentication modal"><button ref={closeRef} onClick={onClose}>Close login</button></div>;
        };
        const Harness = () => {
            const [isLoginModalOpen, setLoginOpen] = React.useState(false);
            mocks.loginModal.mockReturnValue({ isLoginModalOpen });
            return <>
                <TripClaimConflictDialog tripId="trip-1" claimConflictTrip={{ title: 'Island' }}
                    claimConflictPathname="/trip/trip-1" claimConflictShowLoginCta onClaimConflictLogin={() => setLoginOpen(true)}
                    loadingDestinationSummary="Island" tripDateRange="June" tripSpanCompactLabel="8 days" />
                {isLoginModalOpen && <LoginFocusBoundary onClose={() => setLoginOpen(false)} />}
            </>;
        };
        render(<I18nextProvider i18n={i18n}><Harness /></I18nextProvider>);
        fireEvent.click(screen.getByRole('button', { name: common.tripView.claimConflict.loginCta }));
        const close = screen.getByRole('button', { name: 'Close login' });
        await waitFor(() => expect(document.activeElement).toBe(close));
        expect(screen.queryByRole('dialog', { name: common.tripView.claimConflict.title })).toBeNull();
        fireEvent.click(close);
        await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: common.tripView.claimConflict.loginCta })));
    });

});
