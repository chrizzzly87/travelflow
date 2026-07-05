// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';

import { MarketingRouteLoadingShell } from '../../components/bootstrap/MarketingRouteLoadingShell';

describe('MarketingRouteLoadingShell', () => {
  afterEach(() => {
    cleanup();
  });

  it('always renders the navigation skeleton chrome in a single pass', () => {
    const view = render(React.createElement(MarketingRouteLoadingShell));

    expect(view.getByTestId('route-loading-shell')).toHaveAttribute('data-tf-chrome-mode', 'skeleton');
    expect(view.getByTestId('route-loading-shell')).toHaveAttribute('data-tf-surface-mode', 'default');
    expect(view.container.querySelector('.tf-boot-nav-skeleton--features')).toBeTruthy();
    expect(view.container.querySelector('.tf-boot-control-skeleton--cta')).toBeTruthy();
    expect(view.getByTestId('route-loading-shell').textContent).toContain('TravelFlow');
  });
});
