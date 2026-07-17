// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../components/navigation/SiteHeader', () => ({
  SiteHeader: () => React.createElement('header', { 'data-testid': 'site-header' }),
}));

vi.mock('../../components/marketing/SiteFooter', () => ({
  SiteFooter: () => React.createElement('footer', { 'data-testid': 'site-footer' }),
}));

vi.mock('../../services/analyticsService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/analyticsService')>();
  return {
    ...actual,
    trackEvent: vi.fn(),
  };
});

vi.mock('../../services/travelKnowledgeService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/travelKnowledgeService')>();
  return {
    ...actual,
    loadTravelDestinationPack: vi.fn(),
  };
});

vi.mock('../../services/travelPlanningContextService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/travelPlanningContextService')>();
  return {
    ...actual,
    loadTravelPlanningContext: vi.fn(),
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === 'shapeLab.place.stayRange') return `${options?.min}–${options?.max} nights`;
      if (key === 'shapeLab.place.popularity') return `Popular ${options?.score}`;
      if (key === 'shapeLab.place.hiddenGem') return `Discovery ${options?.score}`;
      if (key === 'shapeLab.reveal.match') return `${options?.score}% route fit`;
      if (key === 'shapeLab.reveal.nightsShort') return `${options?.count} nights`;
      if (key === 'shapeLab.reveal.engine.milliseconds') return `${options?.value} ms`;
      return key;
    },
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}));

import { CreateTripShapeLabPage } from '../../pages/CreateTripShapeLabPage';
import { trackEvent } from '../../services/analyticsService';
import {
  getBundledTravelDestinationPack,
  loadTravelDestinationPack,
  type TravelKnowledgeLoadResult,
} from '../../services/travelKnowledgeService';
import { loadTravelPlanningContext } from '../../services/travelPlanningContextService';
import { buildTravelPlanningContext } from '../../shared/travelPlanningContext';

const renderPage = (onTripGenerated = vi.fn()) => {
  render(React.createElement(
    MemoryRouter,
    { initialEntries: ['/create-trip/labs/shape'] },
    React.createElement(CreateTripShapeLabPage, {
      onTripGenerated,
      onOpenManager: vi.fn(),
    }),
  ));
  return { onTripGenerated };
};

beforeEach(() => {
  vi.mocked(loadTravelDestinationPack).mockImplementation(async ({ countryCode, locale }) => ({
    pack: getBundledTravelDestinationPack(countryCode, locale)!,
    source: 'bundled',
    loadDurationMs: 0.25,
  }));
  vi.mocked(loadTravelPlanningContext).mockImplementation(async (options) => {
    const contextPack = getBundledTravelDestinationPack('TH', options.locale)!;
    return {
      context: buildTravelPlanningContext(contextPack, options.spec, options),
      source: 'bundled',
      loadDurationMs: options.templateKeys?.length ? 7.25 : 12.5,
    };
  });
});

afterEach(() => {
  cleanup();
  vi.mocked(trackEvent).mockClear();
  vi.mocked(loadTravelDestinationPack).mockReset();
  vi.mocked(loadTravelPlanningContext).mockReset();
});

