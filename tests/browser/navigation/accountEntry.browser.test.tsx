// @vitest-environment jsdom
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    auth: { isAuthenticated: false, isLoading: true, isAdmin: false, access: null as any },
    openLoginModal: vi.fn(), trackEvent: vi.fn(),
}));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => mocks.auth }));
vi.mock('../../../hooks/useLoginModal', () => ({ useLoginModal: () => ({ openLoginModal: mocks.openLoginModal }) }));
vi.mock('../../../hooks/useSafeRouteLocation', () => ({ useSafeRouteLocation: () => ({ pathname: '/de/features', search: '?from=home', hash: '#benefits' }) }));
vi.mock('../../../services/analyticsService', () => ({ trackEvent: mocks.trackEvent, getAnalyticsDebugAttributes: () => ({}) }));
vi.mock('@/app/navigation', () => ({ NavLink: React.forwardRef<HTMLAnchorElement, any>(({ to, children, ...props }, ref) => <a href={to} ref={ref} {...props}>{children}</a>) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => ({ 'nav.account': 'Account', 'nav.login': 'Login', 'nav.myTrips': 'My Trips' }[key] ?? key) }) }));
vi.mock('../../../components/navigation/AccountMenu', () => ({
    AccountMenuContent: () => <div><span>Verified member</span><button role="menuitem">Profile</button></div>,
}));
import { AccountEntry } from '../../../components/navigation/AccountEntry';

afterEach(() => {
    cleanup();
    const bridge = (window as any).__TF_BOOT__;
    bridge?.dispose?.();
    delete (window as any).__TF_BOOT__;
});
beforeEach(() => { vi.clearAllMocks(); mocks.auth = { isAuthenticated: false, isLoading: true, isAdmin: false, access: null }; });

