// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../services/analyticsService', () => ({
  trackEvent: vi.fn(),
  getAnalyticsDebugAttributes: () => ({}),
}));

import { DestinationCountryProfileSections } from '../../components/inspirations/DestinationCountryProfileSections';
import type { DestinationCountryProfileResult } from '../../shared/destinationCountryProfile';

const buildResult = (
  recentUpdates: DestinationCountryProfileResult['profile']['recentUpdates'],
): DestinationCountryProfileResult => ({
  profile: {
    currencyCode: null,
    timezone: null,
    callingCode: null,
    popularity: null,
    summary: null,
    alertMessage: null,
    safetyTips: [],
    bonusTips: [],
    sections: {},
    faqs: [],
    recentUpdates,
    airports: [],
    beaches: [],
    cities: [],
    weather: [],
    exchange: { rate: null, base: null },
  },
  provenance: null,
});

describe('components/inspirations/DestinationCountryProfileSections recent updates', () => {
  it('renders an update that has no messages instead of crashing', () => {
    render(
      <DestinationCountryProfileSections
        countryName="Japan"
        locale="en"
        result={buildResult([{ category: 'Transport', timestamp: '2026-05-01T00:00:00Z' }])}
      />,
    );

    expect(screen.getByText('Transport')).toBeInTheDocument();
  });
});
