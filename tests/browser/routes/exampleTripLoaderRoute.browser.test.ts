// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';

import type { IViewSettings } from '../../../types';
import { makeTrip } from '../../helpers/tripFixtures';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  confirmDialog: vi.fn().mockResolvedValue(true),
  route: {
    templateId: 'template-1' as string | undefined,
    pathname: '/example/template-1',
    search: '',
    hash: '',
    state: null as unknown,
  },
  auth: {
    access: {
      entitlements: {
        tripExpirationDays: 14,
      },
    },
  },
  trackEvent: vi.fn(),
  dbCanCreateTrip: vi.fn(),
  dbUpsertTrip: vi.fn(),
  dbCreateTripVersion: vi.fn(),
  saveTrip: vi.fn(),
  buildCreateTripUrl: vi.fn(() => '/create-trip?source=example'),
  generateTripId: vi.fn(() => 'cloned-example-trip'),
  loadExampleTemplateFactory: vi.fn(),
  getExampleTemplateSummary: vi.fn(),
  tripViewProps: [] as any[],
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ templateId: mocks.route.templateId }),
  useLocation: () => ({
    pathname: mocks.route.pathname,
    search: mocks.route.search,
    hash: mocks.route.hash,
    state: mocks.route.state,
  }),
  useNavigate: () => mocks.navigate,
}));

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ access: mocks.auth.access }),
}));

vi.mock('../../../components/AppDialogProvider', () => ({
  useAppDialog: () => ({
    confirm: mocks.confirmDialog,
  }),
}));

vi.mock('../../../config/db', () => ({
  DB_ENABLED: true,
}));

vi.mock('../../../services/analyticsService', () => ({
  trackEvent: mocks.trackEvent,
}));

vi.mock('../../../services/dbApi', () => ({
  dbCanCreateTrip: mocks.dbCanCreateTrip,
  dbUpsertTrip: mocks.dbUpsertTrip,
  dbCreateTripVersion: mocks.dbCreateTripVersion,
}));

vi.mock('../../../services/storageService', () => ({
  saveTrip: mocks.saveTrip,
}));

vi.mock('../../../utils', () => ({
  buildCreateTripUrl: mocks.buildCreateTripUrl,
  generateTripId: mocks.generateTripId,
}));

vi.mock('../../../data/exampleTripTemplates/runtimeFactory', () => ({
  loadExampleTemplateFactory: mocks.loadExampleTemplateFactory,
  getExampleTemplateSummary: mocks.getExampleTemplateSummary,
}));

vi.mock('../../../components/TripView', () => ({
  TripView: (props: any) => {
    mocks.tripViewProps.push(props);
    return null;
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) => {
      if (key === 'shared.perMonth') return '/mo';
      if (key === 'shared.days') return `${options?.count ?? 0} days`;
      return key;
    },
  }),
}));

import { ExampleTripLoaderRoute } from '../../../routes/ExampleTripLoaderRoute';

const makeRouteProps = (overrides?: Partial<React.ComponentProps<typeof ExampleTripLoaderRoute>>) => ({
  trip: null,
  onTripLoaded: vi.fn(),
  onOpenManager: vi.fn(),
  onOpenSettings: vi.fn(),
  appLanguage: 'en' as const,
  onViewSettingsChange: vi.fn(),
  ...overrides,
});

const latestTripViewProps = () => mocks.tripViewProps[mocks.tripViewProps.length - 1];

