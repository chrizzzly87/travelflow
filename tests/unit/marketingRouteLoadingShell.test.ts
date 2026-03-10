// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';

import { MarketingRouteLoadingShell } from '../../components/bootstrap/MarketingRouteLoadingShell';
import {
  markInitialRouteHandoffCompleted,
  resetInitialRouteHandoffCompletedForTests,
} from '../../services/marketingRouteShellState';

describe('MarketingRouteLoadingShell', () => {
  afterEach(() => {
    cleanup();
    resetInitialRouteHandoffCompletedForTests();
  });

  it('shows the navigation skeleton during the initial route handoff', () => {
    const view = render(React.createElement(MarketingRouteLoadingShell));

    expect(view.getByTestId('route-loading-shell')).toHaveAttribute('data-tf-chrome-mode', 'skeleton');
    expect(view.container.querySelector('.tf-boot-nav-skeleton--features')).toBeTruthy();
    expect(view.container.querySelector('.tf-boot-control-skeleton--cta')).toBeTruthy();
  });

  it('hides the navigation skeleton after the first route handoff completes', () => {
    markInitialRouteHandoffCompleted();

    const view = render(React.createElement(MarketingRouteLoadingShell));

    expect(view.getByTestId('route-loading-shell')).toHaveAttribute('data-tf-chrome-mode', 'ghost');
    expect(view.getByTestId('route-loading-shell')).toHaveAttribute('data-tf-surface-mode', 'neutral');
    expect(view.container.querySelector('.tf-boot-nav-skeleton--features')).toBeNull();
    expect(view.container.querySelector('.tf-boot-nav-ghost--features')).toBeTruthy();
    expect(view.container.querySelector('.tf-boot-action-chip--ghost')).toBeTruthy();
    expect(view.getByTestId('route-loading-shell').textContent).toContain('TravelFlow');
  });
});
