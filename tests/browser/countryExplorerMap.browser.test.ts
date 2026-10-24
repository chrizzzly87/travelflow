// @vitest-environment jsdom
import { renderWithRouter as render } from '@/tests/helpers/renderWithRouter';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { MemoryRouter } from '@/tests/helpers/routerHarness';

import { CountryExplorerMap } from '../../components/inspirations/CountryExplorerMap';
import {
  getCountryMonthInsight,
  listCountryExplorerEntries,
  type CountryExplorerEntry,
} from '../../services/countryExplorerService';
import countryMapGeometry from '../../data/countryMapGeometry.generated.json';

const trackEvent = vi.fn();
const navigate = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    // Echoing the key back keeps these assertions about behaviour, not about copy.
    t: (key: string, values?: Record<string, unknown>) => (
      values?.country ? `${key}:${String(values.country)}` : key
    ),
  }),
}));

vi.mock('../../services/analyticsService', () => ({
  trackEvent: (...args: unknown[]) => trackEvent(...args),
  getAnalyticsDebugAttributes: () => ({}),
}));

vi.mock('@/app/navigation', async () => {
  const actual = await vi.importActual<typeof import('@/app/navigation')>('@/app/navigation');
  return { ...actual, useNavigate: () => navigate };
});

const entries = listCountryExplorerEntries();
const geometryCodes = new Set(
  (countryMapGeometry.countries as Array<{ countryCode: string }>).map((shape) => shape.countryCode),
);

/** A guide country the atlas can actually draw, so it is a real `<path>` and not a marker dot. */
const drawableEntry = entries.find((entry) => geometryCodes.has(entry.countryCode)) as CountryExplorerEntry;
const otherDrawableEntry = entries
  .filter((entry) => geometryCodes.has(entry.countryCode))[1] as CountryExplorerEntry;

const renderMap = async (overrides: Partial<React.ComponentProps<typeof CountryExplorerMap>> = {}) => await render(
  React.createElement(
    MemoryRouter,
    null,
    React.createElement(CountryExplorerMap, {
      entries,
      visibleCountryCodes: new Set(entries.map((entry) => entry.countryCode)),
      month: null,
      monthLabels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      buildHref: (slug: string) => `/inspirations/countries/${slug}`,
      getInsight: (entry: CountryExplorerEntry) => undefined,
      direction: 'ltr' as const,
      ...overrides,
    }),
  ),
);

const linkFor = (countryCode: string): HTMLElement => {
  const element = document.querySelector(`a[data-country-code="${countryCode}"]`);
  if (!element) throw new Error(`no interactive country for ${countryCode}`);
  return element as HTMLElement;
};

beforeEach(() => {
  trackEvent.mockClear();
  navigate.mockClear();
});

afterEach(cleanup);

