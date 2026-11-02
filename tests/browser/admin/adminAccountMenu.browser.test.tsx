// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  logout: vi.fn(async () => undefined),
  trackEvent: vi.fn(),
}));

vi.mock('@/app/navigation', () => ({ useNavigate: () => mocks.navigate }));

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    access: { userId: 'admin-1', email: 'ada@example.com' },
    profile: { firstName: 'Ada', lastName: 'Lovelace' },
    logout: mocks.logout,
  }),
}));

vi.mock('../../../services/analyticsService', () => ({
  trackEvent: mocks.trackEvent,
  getAnalyticsDebugAttributes: () => ({}),
}));

import { AdminAccountMenu } from '../../../components/admin/AdminAccountMenu';

describe('components/admin/AdminAccountMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the admin with name and email, and opens upwards from the sidebar foot', async () => {
    const user = userEvent.setup();
    render(<AdminAccountMenu />);

    const trigger = screen.getByRole('button', { name: /Ada Lovelace/ });
    expect(trigger.textContent).toContain('AL');
    expect(trigger.textContent).toContain('ada@example.com');

    await user.click(trigger);
    const menu = await screen.findByRole('menu');
    expect(menu.getAttribute('data-side')).toBe('top');
    expect(screen.getByRole('menuitem', { name: 'Profile' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Back to TravelFlow' })).toBeInTheDocument();
  });

  it('fits the icon rail: avatar only, named for assistive tech, menu beside the rail', async () => {
    const user = userEvent.setup();
    render(<AdminAccountMenu collapsed />);

    const trigger = screen.getByRole('button', { name: 'Account: Ada Lovelace' });
    expect(trigger.textContent).toBe('AL');

    await user.click(trigger);
    expect((await screen.findByRole('menu')).getAttribute('data-side')).toBe('right');
  });

  it('navigates from its items and signs out from the last one', async () => {
    const user = userEvent.setup();
    render(<AdminAccountMenu />);

    await user.click(screen.getByRole('button', { name: /Ada Lovelace/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Account settings' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/profile/settings');
    expect(mocks.trackEvent).toHaveBeenCalledWith('admin__account--settings');

    await user.click(screen.getByRole('button', { name: /Ada Lovelace/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Log out' }));
    await waitFor(() => expect(mocks.logout).toHaveBeenCalledOnce());
    expect(mocks.navigate).toHaveBeenLastCalledWith('/');
  });
});
