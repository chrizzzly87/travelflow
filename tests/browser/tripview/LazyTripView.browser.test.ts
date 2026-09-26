// @vitest-environment jsdom
import React, { Suspense } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const recoveryMocks = vi.hoisted(() => ({
  load: vi.fn(async () => ({
    TripView: () => React.createElement('div', null, 'trip view loaded'),
  })),
}));

vi.mock('../../../services/lazyImportRecovery', () => ({
  loadLazyComponentWithRecovery: recoveryMocks.load,
}));

import { LazyTripView } from '../../../components/tripview/LazyTripView';

describe('components/tripview/LazyTripView', () => {
  // The trip, shared-trip and example-trip routes all render through this.
  // It used to be a bare React.lazy, so a tab opened before a deploy crashed
  // with "Failed to fetch dynamically imported module" instead of reloading
  // once onto the new build like every other lazy route.
  it('loads TripView through the stale-chunk recovery wrapper', async () => {
    render(
      React.createElement(Suspense, { fallback: null },
        React.createElement(LazyTripView as unknown as React.ComponentType, null),
      ),
    );

    expect(await screen.findByText('trip view loaded')).toBeInTheDocument();
    expect(recoveryMocks.load).toHaveBeenCalledWith('TripView', expect.any(Function));
  });
});
