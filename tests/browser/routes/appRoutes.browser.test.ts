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

    expect(view.getByTestId('trip-route-loading-shell')).toBeTruthy();
    expect(view.container.querySelector('div[aria-hidden="true"]')).toBeNull();
  });
});