describe('permanent public Account entry', () => {
    it('keeps the exact trigger node, markup and meaning through guest/member session settlement', () => {
        const { rerender } = render(<AccountEntry />);
        const trigger = screen.getByRole('button', { name: 'Account' });
        const markup = trigger.outerHTML;
        mocks.auth = { ...mocks.auth, isLoading: false };
        rerender(<AccountEntry />);
        expect(screen.getByRole('button', { name: 'Account' })).toBe(trigger);
        expect(trigger.outerHTML).toBe(markup);
        mocks.auth = { isAuthenticated: true, isLoading: false, isAdmin: false, access: { userId: 'member' } };
        rerender(<AccountEntry />);
        expect(screen.getByRole('button', { name: 'Account' })).toBe(trigger);
        expect(trigger.outerHTML).toBe(markup);
        expect(screen.queryByText('Login')).toBeNull();
    });

    it('hydrates SSR Account markup unchanged when a verified member is available before hydration', async () => {
        const container = document.createElement('div');
        container.innerHTML = renderToString(<AccountEntry />);
        document.body.appendChild(container);
        const originalTrigger = container.querySelector('button');
        mocks.auth = { isAuthenticated: true, isLoading: false, isAdmin: false, access: { userId: 'member' } };
        const onRecoverableError = vi.fn();
        let root: ReturnType<typeof hydrateRoot>;
        await act(async () => { root = hydrateRoot(container, <AccountEntry />, { onRecoverableError }); });
        expect(container.querySelector('button')).toBe(originalTrigger);
        expect(originalTrigger).toHaveTextContent('Account');
        expect(onRecoverableError).not.toHaveBeenCalled();
        await act(async () => root.unmount());
        container.remove();
    });

    it('replays a cold SSR press once when the Account owner hydrates under StrictMode', async () => {
        const container = document.createElement('div');
        container.innerHTML = renderToString(<React.StrictMode><AccountEntry /></React.StrictMode>);
        document.body.appendChild(container);
        // Run the exact parser-time bridge before any component handlers exist.
        new Function(fs.readFileSync(path.resolve(__dirname, '../../../src/document/interaction-boot.js'), 'utf8'))();
        const trigger = container.querySelector('button')!;
        trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse', pointerId: 1 }));
        trigger.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
        trigger.click();
        expect(screen.queryByRole('menu')).toBeNull();
        expect((window as any).__TF_BOOT__.pendingControls).toHaveLength(1);
        let root: ReturnType<typeof hydrateRoot>;
        await act(async () => { root = hydrateRoot(container, <React.StrictMode><AccountEntry /></React.StrictMode>); });
        expect(await screen.findByRole('menuitem', { name: 'Login' })).toHaveAttribute('href', '/de/login?next=%2Fde%2Ffeatures%3Ffrom%3Dhome%23benefits');
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
        expect(mocks.trackEvent).toHaveBeenCalledWith('navigation__account_menu--toggle', { open: true });
        expect(mocks.trackEvent.mock.calls.filter(([name]) => name === 'navigation__account_menu--toggle')).toHaveLength(1);
        expect((window as any).__TF_BOOT__.pendingControls).toHaveLength(0);
        await act(async () => root.unmount());
        container.remove();
    });

    it('offers safe real links while unresolved and closes using native keyboard menu behavior', async () => {
        const user = userEvent.setup();
        render(<AccountEntry />);
        const trigger = screen.getByRole('button', { name: 'Account' });
        trigger.focus();
        await user.keyboard('{ArrowDown}');
        expect(screen.getByRole('menuitem', { name: 'Login' })).toHaveAttribute('href', '/de/login?next=%2Fde%2Ffeatures%3Ffrom%3Dhome%23benefits');
        expect(screen.getByRole('menuitem', { name: 'My Trips' })).toHaveAttribute('href', '/trips');
        expect(screen.queryByText('Verified member')).toBeNull();
        expect(screen.queryByRole('progressbar')).toBeNull();
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('menu')).toBeNull();
        expect(trigger).toHaveFocus();
    });

    it('preserves the complete return URL in the unresolved Login link without opening a modal', async () => {
        const user = userEvent.setup();
        const onAction = vi.fn();
        render(<AccountEntry onAction={onAction} />);
        await user.click(screen.getByRole('button', { name: 'Account' }));
        const login = screen.getByRole('menuitem', { name: 'Login' });
        expect(login).toHaveAttribute('href', '/de/login?next=%2Fde%2Ffeatures%3Ffrom%3Dhome%23benefits');
        await user.click(login);
        expect(mocks.openLoginModal).not.toHaveBeenCalled();
        expect(onAction).toHaveBeenCalledOnce();
    });

    it('keeps the established guest Login modal return path after verification', async () => {
        const user = userEvent.setup();
        mocks.auth.isLoading = false;
        render(<AccountEntry />);
        await user.click(screen.getByRole('button', { name: 'Account' }));
        await user.click(screen.getByRole('menuitem', { name: 'Login' }));
        expect(mocks.openLoginModal).toHaveBeenCalledWith({
            source: 'navigation_header', nextPath: '/de/features?from=home#benefits', reloadOnSuccess: true,
        });
        expect(screen.queryByRole('menu')).toBeNull();
    });

    it('preserves a planner-owned login action and notifies the containing navigation', async () => {
        const user = userEvent.setup();
        const onLogin = vi.fn();
        const onAction = vi.fn();
        render(<AccountEntry onLogin={onLogin} onAction={onAction} />);
        await user.click(screen.getByRole('button', { name: 'Account' }));
        await user.click(screen.getByRole('menuitem', { name: 'Login' }));
        expect(onLogin).toHaveBeenCalledOnce();
        expect(onAction).toHaveBeenCalledOnce();
        expect(mocks.openLoginModal).not.toHaveBeenCalled();
        expect(screen.queryByRole('menu')).toBeNull();
    });

    it('keeps the Account entry usable while the owner prevents duplicate login submissions', async () => {
        const user = userEvent.setup();
        const onLogin = vi.fn();
        render(<AccountEntry onLogin={onLogin} isLoginSubmitting />);
        await user.click(screen.getByRole('button', { name: 'Account' }));
        expect(screen.getByRole('menuitem', { name: 'Login' })).toHaveAttribute('aria-disabled', 'true');
        expect(screen.getByRole('menuitem', { name: 'My Trips' })).toHaveAttribute('href', '/trips');
        expect(onLogin).not.toHaveBeenCalled();
    });

    it('opens confirmed member content without replacing the Account trigger', async () => {
        const user = userEvent.setup();
        mocks.auth = { isAuthenticated: true, isLoading: false, isAdmin: false, access: { userId: 'member' } };
        render(<AccountEntry />);
        const trigger = screen.getByRole('button', { name: 'Account' });
        await user.click(trigger);
        expect(await screen.findByText('Verified member')).toBeInTheDocument();
        expect(trigger.isConnected).toBe(true);
        expect(trigger).toHaveTextContent('Account');
    });
});