describe('routes/ExampleTripLoaderRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tripViewProps.length = 0;
    mocks.route.templateId = 'template-1';
    mocks.route.pathname = '/example/template-1';
    mocks.route.search = '';
    mocks.route.hash = '';
    mocks.route.state = null;
    mocks.auth.access = {
      tierKey: 'tier_free',
      entitlements: {
        tripExpirationDays: 14,
      },
    };
    mocks.dbCanCreateTrip.mockResolvedValue({
      allowCreate: true,
      activeTripCount: 1,
      maxTripCount: 5,
    });
    mocks.dbUpsertTrip.mockResolvedValue(null);
    mocks.dbCreateTripVersion.mockResolvedValue(null);
    mocks.getExampleTemplateSummary.mockReturnValue({
      title: 'Template title',
      countries: [{ name: 'Iceland' }],
    });
    mocks.loadExampleTemplateFactory.mockResolvedValue((createdAtIso: string) =>
      makeTrip({
        id: 'generated-example',
        title: 'Generated example',
        createdAt: Date.parse(createdAtIso),
        updatedAt: Date.parse(createdAtIso),
        isExample: true,
        exampleTemplateId: 'template-1',
      })
    );
  });

  it('navigates to home when template id is missing', async () => {
    mocks.route.templateId = undefined;
    const props = makeRouteProps();

    render(React.createElement(ExampleTripLoaderRoute, props));

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith('/', { replace: true });
    });
  });

  it('hydrates from prefetched trip state and tracks open event', async () => {
    const prefetchedView: IViewSettings = {
      layoutMode: 'horizontal',
      timelineView: 'vertical',
      mapStyle: 'clean',
      routeMode: 'realistic',
      showCityNames: true,
      zoomLevel: 1.5,
      sidebarWidth: 500,
      timelineHeight: 340,
    };
    const prefetchedTrip = makeTrip({
      id: 'example-prefetched',
      title: 'Prefetched example',
      isExample: true,
      exampleTemplateId: 'template-1',
      exampleTemplateCountries: ['Iceland'],
      defaultView: prefetchedView,
    });

    mocks.route.state = {
      prefetchedExampleTrip: prefetchedTrip,
      prefetchedExampleView: prefetchedView,
      prefetchedTemplateTitle: 'Prefetched title',
      prefetchedTemplateCountries: ['Iceland'],
    };

    const props = makeRouteProps({ trip: prefetchedTrip });

    render(React.createElement(ExampleTripLoaderRoute, props));

    await waitFor(() => {
      expect(props.onTripLoaded).toHaveBeenCalledWith(prefetchedTrip, prefetchedView);
    });
    expect(mocks.trackEvent).toHaveBeenCalledWith('example_trip__open', {
      template: 'template-1',
      country_count: 1,
    });
    await waitFor(() => {
      expect(latestTripViewProps()?.isExamplePreview).toBe(true);
    });
  });

  it('redirects to home when template factory cannot be loaded', async () => {
    mocks.loadExampleTemplateFactory.mockResolvedValue(null);
    const props = makeRouteProps();

    render(React.createElement(ExampleTripLoaderRoute, props));

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith('/', { replace: true });
    });
    expect(props.onTripLoaded).not.toHaveBeenCalled();
  });

  it('does not change hook order when the example trip prop appears after initial null render', async () => {
    const resolvedTrip = makeTrip({
      id: 'example-late-load',
      title: 'Example late load',
      isExample: true,
      exampleTemplateId: 'template-1',
    });
    const props = makeRouteProps();
    const view = render(React.createElement(ExampleTripLoaderRoute, props));

    expect(() => {
      view.rerender(React.createElement(ExampleTripLoaderRoute, {
        ...props,
        trip: resolvedTrip,
      }));
    }).not.toThrow();

    await waitFor(() => {
      expect(latestTripViewProps()?.trip).toEqual(resolvedTrip);
    });
  });

  it('renders a route loading shell while example template resources are still resolving', () => {
    mocks.loadExampleTemplateFactory.mockImplementation(() => new Promise(() => {}));
    const props = makeRouteProps();
    const view = render(React.createElement(ExampleTripLoaderRoute, props));

    expect(view.queryAllByTestId('trip-route-loading-shell').length).toBeGreaterThan(0);
    expect(latestTripViewProps()).toBeUndefined();
  });

  it('handles copy and create-similar actions through TripView callbacks', async () => {
    const activeTrip = makeTrip({
      id: 'example-active',
      title: 'Example active',
      isExample: true,
      exampleTemplateId: 'template-1',
      exampleTemplateCountries: ['Iceland', 'Faroe Islands'],
    });

    const props = makeRouteProps({ trip: activeTrip });

    render(React.createElement(ExampleTripLoaderRoute, props));

    await waitFor(() => {
      expect(latestTripViewProps()?.onCopyTrip).toBeTypeOf('function');
      expect(latestTripViewProps()?.exampleTripBanner?.onCreateSimilarTrip).toBeTypeOf('function');
    });

    await act(async () => {
      await latestTripViewProps().onCopyTrip();
    });

    expect(mocks.saveTrip).toHaveBeenCalled();
    expect(mocks.dbUpsertTrip).toHaveBeenCalled();
    expect(mocks.dbCreateTripVersion).toHaveBeenCalled();
    expect(mocks.navigate).toHaveBeenCalledWith('/trip/cloned-example-trip/overview');

    act(() => {
      latestTripViewProps().exampleTripBanner.onCreateSimilarTrip();
    });

    expect(mocks.buildCreateTripUrl).toHaveBeenCalled();
    expect(mocks.navigate).toHaveBeenCalledWith('/create-trip?source=example');
    expect(mocks.trackEvent).toHaveBeenCalledWith('example_trip__banner--copy_trip', {
      template: 'template-1',
      country_count: 1,
    });
    expect(mocks.trackEvent).toHaveBeenCalledWith('example_trip__banner--create_similar', {
      template: 'template-1',
      country_count: 1,
    });
  });

  it('opens the upgrade dialog and routes into checkout when trip limit is reached', async () => {
    mocks.dbCanCreateTrip.mockResolvedValue({
      allowCreate: false,
      activeTripCount: 5,
      maxTripCount: 5,
    });

    const activeTrip = makeTrip({
      id: 'example-limit',
      title: 'Example limit',
      isExample: true,
      exampleTemplateId: 'template-1',
      exampleTemplateCountries: ['Iceland'],
    });

    const props = makeRouteProps({ trip: activeTrip });
    render(React.createElement(ExampleTripLoaderRoute, props));

    await waitFor(() => {
      expect(latestTripViewProps()?.onCopyTrip).toBeTypeOf('function');
    });

    await act(async () => {
      await latestTripViewProps().onCopyTrip();
    });

    expect(mocks.confirmDialog).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).toHaveBeenCalledWith('/checkout?tier=tier_mid&source=example_trip_limit_dialog&return_to=%2Fexample%2Ftemplate-1');
    expect(mocks.saveTrip).not.toHaveBeenCalled();
    expect(mocks.dbUpsertTrip).not.toHaveBeenCalled();
    expect(mocks.dbCreateTripVersion).not.toHaveBeenCalled();
    expect(mocks.trackEvent).not.toHaveBeenCalledWith('example_trip__banner--copy_trip', expect.anything());
  });
});
