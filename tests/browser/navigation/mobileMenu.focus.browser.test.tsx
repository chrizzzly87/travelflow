// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithRouter } from '../../helpers/renderWithRouter';
import { MemoryRouter } from '../../helpers/routerHarness';
import { MobileMenu } from '../../../components/navigation/MobileMenu';

vi.mock('../../../hooks/useHasSavedTrips', () => ({ useHasSavedTrips: () => false }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: true, isLoading: false, isAdmin: false, profile: null, access: { userId: 'member', email: 'member@example.test' }, logout: vi.fn() }) }));
vi.mock('../../../hooks/useLoginModal', () => ({ useLoginModal: () => ({ openLoginModal: vi.fn() }) }));
const localeMocks = vi.hoisted(() => ({ changeLocale: vi.fn() }));
vi.mock('../../../hooks/useLocaleNavigation', () => ({ useLocaleNavigation: () => localeMocks.changeLocale }));
vi.mock('../../../components/ui/ThemeToggle', () => ({ ThemeToggle: () => <button type="button">Theme</button> }));
vi.mock('../../../services/analyticsService', () => ({ trackEvent: vi.fn(), getAnalyticsDebugAttributes: () => ({}) }));
vi.mock('react-i18next', async importOriginal => ({
    ...await importOriginal<typeof import('react-i18next')>(),
    useTranslation: () => ({ t: (key: string) => ({ 'language.label': 'Language', 'nav.account': 'Account', 'nav.login': 'Login', 'nav.myTrips': 'My trips' }[key] || key), i18n: { language: 'en', resolvedLanguage: 'en' } }),
}));

beforeAll(() => {
    if (!HTMLElement.prototype.scrollIntoView) HTMLElement.prototype.scrollIntoView = () => {};
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('nested mobile account focus', () => {
    it('keeps verified-member keyboard focus inside the mobile panel and Escape closes only the innermost menu', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        await renderWithRouter(<MemoryRouter><MobileMenu isOpen onClose={onClose} /></MemoryRouter>);
        await user.click(screen.getByRole('button', { name: 'Account' }));
        const menu = screen.getByRole('menu', { name: 'Account' });
        const panel = screen.getByRole('dialog', { name: 'Navigation menu' });
        expect(panel.parentElement).toBe(document.body);
        expect(panel).toContainElement(menu);
        await user.keyboard('{ArrowDown}');
        expect(menu).toContainElement(document.activeElement as HTMLElement);
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('menu', { name: 'Account' })).toBeNull();
        expect(onClose).not.toHaveBeenCalled();
        expect(screen.getByRole('dialog', { name: 'Navigation menu' })).toBeInTheDocument();
        await user.keyboard('{Escape}');
        expect(onClose).toHaveBeenCalledOnce();
    });
    it('contains the real language listbox within the navigation focus boundary', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        await renderWithRouter(<MemoryRouter><MobileMenu isOpen onClose={onClose} /></MemoryRouter>);
        fireEvent.keyDown(screen.getByRole('combobox', { name: 'Language' }), { key: 'ArrowDown' });
        const listbox = screen.getByRole('listbox');
        expect(screen.getByRole('dialog', { name: 'Navigation menu' })).toContainElement(listbox);
        await user.click(screen.getByRole('option', { name: 'Deutsch' }));
        expect(localeMocks.changeLocale).toHaveBeenCalledWith('de');
        expect(onClose).toHaveBeenCalledOnce();
    });

});
