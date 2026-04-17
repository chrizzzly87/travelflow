// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  trackEvent: vi.fn(),
}));

vi.mock('../../../components/admin/AdminShell', () => ({
  AdminShell: ({
    title,
    description,
    actions,
    children,
  }: {
    title: string;
    description?: string;
    actions?: React.ReactNode;
    children: React.ReactNode;
  }) => (
    React.createElement(
      'div',
      null,
      React.createElement('h1', null, title),
      description ? React.createElement('p', null, description) : null,
      actions,
      children,
    )
  ),
}));

vi.mock('../../../services/analyticsService', () => ({
  trackEvent: mocks.trackEvent,
  getAnalyticsDebugAttributes: () => ({}),
}));

import { AdminCountryGuideLabPage } from '../../../pages/AdminCountryGuideLabPage';

describe('pages/AdminCountryGuideLabPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tracks page open and layout selection events', async () => {
    const user = userEvent.setup();

    render(React.createElement(MemoryRouter, null, React.createElement(AdminCountryGuideLabPage)));

    expect(mocks.trackEvent).toHaveBeenCalledWith('admin__country_guide_lab--open');
    expect(screen.getByRole('heading', { name: 'Country Guide Lab' })).toBeInTheDocument();
    expect(screen.getByText('Thailand guide experiment')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open prep workspace/i })).toHaveAttribute('href', '/example/thailand-travel-prep-playground?mode=prep');
    expect(screen.getByRole('link', { name: /Review source guide/i })).toHaveAttribute('href', 'https://atobeach.com/thailand-travel-guide');

    await user.click(screen.getByRole('tab', { name: 'Top Navigation' }));

    await waitFor(() => {
      expect(mocks.trackEvent).toHaveBeenCalledWith('admin__country_guide_lab_layout--select', {
        mode: 'navigator',
      });
    });

    await user.click(screen.getByRole('tab', { name: 'Sidebar Field Guide' }));

    await waitFor(() => {
      expect(mocks.trackEvent).toHaveBeenCalledWith('admin__country_guide_lab_layout--select', {
        mode: 'field_guide',
      });
    });
  });

  it('renders the carry-over audit and recommended planner-centric direction', () => {
    render(React.createElement(MemoryRouter, null, React.createElement(AdminCountryGuideLabPage)));

    expect(screen.getAllByText('What should TravelFlow borrow from guide-style country pages?').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Entry rules and visa windows').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Large generic FAQ wall').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Start with a planner companion, then back-port the best parts to the public country page.').length).toBeGreaterThan(0);
    expect(screen.getAllByText('One page, three navigation systems').length).toBeGreaterThan(0);
  });
});
