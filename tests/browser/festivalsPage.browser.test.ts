// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  trackEvent: vi.fn(),
  getAnalyticsDebugAttributes: vi.fn((eventName: string) => ({ 'data-tf-track-event': eventName })),
}));

vi.mock('../../services/analyticsService', () => ({
  trackEvent: (...args: unknown[]) => mocks.trackEvent(...args),
  getAnalyticsDebugAttributes: (...args: unknown[]) => mocks.getAnalyticsDebugAttributes(...args),
}));

// The marketing chrome pulls in the whole app shell; the page body is what matters here.
vi.mock('../../components/marketing/MarketingLayout', () => ({
  MarketingLayout: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    // Echo the key plus its values so assertions can prove which string was chosen.
    t: (key: string, values?: Record<string, unknown>) => (
      values ? `${key}(${Object.entries(values).map(([k, v]) => `${k}=${v}`).join(',')})` : key
    ),
  }),
}));

import { FestivalsPage } from '../../pages/inspirations/FestivalsPage';
import { FESTIVAL_CATALOG } from '../../services/festivalCatalogService';
import { sortFestivalsByNextOccurrence } from '../../services/festivalDateService';

// The page reads the clock on mount, so pin it: otherwise every date assertion
// silently changes meaning as real time passes.
const FIXED_NOW = new Date('2026-08-18T00:00:00Z');

/** Surfaces the router's current query string so URL state can be asserted. */
const LocationProbe: React.FC = () => {
  const location = useLocation();
  return React.createElement('output', { 'data-testid': 'location-search' }, location.search);
};

const renderAt = (entry: string) => render(
  React.createElement(
    MemoryRouter,
    { initialEntries: [entry] },
    React.createElement(FestivalsPage),
    React.createElement(LocationProbe),
  ),
);

const renderPage = () => renderAt('/inspirations/events-and-festivals');

describe('pages/inspirations/FestivalsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(FIXED_NOW);
  });

  // The suite renders the same page repeatedly; without an explicit unmount the
  // previous tree stays in the document and every query matches twice.
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders every catalogued festival as a card', () => {
    renderPage();
    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(FESTIVAL_CATALOG.length);
  });

  it('shows a country flag icon rather than an emoji flag', () => {
    const { container } = renderPage();
    // FlagIcon renders flagpack `fp` spans; emoji flags would be bare text nodes.
    expect(container.querySelectorAll('span.fp').length).toBeGreaterThan(0);
    expect(container.textContent).not.toMatch(/[\u{1F1E6}-\u{1F1FF}]{2}/u);
  });

  it('orders the grid soonest first', () => {
    renderPage();
    const headings = screen.getAllByRole('heading', { level: 2 }).map((node) => node.textContent);
    const expected = sortFestivalsByNextOccurrence(FESTIVAL_CATALOG.map((entry) => entry.event), FIXED_NOW)
      .map((item) => item.event.name);

    expect(headings).toEqual(expected);
    // Sanity anchor: at this clock, Sydney's 31 December show precedes April's Songkran.
    expect(headings.indexOf('Sydney New Year Fireworks')).toBeLessThan(headings.indexOf('Songkran'));
  });

  it('labels approximate festivals with "usually" copy and never a fabricated day', () => {
    renderPage();
    const holiCard = screen.getByRole('heading', { level: 2, name: 'Holi' }).closest('article');
    expect(holiCard).not.toBeNull();
    expect(within(holiCard as HTMLElement).getByText(/festivals\.date\.usually/)).toBeInTheDocument();
    expect(within(holiCard as HTMLElement).getByText(/festivals\.precision\.approximate/)).toBeInTheDocument();
  });

  it('labels fixed-date festivals with a real formatted date', () => {
    renderPage();
    const songkranCard = screen.getByRole('heading', { level: 2, name: 'Songkran' }).closest('article');
    expect(within(songkranCard as HTMLElement).getByText(/\d/)).toBeInTheDocument();
    expect(within(songkranCard as HTMLElement).queryByText(/festivals\.date\.usually/)).toBeNull();
  });

  it('emits Event JSON-LD without inventing dates for approximate festivals', () => {
    const { container } = renderPage();
    const script = container.querySelector('script[type="application/ld+json"]');
    const payload = JSON.parse(script?.textContent || '{}');

    expect(payload['@type']).toBe('ItemList');
    expect(payload.numberOfItems).toBe(FESTIVAL_CATALOG.length);
    expect(payload.itemListElement).toHaveLength(FESTIVAL_CATALOG.length);

    // Holi is lunar and unsourced for upcoming years: month precision only, never a day.
    const holi = payload.itemListElement.find((entry: { item: { name: string } }) => entry.item.name === 'Holi');
    expect(holi.item.startDate).toBe('2027-03');
    expect(holi.item.endDate).toBeUndefined();

    // Songkran is pinned to 13-15 April, so the graph publishes the real days.
    const songkran = payload.itemListElement.find((entry: { item: { name: string } }) => entry.item.name === 'Songkran');
    expect(songkran.item.startDate).toBe('2027-04-13');
    expect(songkran.item.endDate).toBe('2027-04-15');
  });

  it('filters by region and tracks the interaction', async () => {
    const user = userEvent.setup();
    renderPage();

    const oceaniaCount = FESTIVAL_CATALOG.filter((entry) => entry.regionId === 'oceania').length;
    await user.click(screen.getByRole('button', { name: 'inspirations.subpages.festivals.regions.oceania' }));

    expect(screen.getAllByRole('article')).toHaveLength(oceaniaCount);
    expect(mocks.trackEvent).toHaveBeenCalledWith('inspirations__festival_filter--region', { region: 'oceania' });
  });

  it('filters by month and can be cleared again', async () => {
    const user = userEvent.setup();
    renderPage();

    const aprilCount = FESTIVAL_CATALOG.filter((entry) => entry.event.month === 4).length;
    await user.click(screen.getByRole('button', { name: 'Apr' }));
    expect(screen.getAllByRole('article')).toHaveLength(aprilCount);
    expect(mocks.trackEvent).toHaveBeenCalledWith('inspirations__festival_filter--month', { month: 4 });

    await user.click(screen.getByRole('button', { name: /festivals\.clearFilters/ }));
    expect(screen.getAllByRole('article')).toHaveLength(FESTIVAL_CATALOG.length);
  });

  it('mirrors the active filters into the query string so the view is shareable', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'inspirations.subpages.festivals.regions.oceania' }));
    await user.click(screen.getByRole('button', { name: 'Apr' }));

    const search = screen.getByTestId('location-search').textContent || '';
    expect(search).toContain('region=oceania');
    expect(search).toContain('month=4');
  });

  it('restores state from the query string on first render', () => {
    renderAt('/inspirations/events-and-festivals?region=oceania');

    const oceaniaCount = FESTIVAL_CATALOG.filter((entry) => entry.regionId === 'oceania').length;
    expect(screen.getAllByRole('article')).toHaveLength(oceaniaCount);
  });

  it('links festival cards to a prefilled create-trip URL', () => {
    renderPage();
    const songkranCard = screen.getByRole('heading', { level: 2, name: 'Songkran' }).closest('article');
    const planLink = within(songkranCard as HTMLElement)
      .getByRole('link', { name: /festivals\.planCta/ });

    expect(planLink.getAttribute('href')).toContain('/create-trip?prefill=');
  });
});
