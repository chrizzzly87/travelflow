// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  pendingModules: new Set<string>(['TripLoaderRoute']),
}));

vi.mock('../../../services/lazyImportRecovery', () => ({
  loadLazyComponentWithRecovery: (moduleKey: string, importer: () => Promise<unknown>) => {
    if (mocks.pendingModules.has(moduleKey)) {
      return new Promise(() => {});
    }
    return importer();
  },
}));

import { AppRoutes } from '../../../app/routes/AppRoutes';

describe('app/routes/AppRoutes suspense fallbacks', () => {
  it('renders the trip route loading shell instead of the generic route placeholder while the trip route chunk is still loading', () => {
    mocks.pendingModules.clear();
    mocks.pendingModules.add('TripLoaderRoute');

    const view = render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/trip/trip-pending'] },
        React.createElement(AppRoutes, {
          trip: null,
          appLanguage: 'en',
          onAppLanguageLoaded: vi.fn(),
          onTripGenerated: vi.fn(),
          onTripLoaded: vi.fn(),
          onUpdateTrip: vi.fn(),
          onCommitState: vi.fn(),
          onViewSettingsChange: vi.fn(),
          onOpenManager: vi.fn(),
          onOpenSettings: vi.fn(),
        })
      )
    );

    expect(view.getByTestId('trip-route-loading-shell')).toHaveAttribute('data-shell-state', 'loadingTrip');
    expect(view.container.querySelector('.min-h-screen.w-full.bg-white')).toBeNull();
  });

  it('renders the branded bootstrap header for deferred marketing routes while the route chunk is still loading', () => {
    mocks.pendingModules.clear();
    mocks.pendingModules.add('DeferredAppRoutes');

    const view = render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/pricing'] },
        React.createElement(AppRoutes, {
          trip: null,
          appLanguage: 'en',
          onAppLanguageLoaded: vi.fn(),
          onTripGenerated: vi.fn(),
          onTripLoaded: vi.fn(),
          onUpdateTrip: vi.fn(),
          onCommitState: vi.fn(),
          onViewSettingsChange: vi.fn(),
          onOpenManager: vi.fn(),
          onOpenSettings: vi.fn(),
        })
      )
    );

    const shell = view.getByTestId('route-loading-shell');
    expect(shell).toBeTruthy();
    expect(shell).toHaveAttribute('data-shell-variant', 'marketing');
    expect(shell.textContent).toContain('TravelFlow');
    expect(shell.textContent).not.toContain('Create Trip');
    expect(shell.querySelector('.tf-boot-nav-skeleton--features')).toBeTruthy();
    expect(shell.querySelector('.tf-boot-control-flag')).toBeTruthy();
    expect(shell.querySelector('.tf-boot-control-skeleton--cta')).toBeTruthy();
  });
});
