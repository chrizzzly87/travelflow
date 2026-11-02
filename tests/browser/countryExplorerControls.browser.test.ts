// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  trackEvent: vi.fn(),
}));

vi.mock('../../services/analyticsService', () => ({
  trackEvent: (...args: unknown[]) => mocks.trackEvent(...args),
  getAnalyticsDebugAttributes: (eventName: string) => ({ 'data-tf-track-event': eventName }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { CountryExplorerControls } from '../../components/inspirations/CountryExplorerControls';
import { INITIAL_COUNTRY_EXPLORER_STATE } from '../../services/countryExplorerFilters';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const renderControls = (dispatch = vi.fn(), state = INITIAL_COUNTRY_EXPLORER_STATE) => {
  render(React.createElement(CountryExplorerControls, {
    state,
    dispatch,
    availableRegions: ['Europe', 'Asia'],
    availableTags: [],
    monthLabels: MONTHS,
    resultCount: 2,
    totalCount: 10,
  }));
  return dispatch;
};

describe('components/inspirations/CountryExplorerControls', () => {
  beforeEach(() => {
    // Radix Select needs these pointer/scroll APIs, which jsdom does not provide.
    for (const [name, value] of [
      ['hasPointerCapture', () => false],
      ['setPointerCapture', () => undefined],
      ['releasePointerCapture', () => undefined],
      ['scrollIntoView', () => undefined],
    ] as const) {
      if (!(name in Element.prototype)) {
        Object.defineProperty(Element.prototype, name, { configurable: true, value });
      }
    }
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders month and facet chips as pressed toggle buttons', async () => {
    const user = userEvent.setup();
    const dispatch = renderControls();

    const anyMonth = screen.getByRole('button', { name: 'inspirations.subpages.explorer.anyMonth' });
    expect(anyMonth).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Mar' })).toHaveAttribute('aria-pressed', 'false');

    await user.click(screen.getByRole('button', { name: 'Europe' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'toggle-facet', facet: 'regions', value: 'Europe' });
  });

  it('sorts through the shared select instead of a native one', async () => {
    const user = userEvent.setup();
    const dispatch = renderControls();

    expect(document.querySelector('select')).toBeNull();
    const trigger = screen.getByRole('combobox', { name: 'inspirations.subpages.explorer.sortLabel' });
    expect(trigger).toHaveTextContent('inspirations.subpages.explorer.sort.popular');

    await user.click(trigger);
    // Sorting by month needs a month first, exactly as the native option was disabled.
    expect(await screen.findByRole('option', { name: 'inspirations.subpages.explorer.sort.month' }))
      .toHaveAttribute('aria-disabled', 'true');
    await user.click(screen.getByRole('option', { name: 'inspirations.subpages.explorer.sort.name' }));

    expect(dispatch).toHaveBeenCalledWith({ type: 'set-sort', sort: 'name' });
    expect(mocks.trackEvent).toHaveBeenCalledWith('inspirations__country_sort', { sort: 'name' });
  });
});
