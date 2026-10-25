// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithRouter } from '@/tests/helpers/renderWithRouter';
import { MemoryRouter, useLocation } from '@/tests/helpers/routerHarness';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({ inspect: vi.fn(), trackEvent: vi.fn() }));

vi.mock('../../../components/admin/AdminShell', () => ({
  AdminShell: ({ title, children }: { title: string; children: React.ReactNode }) => (
    React.createElement('section', null, React.createElement('h1', null, title), children)
  ),
}));
vi.mock('../../../components/admin/TripOgPreviewPanel', () => ({
  TripOgPreviewPanel: ({ tripId }: { tripId: string }) => React.createElement('div', { 'data-testid': 'trip-panel' }, tripId),
}));
vi.mock('../../../services/analyticsService', () => ({
  trackEvent: mocks.trackEvent,
  getAnalyticsDebugAttributes: () => ({}),
}));
vi.mock('../../../services/adminOgToolsService', async () => {
  const actual = await vi.importActual<typeof import('../../../services/adminOgToolsService')>('../../../services/adminOgToolsService');
  return { ...actual, inspectOgUrl: mocks.inspect };
});

import { AdminOgToolsPage, resolveOgToolsTab } from '../../../pages/AdminOgToolsPage';

const LocationSearchProbe: React.FC = () => React.createElement('output', { 'data-testid': 'location-search' }, useLocation().search);

const renderPage = (entry = '/admin/og-tools') => renderWithRouter(
  React.createElement(MemoryRouter, { initialEntries: [entry] },
    React.createElement(React.Fragment, null, React.createElement(AdminOgToolsPage), React.createElement(LocationSearchProbe))),
);

describe('resolveOgToolsTab', () => {
  it('opens the inspector by default and the trip video for trip links', () => {
    expect(resolveOgToolsTab('')).toBe('inspect');
    expect(resolveOgToolsTab('?trip=abc&mapStyle=dark')).toBe('video');
  });

  it('honours an explicit tab, including the old analyzer id', () => {
    expect(resolveOgToolsTab('?tab=commands')).toBe('commands');
    expect(resolveOgToolsTab('?tab=analyzer&trip=abc')).toBe('inspect');
    expect(resolveOgToolsTab('?tab=nonsense')).toBe('inspect');
  });
});

describe('AdminOgToolsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(null, '', '/admin/og-tools');
    mocks.inspect.mockResolvedValue({
      requestUrl: 'https://travelflowapp.netlify.app/blog',
      finalUrl: 'https://travelflowapp.netlify.app/blog',
      status: 200,
      ok: true,
      contentType: 'text/html',
      sourceHeader: 'static',
      mode: 'static',
      imageKind: 'static-generated',
      resolvedOgImageUrl: 'https://travelflowapp.netlify.app/images/og/blog.png',
      metadata: { ogTitle: 'Blog', ogDescription: null, ogImage: '/images/og/blog.png', canonical: 'https://travelflowapp.netlify.app/blog' },
    });
  });

  it('starts on the inspector with an empty state, and keeps build commands on their own tab', async () => {
    const user = userEvent.setup();
    await renderPage();

    expect(screen.getByRole('tab', { name: 'Inspect a URL', selected: true })).toBeTruthy();
    expect(screen.getByText('Nothing inspected yet')).toBeTruthy();
    expect(screen.queryByText('Build command')).toBeNull();

    await user.click(screen.getByRole('tab', { name: 'Build commands' }));
    expect(await screen.findByText('Build command')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy release-safe default run' })).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('location-search').textContent).toBe('?tab=commands'));
  });

  it('inspects a preset and leads with the share image, flagging missing tags', async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole('button', { name: '/blog' }));
    await waitFor(() => expect(mocks.inspect).toHaveBeenCalledWith('/blog', expect.any(Object)));
    expect(await screen.findByAltText('Rendered open graph preview')).toBeTruthy();
    expect(screen.getByText('Static image')).toBeTruthy();
    expect(screen.getByText('Missing')).toBeTruthy();
    expect(mocks.trackEvent).toHaveBeenCalledWith('admin__og_tools--inspect', { source: 'preset' });
  });

  it('opens the trip video tab from a trip link', async () => {
    await renderPage('/admin/og-tools?trip=4fee56dd-a79a-4130-bef0-cc7ffb552ea5');
    expect(screen.getByRole('tab', { name: 'Trip video', selected: true })).toBeTruthy();
    expect(screen.getByTestId('trip-panel').textContent).toBe('4fee56dd-a79a-4130-bef0-cc7ffb552ea5');
  });
});
