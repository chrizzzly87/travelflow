// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

const state = vi.hoisted(() => ({ imports: vi.fn(), loads: vi.fn() }));
vi.mock('../../../components/tripview/TripClaimConflictDialog', () => {
    state.imports();
    return { TripClaimConflictDialog: ({ tripId }: { tripId: string }) => <div role="dialog">Recovery {tripId}</div> };
});
vi.mock('../../../services/lazyImportRecovery', () => ({
    loadLazyComponentWithRecovery: async (key: string, importer: () => Promise<unknown>) => {
        state.loads(key);
        return importer();
    },
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/app/navigation', () => ({ Link: ({ to, children }: React.PropsWithChildren<{ to: string }>) => <a href={to}>{children}</a> }));
vi.mock('../../../services/analyticsService', () => ({ trackEvent: vi.fn(), getAnalyticsDebugAttributes: () => ({}) }));
import { TripViewHudOverlays } from '../../../components/tripview/TripViewHudOverlays';
import { preloadTripClaimConflictDialog } from '../../../components/tripview/tripClaimRecoveryBoundary';

afterEach(cleanup);
describe('optional trip claim recovery boundary', () => {
    it('keeps ordinary trip viewing free of recovery initialization and preloads only for a conflict', async () => {
        const props = {
            tripId: 'trip-1', isAgentLauncherVisible: false, isPaywallLocked: false, expirationLabel: null,
            paywallActivationMode: 'login_modal' as const, onPaywallActivateClick: vi.fn(),
            showGenerationOverlay: false, generationProgressMessage: '', loadingDestinationSummary: 'Island',
            tripDateRange: 'June', tripSpanCompactLabel: '8 days',
        };
        const host = render(<TripViewHudOverlays {...props} />);
        expect(state.imports).not.toHaveBeenCalled();
        expect(state.loads).not.toHaveBeenCalled();
        await Promise.all([preloadTripClaimConflictDialog(), preloadTripClaimConflictDialog()]);
        expect(state.imports).toHaveBeenCalledOnce();
        expect(state.loads).toHaveBeenCalledExactlyOnceWith('TripClaimConflictDialog');
        host.rerender(<TripViewHudOverlays {...props} claimConflictModalVisible claimConflictTrip={{ title: 'Island' }} claimConflictPathname="/trip/trip-1" />);
        // Native-route preload makes the first conflict render complete, without a suspense placeholder.
        expect(screen.getByRole('dialog')).toHaveTextContent('Recovery trip-1');
        await preloadTripClaimConflictDialog();
        expect(state.loads).toHaveBeenCalledOnce();
    });
});