describe('pages/CreateTripShapeLabPage', () => {
  it('moves from trip shape to a canonical city and neighborhood selection', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(trackEvent).toHaveBeenCalledWith(
      'create_trip_shape__knowledge--load',
      expect.objectContaining({
        source: 'bundled',
        load_duration_ms: 0.25,
        dataset_version: '2026.07.17-v6',
      }),
    ));

    await user.click(screen.getByRole('button', { name: /shapeLab\.shape\.options\.city_break\.title/i }));
    expect(screen.getByText('shapeLab.place.title')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Bangkok/i }));
    expect(vi.mocked(trackEvent).mock.calls.filter(([eventName]) => (
      eventName === 'create_trip_shape__city--select'
    ))).toHaveLength(1);
    expect(screen.getByRole('button', { name: /Yaowarat/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Yaowarat/i }));

    expect(screen.getByRole('button', { name: /Yaowarat/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /wizard\.actions\.continue/i })).not.toBeDisabled();
  });

  it('resolves a neighborhood alias to its canonical city and neighborhood selection', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /shapeLab\.shape\.options\.city_break\.title/i }));
    const search = screen.getByRole('searchbox', { name: 'shapeLab.place.searchLabel' });
    await user.type(search, 'Chinatown');
    await user.click(screen.getByRole('button', { name: /Yaowarat/i }));

    expect(screen.getByText('Bangkok', { selector: 'strong' }).closest('button')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Yaowarat/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /wizard\.actions\.continue/i })).not.toBeDisabled();
    expect(trackEvent).toHaveBeenCalledWith(
      'create_trip_shape__neighborhood--select_search',
      expect.objectContaining({
        neighborhood: 'th-bangkok-yaowarat',
        city: 'th-bangkok',
        journey_type: 'city_break',
      }),
    );
  });

  it('reveals a premade route and opens a knowledge-enriched editable plan without AI generation', async () => {
    const user = userEvent.setup();
    const onTripGenerated = vi.fn();
    renderPage(onTripGenerated);

    await user.click(screen.getByRole('button', { name: /shapeLab\.shape\.options\.city_break\.title/i }));
    await user.click(screen.getByRole('button', { name: /Bangkok/i }));
    await user.click(screen.getByRole('button', { name: /Yaowarat/i }));
    await user.click(screen.getByRole('button', { name: /wizard\.actions\.continue/i }));
    await user.click(screen.getByRole('button', { name: /wizard\.actions\.continue/i }));
    await user.click(screen.getByRole('button', { name: /shapeLab\.actions\.compare/i }));

    expect(await screen.findByText('Bangkok in layers')).toBeInTheDocument();
    expect(screen.getByText('shapeLab.reveal.engine.noAi')).toBeInTheDocument();
    expect(screen.getByText('13 ms')).toBeInTheDocument();
    expect(trackEvent).toHaveBeenCalledWith(
      'create_trip_shape__concepts--prepare',
      expect.objectContaining({
        journey_type: 'city_break',
        concept_count: 2,
        attempted_template_count: 2,
        failed_template_count: 0,
        knowledge_source: 'bundled',
        dataset_version: '2026.07.17-v6',
      }),
    );
    await waitFor(() => expect(trackEvent).toHaveBeenCalledWith(
      'create_trip_shape__reveal--ready',
      expect.objectContaining({
        journey_type: 'city_break',
        concept_count: 2,
        knowledge_source: 'bundled',
        dataset_version: '2026.07.17-v6',
      }),
    ));
    await user.click(screen.getAllByRole('button', { name: /shapeLab\.reveal\.chooseRoute/i })[0]!);
    await waitFor(() => expect(loadTravelPlanningContext).toHaveBeenLastCalledWith(expect.objectContaining({
      templateKeys: ['th-bangkok-long-weekend'],
      neighborhoodLimitPerCity: 4,
      poiLimitPerCity: 6,
    })));
    await waitFor(() => expect(screen.getByRole('button', { name: /shapeLab\.actions\.openPlan/i })).toBeEnabled());
    expect(screen.getByText(/boat noodles/i)).toBeInTheDocument();
    expect(screen.getByText(/Yaowarat \/ Chinatown/i)).toHaveAttribute('data-selected', 'true');
    expect(screen.getAllByRole('link', { name: /shapeLab\.reveal\.brief\.source/i }).some((link) => (
      link.getAttribute('href')?.includes('tourismthailand.org')
    ))).toBe(true);
    await user.click(screen.getByRole('button', { name: /shapeLab\.actions\.openPlan/i }));

    await waitFor(() => expect(onTripGenerated).toHaveBeenCalledTimes(1));
    expect(trackEvent).toHaveBeenCalledWith(
      'create_trip_shape__skeleton--open',
      expect.objectContaining({
        template: 'th-bangkok-long-weekend',
        skeleton_duration_ms: expect.any(Number),
        enrichment_duration_ms: expect.any(Number),
        compile_duration_ms: expect.any(Number),
      }),
    );
    const trip = onTripGenerated.mock.calls[0]?.[0];
    expect(trip.planningMeta).toMatchObject({
      routeStage: 'enriched',
      datasetVersion: '2026.07.17-v6',
      templateKey: 'th-bangkok-long-weekend',
      trace: {
        skeletonCompilerVersion: 'journey-skeleton-v1',
        templateRankerVersion: 'travel-template-ranker-v1',
        knowledgeEnricherVersion: 'journey-knowledge-enricher-v1',
        planningContext: {
          version: 1,
          retrieverVersion: 'structured-pack-v1',
          source: 'bundled',
          aiCallCount: 0,
        },
      },
    });
    expect(trip.planningMeta.destinationBriefs[0]).toMatchObject({
      city: { canonicalSlug: 'th-bangkok' },
      signatureDishes: { value: expect.arrayContaining(['boat noodles']) },
    });
    expect(trip.items.some((item: { type: string; title: string }) => item.type === 'city' && item.title === 'Bangkok')).toBe(true);
    expect(trip.items.some((item: { knowledgeMeta?: { origin?: string } }) => (
      item.knowledgeMeta?.origin === 'knowledge_ranker'
    ))).toBe(true);
  });

  it('keeps a revealed comparison bound to its dataset when a remote refresh finishes later', async () => {
    let resolveLoad!: (result: TravelKnowledgeLoadResult) => void;
    vi.mocked(loadTravelDestinationPack).mockImplementationOnce(() => new Promise((resolve) => {
      resolveLoad = resolve;
    }));
    const user = userEvent.setup();
    const onTripGenerated = vi.fn();
    renderPage(onTripGenerated);

    await user.click(screen.getByRole('button', { name: /shapeLab\.shape\.options\.city_break\.title/i }));
    await user.click(screen.getByRole('button', { name: /Bangkok/i }));
    await user.click(screen.getByRole('button', { name: /wizard\.actions\.continue/i }));
    await user.click(screen.getByRole('button', { name: /wizard\.actions\.continue/i }));
    await user.click(screen.getByRole('button', { name: /shapeLab\.actions\.compare/i }));
    await user.click(screen.getAllByRole('button', { name: /shapeLab\.reveal\.chooseRoute/i })[0]!);
    await waitFor(() => expect(screen.getByRole('button', { name: /shapeLab\.actions\.openPlan/i })).toBeEnabled());

    const bundledPack = getBundledTravelDestinationPack('TH', 'en')!;
    await act(async () => {
      resolveLoad({
        pack: {
          ...bundledPack,
          dataset: { ...bundledPack.dataset!, version: 'remote-test-version' },
        },
        source: 'supabase',
        loadDurationMs: 820.125,
      });
    });
    await waitFor(() => expect(trackEvent).toHaveBeenCalledWith(
      'create_trip_shape__knowledge--load',
      expect.objectContaining({
        source: 'supabase',
        load_duration_ms: 820.125,
        dataset_version: 'remote-test-version',
      }),
    ));

    await user.click(screen.getByRole('button', { name: /shapeLab\.actions\.openPlan/i }));
    await waitFor(() => expect(onTripGenerated).toHaveBeenCalledTimes(1));
    expect(onTripGenerated.mock.calls[0]?.[0].planningMeta.datasetVersion).toBe('2026.07.17-v6');
  });
});
