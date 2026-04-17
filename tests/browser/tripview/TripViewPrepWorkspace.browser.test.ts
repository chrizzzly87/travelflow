// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { TripViewPrepWorkspace } from '../../../components/tripview/TripViewPrepWorkspace';

const analyticsMocks = vi.hoisted(() => ({
  trackEvent: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        'tripView.prep.eyebrow': 'Travel prep workspace',
        'tripView.prep.empty': 'No country-prep snapshot is available for this trip yet.',
        'tripView.prep.beforeDeparture': 'Before departure',
        'tripView.prep.onArrival': 'On arrival',
        'tripView.prep.onTheGround': 'On the ground',
        'tripView.prep.routeContext': 'Route context',
        'tripView.prep.departure': 'Dates',
        'tripView.prep.duration': 'Duration',
        'tripView.prep.country': 'Country',
        'tripView.prep.cities': 'Cities on this route',
        'tripView.prep.priorityChecks': 'Priority checks',
        'tripView.prep.referenceUpdates': 'Reference updates',
        'tripView.prep.travelerWarnings': 'Traveler warnings',
        'tripView.prep.utilities': 'Utilities',
        'tripView.prep.currency': 'Currency',
        'tripView.prep.languages': 'Languages',
        'tripView.prep.power': 'Power',
        'tripView.prep.officialSources': 'Official sources',
      };
      return labels[key] || key;
    },
  }),
}));

vi.mock('../../../services/analyticsService', () => ({
  trackEvent: analyticsMocks.trackEvent,
  getAnalyticsDebugAttributes: () => ({}),
}));

describe('components/tripview/TripViewPrepWorkspace', () => {
  it('renders the prep workspace and tracks official source opens', () => {
    render(
      React.createElement(TripViewPrepWorkspace, {
        trip: {
          id: 'trip-1',
          title: 'Thailand Trip',
          startDate: '2026-11-08',
          items: [
            { id: 'city-1', type: 'city', title: 'Bangkok', startDateOffset: 0, duration: 2 },
          ],
          countryInfo: {
            countryCode: 'TH',
            countryName: 'Thailand',
            currencyCode: 'THB',
            currencyName: 'Thai Baht',
            exchangeRate: 43.35,
            languages: ['Thai'],
            electricSockets: 'Type A, Type B, Type C, Type O',
            travelGuide: {
              title: 'Thailand travel-prep snapshot',
              summary: 'Practical trip-prep notes for testing.',
              quickFacts: [
                { label: 'Visa-free stay', value: 'Up to 60 days' },
              ],
              sections: [
                {
                  id: 'entry',
                  title: 'Entry requirements',
                  summary: 'Passport, visa, and arrival-card reminders.',
                  bullets: ['Passport should stay valid for at least 6 months after arrival.'],
                },
              ],
              utilities: [
                {
                  label: 'Power',
                  value: '220V / 50Hz',
                },
              ],
              officialLinks: [
                {
                  label: 'UK travel advice for Thailand',
                  url: 'https://www.gov.uk/foreign-travel-advice/thailand',
                },
              ],
            },
          },
        } as any,
        tripDateRange: 'Nov 8, 2026 – Nov 20, 2026',
        tripSpanCompactLabel: '13 days / 12 nights',
        travelerWarnings: [],
      }),
    );

    expect(screen.getByText('Thailand travel-prep snapshot')).toBeInTheDocument();
    expect(screen.getByText('Route context')).toBeInTheDocument();
    expect(screen.getByText('Entry requirements')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: /UK travel advice for Thailand/i }));

    expect(analyticsMocks.trackEvent).toHaveBeenCalledWith('trip_view__country_guide_source', {
      label: 'UK travel advice for Thailand',
    });
  });
});
