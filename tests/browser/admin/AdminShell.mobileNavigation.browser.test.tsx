// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('@/app/navigation', () => ({
  NavLink: ({ to, children, className, end: _end, ...props }: {
    to: string;
    children: React.ReactNode;
    className?: string | ((state: { isActive: boolean; isPending: boolean }) => string);
    end?: boolean;
  }) => React.createElement('a', {
    href: to,
    className: typeof className === 'function' ? className({ isActive: false, isPending: false }) : className,
    ...props,
  }, children),
  useLocation: () => ({ pathname: '/admin/dashboard', search: '', hash: '' }),
}));

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ access: null, isAdmin: false }),
}));

vi.mock('../../../services/analyticsService', () => ({
  trackEvent: vi.fn(),
  getAnalyticsDebugAttributes: () => ({}),
}));

vi.mock('../../../components/navigation/AccountMenu', () => ({
  AccountMenu: () => null,
}));

import { AdminShell } from '../../../components/admin/AdminShell';

describe('components/admin/AdminShell mobile navigation', () => {
  const renderShell = () => render(
    <AdminShell title="Dashboard" showGlobalSearch={false} showDateRange={false}>
      <p>Body</p>
    </AdminShell>,
  );

  it('does not mount the drawer while it is closed', () => {
    renderShell();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens a modal dialog, focuses its close control, closes on Escape and returns focus', async () => {
    renderShell();

    const trigger = screen.getByRole('button', { name: 'Open navigation' });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole('dialog', { name: 'Admin navigation' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Close navigation' })).toHaveFocus();
    });

    fireEvent.keyDown(dialog, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });
});
