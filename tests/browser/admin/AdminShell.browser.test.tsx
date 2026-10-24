// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ access: { userId: 'admin-1', email: 'admin@example.com' }, isAdmin: true }),
}));

vi.mock('../../../components/navigation/AccountMenu', () => ({
  AccountMenu: () => React.createElement('div', { 'data-testid': 'account-menu' }),
}));

vi.mock('../../../components/ui/ThemeToggle', () => ({
  ThemeToggle: () => React.createElement('button', { type: 'button' }, 'Theme'),
}));

vi.mock('../../../contexts/theme/useTheme', () => ({
  useTheme: () => ({ resolvedTheme: 'light', toggle: vi.fn(), preference: 'light', setPreference: vi.fn() }),
}));

vi.mock('../../../services/analyticsService', () => ({
  trackEvent: vi.fn(),
  getAnalyticsDebugAttributes: () => ({}),
}));

import { AdminShell } from '../../../components/admin/AdminShell';

const h = React.createElement;

// jsdom has no ResizeObserver; Recharts' ResponsiveContainer and cmdk both observe size.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= function scrollIntoView() {};

const LocationProbe: React.FC = () => {
  const location = useLocation();
  return h('output', { 'data-testid': 'location' }, location.pathname);
};

const renderShell = (path: string, props: Partial<React.ComponentProps<typeof AdminShell>> = {}) => render(
  h(MemoryRouter, { initialEntries: [path] },
    h(Routes, null,
      h(Route, {
        path: '*',
        element: h(React.Fragment, null,
          h(AdminShell, { title: 'Page title', description: 'Page purpose.', ...props }, h('p', null, 'Page body')),
          h(LocationProbe)),
      }))),
);

describe('AdminShell', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('renders the page header and a breadcrumb for the active section', () => {
    renderShell('/admin/ai-benchmark/telemetry');

    expect(screen.getByRole('heading', { level: 1, name: 'Page title' })).toBeTruthy();
    expect(screen.getByText('Page purpose.')).toBeTruthy();
    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(breadcrumb).getByText('Tools')).toBeTruthy();
    expect(within(breadcrumb).getByText('AI telemetry').getAttribute('aria-current')).toBe('page');
  });

  it('marks only the longest matching nav item as current', () => {
    renderShell('/admin/ai-benchmark/telemetry');

    const nav = screen.getAllByRole('navigation', { name: 'Admin sections' })[0];
    const current = within(nav).getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current.map((link) => link.textContent)).toEqual(['AI telemetry']);
  });

  it('opens the command palette with ⌘K and navigates to the chosen screen', async () => {
    const user = userEvent.setup();
    renderShell('/admin/dashboard');

    await user.keyboard('{Meta>}k{/Meta}');
    const palette = await screen.findByRole('dialog');
    await user.type(within(palette).getByRole('combobox'), 'Billing');
    await user.keyboard('{Enter}');

    expect(screen.getByTestId('location').textContent).toBe('/admin/billing');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('collapses the sidebar to an icon rail and remembers it', async () => {
    const user = userEvent.setup();
    renderShell('/admin/dashboard');

    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));

    expect(screen.getByRole('complementary', { name: 'Admin navigation' }).getAttribute('data-collapsed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeTruthy();
    expect(window.localStorage.getItem('tf_admin_sidebar_collapsed_v1')).toBe('1');
  });

  it('opens the mobile navigation as a dialog and closes it on navigation', async () => {
    const user = userEvent.setup();
    renderShell('/admin/dashboard');

    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    const sheet = await screen.findByRole('dialog', { name: 'Admin navigation' });
    await user.click(within(sheet).getByRole('link', { name: /Users/ }));

    expect(screen.getByTestId('location').textContent).toBe('/admin/users');
    expect(screen.queryByRole('dialog', { name: 'Admin navigation' })).toBeNull();
  });

  it('wires the page search and hides filters a page opts out of', async () => {
    const user = userEvent.setup();
    const onSearchValueChange = vi.fn();
    const { unmount } = renderShell('/admin/users', { searchValue: '', onSearchValueChange });

    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'a');
    expect(onSearchValueChange).toHaveBeenCalledWith('a');
    expect(screen.getByRole('combobox', { name: 'Date range' })).toBeTruthy();
    unmount();

    renderShell('/admin/settings', { showGlobalSearch: false, showDateRange: false });
    expect(screen.queryByRole('searchbox', { name: 'Search' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Date range' })).toBeNull();
  });
});
