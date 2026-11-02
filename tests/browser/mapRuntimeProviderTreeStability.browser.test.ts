// @vitest-environment jsdom
import React, { useEffect, useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  apiProviderMounts: 0,
}));

vi.mock('@vis.gl/react-google-maps', () => ({
  APIProvider: ({ children }: { children: React.ReactNode }) => {
    mocks.apiProviderMounts += 1;
    return React.createElement('div', { 'data-testid': 'api-provider' }, children);
  },
  useApiIsLoaded: () => true,
}));

vi.mock('../../utils', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    // A syntactically valid key (AIza + 35 chars), so the gate takes its real path.
    getGoogleMapsApiKey: () => `AIza${'A'.repeat(35)}`,
  };
});

import { GoogleMapsApiGate, MapRuntimeProvider } from '../../components/MapRuntimeProvider';

afterEach(() => {
  mocks.apiProviderMounts = 0;
});

/**
 * Counts how many times it has been mounted, so a remount is observable from
 * the outside. This stands in for the planner, which used to lose the sheet's
 * snap, the selected day, the scroll position and the timeline zoom whenever
 * the map provider re-parented it.
 */
let plannerMounts = 0;
const StatefulPlanner: React.FC = () => {
  const mountId = useRef(0);
  if (mountId.current === 0) {
    plannerMounts += 1;
    mountId.current = plannerMounts;
  }
  return React.createElement('div', { 'data-testid': 'planner' }, `mount-${mountId.current}`);
};

/** Mounts the gate a tick after first render, the way deferred bootstrap does. */
const DeferredMapHost: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMapEnabled, setIsMapEnabled] = useState(false);

  useEffect(() => {
    setIsMapEnabled(true);
  }, []);

  return React.createElement(
    React.Fragment,
    null,
    children,
    isMapEnabled
      ? React.createElement(GoogleMapsApiGate, null, React.createElement('div', { 'data-testid': 'map' }))
      : null,
  );
};

describe('MapRuntimeProvider tree stability', () => {
  it('keeps its children mounted when the Google Maps script starts loading', async () => {
    plannerMounts = 0;

    render(
      React.createElement(
        MapRuntimeProvider,
        null,
        React.createElement(DeferredMapHost, null, React.createElement(StatefulPlanner)),
      ),
    );

    // The gate mounted, so the API provider is up...
    expect(await screen.findByTestId('api-provider')).toBeTruthy();
    expect(mocks.apiProviderMounts).toBeGreaterThan(0);

    // ...and the planner beside it was never torn down and rebuilt.
    expect(screen.getByTestId('planner').textContent).toBe('mount-1');
    expect(plannerMounts).toBe(1);

    // The invariant behind that: the script mounts around the map and nothing
    // else. Put `APIProvider` back above the planner and this fails.
    const apiProvider = screen.getByTestId('api-provider');
    expect(apiProvider.contains(screen.getByTestId('map'))).toBe(true);
    expect(apiProvider.contains(screen.getByTestId('planner'))).toBe(false);
  });

  it('mounts the Google Maps script only where a gate is rendered', () => {
    render(
      React.createElement(
        MapRuntimeProvider,
        null,
        React.createElement('div', { 'data-testid': 'planner-without-map' }),
      ),
    );

    // No gate, no script: this is what keeps the deferral working now that the
    // provider itself no longer gates anything.
    expect(screen.queryByTestId('api-provider')).toBeNull();
    expect(mocks.apiProviderMounts).toBe(0);
  });
});
