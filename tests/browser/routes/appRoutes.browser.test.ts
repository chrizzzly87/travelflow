// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  pendingModules: new Set<string>(['TripLoaderRoute']),
  trackEvent: vi.fn(),
}));

vi.mock('../../../services/lazyImportRecovery', () => ({
  loadLazyComponentWithRecovery: (moduleKey: string, importer: () => Promise<unknown>) => {
    if (mocks.pendingModules.has(moduleKey)) {
      return new Promise(() => {});
    }
    return importer();
  },
}));

vi.mock('../../../hooks/useDbSync', () => ({ useDbSync: vi.fn() }));
vi.mock('../../../services/analyticsService', () => ({ trackEvent: mocks.trackEvent }));
vi.mock('../../../pages/CreateTripClassicLabPage', () => ({
  CreateTripClassicLabPage: () => React.createElement('div', { 'data-testid': 'classic-creator' }),
}));
vi.mock('../../../pages/CreateTripV3Page', () => ({
  CreateTripV3Page: () => React.createElement('div', { 'data-testid': 'wizard-v3-creator' }),
}));
vi.mock('../../../pages/CreateTripShapeLabPage', () => ({
  CreateTripShapeLabPage: ({ surface = 'lab' }: { surface?: string }) => React.createElement('div', {
    'data-testid': 'shape-creator',
    'data-surface': surface,
  }),
}));
vi.mock('../../../pages/JourneyOverviewLabPage', () => ({
  JourneyOverviewLabPage: () => React.createElement('div', { 'data-testid': 'journey-overview-lab' }),
}));

import { AppRoutes } from '../../../app/routes/AppRoutes';

afterEach(() => {
  mocks.pendingModules.clear();
  mocks.trackEvent.mockClear();
  vi.unstubAllEnvs();
});

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

    const shell = view.getByTestId('trip-route-loading-shell');
    expect(shell).toHaveAttribute('data-shell-state', 'loadingTrip');
    expect(shell.querySelector('.tf-boot-trip-header')).toBeTruthy();
    expect(shell.querySelector('.tf-boot-trip-action-primary')).toBeTruthy();
    expect(shell.querySelector('.tf-boot-nav')).toBeNull();
    expect(view.container.querySelector('.min-h-screen.w-full.bg-white')).toBeNull();
    view.unmount();
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
    view.unmount();
  });
});

describe('app/routes/AppRoutes create-trip rollout', () => {
  const warmCreatorModules = () => Promise.all([
    import('../../../pages/CreateTripClassicLabPage'),
    import('../../../pages/CreateTripV3Page'),
    import('../../../pages/CreateTripShapeLabPage'),
    import('../../../pages/JourneyOverviewLabPage'),
  ]);

  const renderRoutes = (path: string) => render(
    React.createElement(
      MemoryRouter,
      { initialEntries: [path] },
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

  it('keeps the current creators when the route-first rollout is off', async () => {
    await warmCreatorModules();
    vi.stubEnv('VITE_CREATE_TRIP_SHAPE_ROLLOUT', 'off');

    const primary = renderRoutes('/create-trip');
    expect(await primary.findByTestId('classic-creator')).toBeTruthy();
    primary.unmount();

    const wizard = renderRoutes('/create-trip/wizard');
    expect(await wizard.findByTestId('wizard-v3-creator')).toBeTruthy();
    wizard.unmount();
  });

  it('can promote the route-first planner on the wizard or both creator surfaces', async () => {
    await warmCreatorModules();
    vi.stubEnv('VITE_CREATE_TRIP_SHAPE_ROLLOUT', 'wizard');

    const primary = renderRoutes('/create-trip');
    expect(await primary.findByTestId('classic-creator')).toBeTruthy();
    primary.unmount();

    const wizard = renderRoutes('/create-trip/wizard');
    expect(await wizard.findByTestId('shape-creator')).toHaveAttribute('data-surface', 'wizard');
    wizard.unmount();

    vi.stubEnv('VITE_CREATE_TRIP_SHAPE_ROLLOUT', 'primary');
    const promoted = renderRoutes('/create-trip');
    expect(await promoted.findByTestId('shape-creator')).toHaveAttribute('data-surface', 'primary');
    expect(mocks.trackEvent).toHaveBeenCalledWith('create_trip__experience--view', {
      surface: 'primary',
      experience: 'shape_thailand',
      rollout: 'primary',
    });
    promoted.unmount();
  });

  it('keeps the journey overview concepts isolated on their lab route', async () => {
    await warmCreatorModules();
    const view = renderRoutes('/create-trip/labs/journey-view');
    expect(await view.findByTestId('journey-overview-lab')).toBeTruthy();
    view.unmount();

    const localizedView = renderRoutes('/de/create-trip/labs/journey-view');
    expect(await localizedView.findByTestId('journey-overview-lab')).toBeTruthy();
    localizedView.unmount();
  });
});
