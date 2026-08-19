// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CountryRouteCards } from '../../components/inspirations/CountryRouteCards';
import { decodeTripPrefill } from '../../services/tripPrefillDecoder';

const trackEvent = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) => (
      values ? `${key}:${Object.values(values).join('|')}` : key
    ),
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}));

vi.mock('../../components/ProgressiveImage', () => ({
  ProgressiveImage: ({ alt, src }: { alt: string; src?: string }) => React.createElement('img', { alt, src }),
}));

vi.mock('../../components/flags/FlagIcon', () => ({
  FlagIcon: ({ value }: { value: string }) => React.createElement('span', { 'data-testid': 'flag' }, value),
}));

vi.mock('../../services/analyticsService', () => ({
  trackEvent: (...args: unknown[]) => trackEvent(...args),
  getAnalyticsDebugAttributes: () => ({}),
}));

const renderCards = (countryValue: string, countryName: string) => render(
  React.createElement(
    MemoryRouter,
    null,
    React.createElement(CountryRouteCards, { countryValue, countryName, locale: 'en' as const }),
  ),
);

describe('CountryRouteCards', () => {
  afterEach(() => cleanup());

  it('renders the three featured routes for a country', () => {
    renderCards('iceland', 'Iceland');

    expect(screen.getByRole('heading', { name: 'Ring Road Full Circle' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'South Coast Short Escape' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Westfjords & Snaefellsnes' })).toBeTruthy();
  });

  it('links each card to a create-trip prefill carrying the ordered stop list', () => {
    renderCards('japan', 'Japan');

    const link = screen.getAllByRole('link').find((candidate) => (
      candidate.getAttribute('href')?.startsWith('/create-trip?prefill=')
    ));
    expect(link).toBeDefined();

    const encoded = new URL(link!.getAttribute('href')!, 'https://travelflow.test').searchParams.get('prefill');
    const prefill = decodeTripPrefill(encoded!);

    expect(prefill?.countries).toEqual(['Japan']);
    expect(prefill?.cityList).toEqual(['Tokyo', 'Hakone', 'Kyoto', 'Osaka']);
  });

  it('renders the committed map preview on every route card', () => {
    renderCards('japan', 'Japan');

    const maps = screen.getAllByRole('img')
      .map((image) => image.getAttribute('src') || '')
      .filter((src) => src.startsWith('/images/trip-maps/routes/'));

    expect(maps).toHaveLength(3);
    expect(maps.some((src) => src.startsWith('/images/trip-maps/routes/japan-golden-route.png'))).toBe(true);
  });

  it('renders nothing for a country without curated routes', () => {
    const { container } = renderCards('germany', 'Germany');
    expect(container.innerHTML).toBe('');
  });
});
