// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TripWorkspaceShell } from '../../../components/tripview/TripWorkspaceShell';

const TRANSLATIONS: Record<string, string> = {
  'tripView.workspace.shellLabel': 'Modular trip workspace',
  'tripView.workspace.eyebrow': 'Trip views',
  'tripView.workspace.title': 'Your workspace',
  'tripView.workspace.navigationLabel': 'Trip workspace views',
  'tripView.workspace.views.overview': 'Overview',
  'tripView.workspace.views.schedule': 'Schedule',
  'tripView.workspace.classicAction': 'Classic planner',
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => TRANSLATIONS[key] || key,
  }),
}));

afterEach(cleanup);

describe('components/tripview/TripWorkspaceShell', () => {
  it('returns the established planner without a shell in classic presentation', () => {
    render(
      React.createElement(
        TripWorkspaceShell,
        {
          presentation: 'classic',
          onViewChange: vi.fn(),
          onExitToClassic: vi.fn(),
          scheduleContent: React.createElement('div', null, 'schedule'),
        },
        React.createElement('div', { 'data-testid': 'overview-content' }, 'overview'),
      ),
    );

    expect(screen.getByTestId('overview-content')).toBeVisible();
    expect(screen.queryByTestId('trip-workspace-shell')).not.toBeInTheDocument();
  });

  it('keeps both modular views mounted while switching through the inset navigation', () => {
    const onViewChange = vi.fn();
    const onExitToClassic = vi.fn();
    const { rerender } = render(
      React.createElement(
        TripWorkspaceShell,
        {
          presentation: 'schedule',
          onViewChange,
          onExitToClassic,
          scheduleContent: React.createElement('div', { 'data-testid': 'schedule-content' }, 'schedule'),
        },
        React.createElement('div', { 'data-testid': 'overview-content' }, 'overview'),
      ),
    );

    expect(screen.getByTestId('trip-workspace-shell')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Schedule' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('trip-workspace-overview')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTestId('trip-workspace-schedule')).toHaveAttribute('aria-hidden', 'false');
    expect(screen.getByTestId('overview-content')).toBeInTheDocument();
    expect(screen.getByTestId('schedule-content')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Overview' }));
    expect(onViewChange).toHaveBeenCalledWith('overview');

    rerender(
      React.createElement(
        TripWorkspaceShell,
        {
          presentation: 'overview',
          onViewChange,
          onExitToClassic,
          scheduleContent: React.createElement('div', { 'data-testid': 'schedule-content' }, 'schedule'),
        },
        React.createElement('div', { 'data-testid': 'overview-content' }, 'overview'),
      ),
    );

    expect(screen.getByTestId('trip-workspace-overview')).toHaveAttribute('aria-hidden', 'false');
    expect(screen.getByTestId('trip-workspace-schedule')).toHaveAttribute('aria-hidden', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Classic planner' }));
    expect(onExitToClassic).toHaveBeenCalledTimes(1);
  });
});
