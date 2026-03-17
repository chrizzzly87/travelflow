// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({
  trackEvent: vi.fn(),
  getAnalyticsDebugAttributes: vi.fn((eventName: string, payload?: Record<string, unknown>) => ({
    'data-tf-track-event': eventName,
    'data-tf-track-payload': JSON.stringify(payload || {}),
  })),
}));

vi.mock('../../services/analyticsService', () => ({
  trackEvent: (...args: unknown[]) => mocks.trackEvent(...args),
  getAnalyticsDebugAttributes: (...args: unknown[]) => mocks.getAnalyticsDebugAttributes(...args),
}));

vi.mock('../../components/IdealTravelTimeline', () => ({
  IdealTravelTimeline: () => React.createElement('div', { 'data-testid': 'ideal-travel-timeline' }),
}));

import { CountrySelect } from '../../components/CountrySelect';

describe('components/CountrySelect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows empty-state recommendations and tracks recommendation clicks', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <CountrySelect
        value=""
        onChange={onChange}
        recommendationMonths={[4]}
        analyticsEventName="create_trip_wizard__destination_recommendation--select"
        labels={{ placeholder: 'Search destinations' }}
      />
    );

    await user.click(screen.getByPlaceholderText('Search destinations'));

    const japanRecommendation = await screen.findByRole('button', { name: /Japan/i });
    expect(japanRecommendation).toHaveAttribute(
      'data-tf-track-event',
      'create_trip_wizard__destination_recommendation--select'
    );

    await user.click(japanRecommendation);

    expect(onChange).toHaveBeenCalledWith('Japan');
    expect(mocks.trackEvent).toHaveBeenCalledWith(
      'create_trip_wizard__destination_recommendation--select',
      expect.objectContaining({
        destination_code: 'JP',
        destination_name: 'Japan',
        destination_kind: 'country',
        source: 'empty_state',
        months: '4',
      })
    );
  });

  it('keeps already selected destinations out of the empty-state recommendations', async () => {
    const user = userEvent.setup();

    render(
      <CountrySelect
        value="Japan"
        onChange={vi.fn()}
        recommendationMonths={[4]}
        labels={{
          addAnotherPlaceholder: 'Add another destination',
        }}
      />
    );

    await user.click(screen.getByPlaceholderText('Add another destination'));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^Japan$/i })).not.toBeInTheDocument();
    });
    expect(screen.getAllByText('Japan')).toHaveLength(1);
  });
});
