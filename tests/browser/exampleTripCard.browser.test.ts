// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExampleTripCard } from '../../components/marketing/ExampleTripCard';
import type { ExampleTripCard as ExampleTripCardModel } from '../../data/exampleTripCards';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: {
      language: 'en',
      resolvedLanguage: 'en',
    },
  }),
}));

vi.mock('../../components/ProgressiveImage', () => ({
  ProgressiveImage: ({ alt }: { alt: string }) => (
    React.createElement('img', { alt })
  ),
}));

vi.mock('../../components/flags/FlagIcon', () => ({
  FlagIcon: ({ value }: { value: string }) => (
    React.createElement('span', { 'data-testid': 'flag' }, value)
  ),
}));

vi.mock('../../services/analyticsService', () => ({
  trackEvent: vi.fn(),
}));

const cardWithoutMapImage: ExampleTripCardModel = {
  id: 'fallback-only',
  title: 'Fallback Route',
  countries: [{ name: 'Japan', flag: 'JP' }],
  durationDays: 7,
  cityCount: 3,
  mapColor: 'bg-slate-100',
  mapAccent: 'bg-accent-500',
  username: 'travelflow',
  avatarColor: 'bg-accent-500',
  tags: ['Culture'],
};

describe('ExampleTripCard', () => {
  it('renders fallback artwork without reading a missing blurhash', () => {
    render(React.createElement(ExampleTripCard, { card: cardWithoutMapImage }));

    expect(screen.getByRole('heading', { name: 'Fallback Route' })).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