describe('CountryExplorerMap', () => {
  it('renders every country in the atlas', async () => {
    const { container } = await renderMap();
    expect(container.querySelectorAll('path').length).toBe(countryMapGeometry.countries.length);
  });

  it('makes countries with a guide interactive and leaves the rest as furniture', async () => {
    const { container } = await renderMap();
    const interactive = container.querySelectorAll('a[data-country-code]');
    const codes = new Set(Array.from(interactive).map((node) => node.getAttribute('data-country-code')));

    entries.forEach((entry) => expect(codes.has(entry.countryCode)).toBe(true));
    codes.forEach((code) => {
      expect(entries.some((entry) => entry.countryCode === code)).toBe(true);
    });
  });

  it('gives each guide country a real href, so it works without JavaScript running the click', async () => {
    await renderMap();
    expect(linkFor(drawableEntry.countryCode).getAttribute('href'))
      .toBe(`/inspirations/countries/${drawableEntry.slug}`);
  });

  it('draws guide countries we cannot outline as anchor dots instead of dropping them', async () => {
    const { container } = await renderMap();
    const undrawable = entries.filter((entry) => !geometryCodes.has(entry.countryCode));
    if (undrawable.length === 0) return;
    undrawable.forEach((entry) => {
      const link = container.querySelector(`a[data-country-code="${entry.countryCode}"]`);
      expect(link?.querySelector('circle')).toBeTruthy();
    });
  });

  describe('hover', () => {
    it('shows the country name and region', async () => {
      await renderMap();
      fireEvent.pointerEnter(linkFor(drawableEntry.countryCode));
      expect(screen.getAllByText(drawableEntry.name).length).toBeGreaterThan(0);
      expect(screen.getAllByText(drawableEntry.region).length).toBeGreaterThan(0);
    });

    it('clears again on pointer leave', async () => {
      await renderMap();
      const link = linkFor(drawableEntry.countryCode);
      fireEvent.pointerEnter(link);
      expect(screen.queryByText('inspirations.subpages.map.openGuide')).not.toBeNull();
      fireEvent.pointerLeave(link);
      expect(screen.queryByText('inspirations.subpages.map.openGuide')).toBeNull();
    });

    it('offers a no-guide hint for a country we do not cover', async () => {
      const { container } = await renderMap();
      const uncovered = (countryMapGeometry.countries as Array<{ countryCode: string; name: string }>)
        .find((shape) => !entries.some((entry) => entry.countryCode === shape.countryCode));
      if (!uncovered) return;

      const group = container.querySelector(`g[aria-hidden="true"]`);
      expect(group).toBeTruthy();
      fireEvent.pointerEnter(group as Element);
      expect(screen.queryByText('inspirations.subpages.map.noGuide')).not.toBeNull();
    });
  });

  describe('click', () => {
    it('navigates to the guide and reports the country to analytics', async () => {
      await renderMap();
      fireEvent.click(linkFor(drawableEntry.countryCode));

      expect(navigate).toHaveBeenCalledWith(`/inspirations/countries/${drawableEntry.slug}`);
      expect(trackEvent).toHaveBeenCalledWith('inspirations__country_map', expect.objectContaining({
        country: drawableEntry.name,
        country_code: drawableEntry.countryCode,
      }));
    });

    it('leaves a modified click to the browser so the link can open in a new tab', async () => {
      await renderMap();
      fireEvent.click(linkFor(drawableEntry.countryCode), { metaKey: true });
      expect(navigate).not.toHaveBeenCalled();
    });

    it('explains itself instead of failing silently on a country with no guide', async () => {
      const { container } = await renderMap();
      const group = container.querySelector('g[aria-hidden="true"]');
      fireEvent.click(group as Element);

      const notice = screen.getByRole('status');
      expect(notice.textContent).toContain('inspirations.subpages.map.noGuideFor:');
      expect(navigate).not.toHaveBeenCalled();
      expect(trackEvent).toHaveBeenCalledWith(
        'inspirations__country_map--no_guide',
        expect.objectContaining({ country: expect.any(String) }),
      );
    });

    it('lets the no-guide notice be dismissed', async () => {
      const { container } = await renderMap();
      fireEvent.click(container.querySelector('g[aria-hidden="true"]') as Element);
      const notice = screen.getByRole('status');
      fireEvent.click(within(notice).getByText('inspirations.subpages.map.dismissNotice'));
      expect(screen.queryByRole('status')).toBeNull();
    });
  });

  describe('keyboard access', () => {
    it('exposes exactly one tab stop for the whole map', async () => {
      const { container } = await renderMap();
      const tabbable = container.querySelectorAll('a[data-country-code][tabindex="0"]');
      expect(tabbable.length).toBe(1);
    });

    it('moves the tab stop with the arrow keys', async () => {
      const { container } = await renderMap();
      const first = container.querySelector('a[data-country-code][tabindex="0"]') as HTMLElement;
      const firstCode = first.getAttribute('data-country-code');

      fireEvent.keyDown(first, { key: 'ArrowRight' });

      const next = container.querySelector('a[data-country-code][tabindex="0"]') as HTMLElement;
      expect(next.getAttribute('data-country-code')).not.toBe(firstCode);
      expect(container.querySelectorAll('a[data-country-code][tabindex="0"]').length).toBe(1);
    });

    it('does not run off the end of the map', async () => {
      const { container } = await renderMap();
      const first = container.querySelector('a[data-country-code][tabindex="0"]') as HTMLElement;
      fireEvent.keyDown(first, { key: 'Home' });
      const stillFirst = container.querySelector('a[data-country-code][tabindex="0"]') as HTMLElement;
      fireEvent.keyDown(stillFirst, { key: 'ArrowLeft' });
      expect(container.querySelectorAll('a[data-country-code][tabindex="0"]').length).toBe(1);

      fireEvent.keyDown(
        container.querySelector('a[data-country-code][tabindex="0"]') as HTMLElement,
        { key: 'End' },
      );
      fireEvent.keyDown(
        container.querySelector('a[data-country-code][tabindex="0"]') as HTMLElement,
        { key: 'ArrowRight' },
      );
      expect(container.querySelectorAll('a[data-country-code][tabindex="0"]').length).toBe(1);
    });

    it('announces the focused country through a live region, not just the tooltip', async () => {
      const { container } = await renderMap();
      const live = container.querySelector('[aria-live="polite"]') as HTMLElement;
      expect(live.textContent).toBe('');

      fireEvent.focus(linkFor(drawableEntry.countryCode));
      expect(live.textContent).toContain(drawableEntry.name);
      expect(live.textContent).toContain(drawableEntry.region);
    });

    it('labels each country link with the same description it announces', async () => {
      await renderMap();
      const label = linkFor(drawableEntry.countryCode).getAttribute('aria-label') || '';
      expect(label).toContain(drawableEntry.name);
      expect(label).toContain(drawableEntry.region);
    });

    it('keeps a pointer hover from stealing a keyboard focus tooltip', async () => {
      await renderMap();
      const focused = linkFor(drawableEntry.countryCode);
      const other = linkFor(otherDrawableEntry.countryCode);

      fireEvent.focus(focused);
      fireEvent.pointerEnter(other);
      fireEvent.pointerLeave(other);
      // The pointer leaving `other` must not clear the tooltip that focus owns.
      expect(screen.queryByText('inspirations.subpages.map.openGuide')).not.toBeNull();
    });
  });

  describe('agreement with the grid', () => {
    it('says so in the accessible name when a country is filtered out', async () => {
      await renderMap({ visibleCountryCodes: new Set<string>() });
      expect(linkFor(drawableEntry.countryCode).getAttribute('aria-label'))
        .toContain('inspirations.subpages.map.filteredOut');
    });

    it('does not say so while the country is still in the results', async () => {
      await renderMap();
      expect(linkFor(drawableEntry.countryCode).getAttribute('aria-label'))
        .not.toContain('inspirations.subpages.map.filteredOut');
    });

    it('swaps the legend to the seasonal bands once a month is selected', async () => {
      const { rerender } = await renderMap();
      expect(screen.queryByText('inspirations.subpages.map.legend.match')).not.toBeNull();
      expect(screen.queryByText('inspirations.subpages.map.legend.ideal')).toBeNull();

      cleanup();
      await renderMap({
        month: 1,
        getInsight: (entry: CountryExplorerEntry) => getCountryMonthInsight(entry, 1),
      });
      expect(screen.queryByText('inspirations.subpages.map.legend.ideal')).not.toBeNull();
      void rerender;
    });

    it('includes the month band in the description once a month is selected', async () => {
      await renderMap({
        month: 1,
        getInsight: (entry: CountryExplorerEntry) => getCountryMonthInsight(entry, 1),
      });
      const label = linkFor(drawableEntry.countryCode).getAttribute('aria-label') || '';
      expect(label).toMatch(/inspirations\.subpages\.explorer\.band\.(ideal|shoulder|avoid)/);
      expect(label).toContain('Jan');
    });

    it('shows a straight-line distance in the tooltip while sorting by distance', async () => {
      await renderMap({
        distanceKmByCountry: new Map([[drawableEntry.countryCode, 8437]]),
        formatDistance: (distanceKm: number) => `~${distanceKm} km`,
      });
      fireEvent.pointerEnter(linkFor(drawableEntry.countryCode));
      expect(screen.queryByText('~8437 km')).not.toBeNull();
    });
  });

  it('does not mirror the geography in RTL locales', async () => {
    const { container } = await renderMap({ direction: 'rtl' });
    const positioning = container.querySelector('div[dir="ltr"]');
    expect(positioning).toBeTruthy();
    expect(positioning?.querySelector('svg')).toBeTruthy();
  });
});
