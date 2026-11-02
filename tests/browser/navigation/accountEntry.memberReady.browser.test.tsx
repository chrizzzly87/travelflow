// @vitest-environment jsdom
import React from 'react';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import common from '../../../locales/en/common.json';

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), namespaceLoads: [] as string[] }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({
    isAuthenticated: true, isLoading: false, isAdmin: true,
    access: { userId: 'member', email: 'member@example.test' }, profile: null, logout: vi.fn(),
}) }));
vi.mock('../../../hooks/useLoginModal', () => ({ useLoginModal: () => ({ openLoginModal: vi.fn() }) }));
vi.mock('../../../hooks/useSafeRouteLocation', () => ({ useSafeRouteLocation: () => ({ pathname: '/', search: '', hash: '' }) }));
vi.mock('../../../services/analyticsService', () => ({ trackEvent: vi.fn(), getAnalyticsDebugAttributes: () => ({}) }));
vi.mock('../../../services/storageService', () => ({ getAllTrips: () => [{ id: 'saved-trip', title: 'Saved itinerary', createdAt: 100 }] }));
vi.mock('@/app/navigation', () => ({
    useNavigate: () => mocks.navigate,
    NavLink: React.forwardRef<HTMLAnchorElement, any>(({ to, children, ...props }, ref) => <a href={to} ref={ref} {...props}>{children}</a>),
}));
import { AccountEntry } from '../../../components/navigation/AccountEntry';

afterEach(cleanup);
describe('verified member first-open account actions', () => {
    it('renders the complete menu synchronously using the already loaded common namespace', async () => {
        mocks.namespaceLoads = [];
        const i18n = createInstance();
        await i18n.use(initReactI18next).use({
            type: 'backend' as const,
            init() {},
            // Hold any optional namespace indefinitely: first-open controls may
            // not depend on a second translation fetch after the menu opens.
            read(_language: string, namespace: string, callback: (error: unknown, resources: object) => void) {
                mocks.namespaceLoads.push(namespace);
                if (namespace !== 'profile') callback(null, {});
            },
        }).init({
            lng: 'en', fallbackLng: false, ns: ['common'], defaultNS: 'common',
            partialBundledLanguages: true, resources: { en: { common } }, react: { useSuspense: true },
        });
        const triggerHost = render(<I18nextProvider i18n={i18n}><AccountEntry /></I18nextProvider>);
        const trigger = screen.getByRole('button', { name: 'Account' });
        fireEvent.pointerDown(trigger, { button: 0, pointerType: 'mouse', ctrlKey: false });
        // No findBy/waitFor: replacing a temporary two-link menu later is the regression.
        expect(screen.getByRole('menuitem', { name: 'Profile' })).toBeVisible();
        expect(screen.getByRole('menuitem', { name: 'Settings' })).toBeVisible();
        expect(screen.getByRole('menuitem', { name: /Saved itinerary/ })).toBeVisible();
        expect(screen.getByRole('menuitem', { name: 'View all trips' })).toBeVisible();
        expect(screen.getByRole('menuitem', { name: 'Create Trip' })).toBeVisible();
        expect(screen.getByRole('menuitem', { name: 'Admin workspace' })).toBeVisible();
        expect(screen.getByRole('menuitem', { name: 'Logout' })).toBeVisible();
        expect(mocks.namespaceLoads).not.toContain('profile');
        expect(triggerHost.container.querySelector('button')).toBe(trigger);
    });
});
