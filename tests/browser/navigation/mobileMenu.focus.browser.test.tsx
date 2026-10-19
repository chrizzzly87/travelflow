// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithRouter } from '../../helpers/renderWithRouter';
import { MemoryRouter } from '../../helpers/routerHarness';
import { MobileMenu } from '../../../components/navigation/MobileMenu';

vi.mock('../../../hooks/useHasSavedTrips', () => ({ useHasSavedTrips: () => false }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: false, isLoading: false }) }));
vi.mock('../../../hooks/useLoginModal', () => ({ useLoginModal: () => ({ openLoginModal: vi.fn() }) }));
vi.mock('../../../components/navigation/LanguageSelect', () => ({ LanguageSelect: () => <button type="button">Language</button> }));
vi.mock('../../../components/ui/ThemeToggle', () => ({ ThemeToggle: () => <button type="button">Theme</button> }));
vi.mock('../../../services/analyticsService', () => ({ trackEvent: vi.fn(), getAnalyticsDebugAttributes: () => ({}) }));
vi.mock('react-i18next', async importOriginal => ({
    ...await importOriginal<typeof import('react-i18next')>(),
    useTranslation: () => ({ t: (key: string) => ({ 'nav.account': 'Account', 'nav.login': 'Login', 'nav.myTrips': 'My trips' }[key] || key), i18n: { language: 'en', resolvedLanguage: 'en' } }),
}));

afterEach(cleanup);

describe('nested mobile account focus', () => {
    it('keeps keyboard focus inside the mobile panel and Escape closes only the innermost menu', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        await renderWithRouter(<MemoryRouter><MobileMenu isOpen onClose={onClose} /></MemoryRouter>);
        await user.click(screen.getByRole('button', { name: 'Account' }));
        const menu = screen.getByRole('menu', { name: 'Account' });
        expect(screen.getByRole('dialog', { name: 'Navigation menu' })).toContainElement(menu);
        await user.keyboard('{ArrowDown}');
        expect(menu).toContainElement(document.activeElement as HTMLElement);
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('menu', { name: 'Account' })).toBeNull();
        expect(onClose).not.toHaveBeenCalled();
        expect(screen.getByRole('dialog', { name: 'Navigation menu' })).toBeInTheDocument();
        await user.keyboard('{Escape}');
        expect(onClose).toHaveBeenCalledOnce();
    });
});
