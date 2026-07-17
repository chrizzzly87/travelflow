// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActivityKnowledgeCard } from '../../../components/tripview/ActivityKnowledgeCard';
import type { TravelActivityKnowledge } from '../../../shared/travelActivityKnowledge';

const analyticsMocks = vi.hoisted(() => ({ trackEvent: vi.fn() }));

vi.mock('../../../services/analyticsService', () => ({
  trackEvent: analyticsMocks.trackEvent,
  getAnalyticsDebugAttributes: (eventName: string) => ({ 'data-tf-track-event': eventName }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, options?: Record<string, unknown>) => ({
      'tripActivityKnowledge.title': 'Source-backed visitor details',
      'tripActivityKnowledge.description': 'Structured catalogue fields',
      'tripActivityKnowledge.currentUntil': `Current until ${options?.date ?? ''}`,
      'tripActivityKnowledge.duration': 'Recommended duration',
      'tripActivityKnowledge.bestTime': 'Best time',
      'tripActivityKnowledge.hours': 'Opening hours',
      'tripActivityKnowledge.lastEntry': `last entry ${options?.time ?? ''}`,
      'tripActivityKnowledge.admission': 'Admission',
      'tripActivityKnowledge.free': 'Free',
      'tripActivityKnowledge.booking': 'Booking',
      'tripActivityKnowledge.bookingModes.optional_advance': 'Advance booking optional',
      'tripActivityKnowledge.audience': 'Traveler fit',
      'tripActivityKnowledge.audienceLabels.family': 'Families',
      'tripActivityKnowledge.fitLabels.conditional': 'Check the notes',
      'tripActivityKnowledge.dressCode': 'Dress code',
      'tripActivityKnowledge.practicalNotes': 'Good to know',
      'tripActivityKnowledge.sources': 'Sources',
      'tripActivityKnowledge.verifyLive': 'Check the linked source before visiting.',
    }[key] ?? key),
  }),
}));

const support = {
  sourceKey: 'grand_palace_official',
  sourceUrl: 'https://www.royalgrandpalace.th/en/visit/practical-information',
  confidence: 0.95,
  reviewStatus: 'verified' as const,
  observedAt: '2026-07-17T13:45:00Z',
  validUntil: '2026-08-16T13:45:00Z',
};

const knowledge: TravelActivityKnowledge = {
  version: 1,
  entity: {
    entityId: 'grand-palace',
    entityType: 'poi',
    canonicalSlug: 'th-bangkok-grand-palace',
    name: 'Grand Palace',
    countryCode: 'TH',
    resolution: 'canonical',
  },
  categories: ['culture'],
  recommendedDuration: { value: { min: 120, max: 180, unit: 'minutes' }, support },
  bestTime: { value: ['At opening'], support },
  openingHours: {
    value: {
      timezone: 'Asia/Bangkok',
      schedule: [{ days: ['Daily'], opens: '08:30', closes: '16:30' }],
      lastEntry: '15:30',
      checkBeforeVisit: true,
    },
    support,
  },
  admission: {
    value: { currency: 'THB', adultForeign: 500, checkBeforeVisit: true },
    support,
  },
  booking: { value: { mode: 'optional_advance' }, support },
  dressCode: { value: ['Cover shoulders and knees'], support },
  audience: [{
    value: { audience: 'family', fit: 'conditional', notes: ['Heat and crowds'] },
    support,
  }],
  practicalNotes: { value: ['Bring water'], support },
  sourceKeys: ['grand_palace_official'],
  freshness: {
    status: 'current',
    latestObservedAt: '2026-07-17T13:45:00Z',
    earliestValidUntil: '2026-08-16T13:45:00Z',
  },
};

describe('components/tripview/ActivityKnowledgeCard', () => {
  it('shows rich catalogue fields, freshness, and source analytics in the activity drawer', () => {
    analyticsMocks.trackEvent.mockReset();
    render(React.createElement(ActivityKnowledgeCard, { knowledge }));

    expect(screen.getByRole('heading', { name: 'Source-backed visitor details' })).toBeInTheDocument();
    expect(screen.getByText('120–180 min')).toBeInTheDocument();
    expect(screen.getByText(/Daily · 08:30–16:30/)).toBeInTheDocument();
    expect(screen.getByText(/THB/)).toBeInTheDocument();
    expect(screen.getByText('Families', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Cover shoulders and knees')).toBeInTheDocument();
    expect(screen.getByText('Check the linked source before visiting.')).toBeInTheDocument();

    const source = screen.getByRole('link', { name: /grand palace official/i });
    expect(source).toHaveAttribute('href', support.sourceUrl);
    expect(source).toHaveAttribute('data-tf-track-event', 'trip_view__knowledge_source--open');
    fireEvent.click(source);
    expect(analyticsMocks.trackEvent).toHaveBeenCalledWith('trip_view__knowledge_source--open', {
      entity: 'th-bangkok-grand-palace',
      source_key: 'grand_palace_official',
    });
  });
});
