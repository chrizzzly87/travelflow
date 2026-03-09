// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  locationSearch: '',
  applyConnectivityOverrideFromSearch: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useLocation: () => ({
    search: mocks.locationSearch,
  }),
}));

vi.mock('../../services/supabaseHealthMonitor', async () => {
  const actual = await vi.importActual('../../services/supabaseHealthMonitor') as Record<string, unknown>;
  return {
    ...actual,
    applyConnectivityOverrideFromSearch: mocks.applyConnectivityOverrideFromSearch,
    clearConnectivityOverride: vi.fn(() => ({ state: 'online' })),
    getConnectivitySnapshot: vi.fn(() => ({ state: 'online', isForced: false })),
    setConnectivityOverride: vi.fn(() => ({ state: 'offline' })),
  };
});

import { useDebuggerBootstrap } from '../../app/bootstrap/useDebuggerBootstrap';

const HookProbe: React.FC = () => {
  useDebuggerBootstrap({ appName: 'TravelFlow', isDev: false });
  return null;
};

describe('app/bootstrap/useDebuggerBootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.locationSearch = '';
  });

  it('applies outage override parsing on mount and search changes', () => {
    const view = render(React.createElement(HookProbe));
    expect(mocks.applyConnectivityOverrideFromSearch).toHaveBeenCalledWith('');

    mocks.locationSearch = '?offline=offline';
    view.rerender(React.createElement(HookProbe));

    expect(mocks.applyConnectivityOverrideFromSearch).toHaveBeenCalledWith('?offline=offline');
  });
});
