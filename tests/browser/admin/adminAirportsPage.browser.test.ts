// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from '@/tests/helpers/routerHarness';
import { resolveMapRuntime } from '../../../shared/mapRuntime';

const mocks = vi.hoisted(() => ({
  adminBulkUpdateAirportCatalogRecords: vi.fn(),
  adminCreateAirportCatalogRecord: vi.fn(),
  adminDeleteAirportCatalogRecords: vi.fn(),
  adminGetAirportCatalog: vi.fn(),
  adminSyncAirportCatalog: vi.fn(),
  adminUpdateAirportCatalogRecord: vi.fn(),
  confirm: vi.fn(),
  ensureRuntimeLocationLoaded: vi.fn(),
  fetchNearbyAirports: vi.fn(),
  reverseGeocodeCountry: vi.fn(),
  showAppToast: vi.fn(() => 'toast-id'),
}));

vi.mock('../../../components/admin/AdminShell', () => ({
  AdminShell: ({
    title,
    description,
    actions,
    children,
    searchValue,
    onSearchValueChange,
  }: {
    title: string;
    description?: string;
    actions?: React.ReactNode;
    children: React.ReactNode;
    searchValue?: string;
    onSearchValueChange?: (value: string) => void;
  }) => (
    React.createElement(
      'section',
      null,
      React.createElement('h1', null, title),
      description ? React.createElement('p', null, description) : null,
      typeof searchValue === 'string'
        ? React.createElement('input', {
            'aria-label': 'Admin shell search',
            value: searchValue,
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => onSearchValueChange?.(event.target.value),
          })
        : null,
      actions,
      children,
    )
  ),
}));

vi.mock('../../../components/GoogleMapsLoader', () => ({
  GoogleMapsLoader: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  useGoogleMaps: () => ({ isLoaded: true, loadError: null }),
  useMapRuntime: () => ({
    runtime: resolveMapRuntime({
      defaultPreset: 'google_all',
      availability: { googleMapsKeyAvailable: true, mapboxAccessTokenAvailable: false },
    }),
    mapboxAccessToken: '',
  }),
}));

vi.mock('@vis.gl/react-google-maps', () => ({
  Map: ({ children }: { children?: React.ReactNode }) => React.createElement('div', { 'data-testid': 'admin-airports-map' }, children),
  useMap: () => null,
}));

vi.mock('../../../components/AppDialogProvider', () => ({
  useAppDialog: () => ({
    confirm: mocks.confirm,
  }),
}));

vi.mock('../../../components/ui/appToast', () => ({
  showAppToast: mocks.showAppToast,
}));

vi.mock('../../../services/adminService', () => ({
  adminBulkUpdateAirportCatalogRecords: mocks.adminBulkUpdateAirportCatalogRecords,
  adminCreateAirportCatalogRecord: mocks.adminCreateAirportCatalogRecord,
  adminDeleteAirportCatalogRecords: mocks.adminDeleteAirportCatalogRecords,
  adminGetAirportCatalog: mocks.adminGetAirportCatalog,
  adminSyncAirportCatalog: mocks.adminSyncAirportCatalog,
  adminUpdateAirportCatalogRecord: mocks.adminUpdateAirportCatalogRecord,
}));

vi.mock('../../../services/nearbyAirportsService', () => ({
  fetchNearbyAirports: mocks.fetchNearbyAirports,
}));

vi.mock('../../../services/runtimeLocationService', () => ({
  ensureRuntimeLocationLoaded: mocks.ensureRuntimeLocationLoaded,
}));

vi.mock('../../../services/locationSearchService', () => ({
  reverseGeocodeCountry: mocks.reverseGeocodeCountry,
  searchCitySuggestions: vi.fn().mockResolvedValue([]),
  resolveCitySuggestion: vi.fn().mockResolvedValue(null),
}));

import { AdminAirportsPage } from '../../../pages/AdminAirportsPage';

const LocationSearchProbe: React.FC = () => {
  const location = useLocation();
  return React.createElement('output', { 'data-testid': 'location-search' }, location.search);
};

const renderAdminAirportsPage = (initialEntries: string[] = ['/admin/airports']) => (
  render(
    React.createElement(
      MemoryRouter,
      { initialEntries },
      React.createElement(React.Fragment, null,
        React.createElement(AdminAirportsPage),
        React.createElement(LocationSearchProbe),
      ),
    ),
  )
);

const buildAirport = (overrides?: Partial<Record<string, unknown>>) => ({
  ident: 'EDDB',
  iataCode: 'BER',
  icaoCode: 'EDDB',
  name: 'Berlin Brandenburg Airport',
  municipality: 'Berlin',
  subdivisionName: 'Berlin',
  regionCode: 'DE-BE',
  countryCode: 'DE',
  countryName: 'Germany',
  latitude: 52.362247,
  longitude: 13.500672,
  timezone: 'Europe/Berlin',
  airportType: 'large_airport',
  scheduledService: true,
  isCommercial: true,
  commercialServiceTier: 'major',
  isMajorCommercial: true,
  ...overrides,
});

describe('AdminAirportsPage', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    if (!Element.prototype.hasPointerCapture) {
      Object.defineProperty(Element.prototype, 'hasPointerCapture', {
        configurable: true,
        value: () => false,
      });
    }
    if (!Element.prototype.setPointerCapture) {
      Object.defineProperty(Element.prototype, 'setPointerCapture', {
        configurable: true,
        value: () => undefined,
      });
    }
    if (!Element.prototype.releasePointerCapture) {
      Object.defineProperty(Element.prototype, 'releasePointerCapture', {
        configurable: true,
        value: () => undefined,
      });
    }
    if (!Element.prototype.scrollIntoView) {
      Object.defineProperty(Element.prototype, 'scrollIntoView', {
        configurable: true,
        value: () => undefined,
      });
    }

    // The airport editor is a vaul sheet, which reads the computed CSS transform
    // on pointerup; jsdom computes none, so report "none" instead of undefined.
    const computeStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element: Element, pseudo?: string | null) => {
      const style = computeStyle(element, pseudo);
      if (!element.hasAttribute('data-vaul-drawer')) return style;
      return new Proxy(style, {
        get(target, property) {
          if (property === 'transform') return target.transform || 'none';
          const value = Reflect.get(target, property);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
    });

    vi.clearAllMocks();
    mocks.confirm.mockResolvedValue(true);
    mocks.adminBulkUpdateAirportCatalogRecords.mockResolvedValue([
      buildAirport({
        ident: 'EDDH',
        iataCode: 'HAM',
        icaoCode: 'EDDH',
        name: 'Hamburg Airport',
        municipality: 'Hamburg',
        subdivisionName: 'Hamburg',
        regionCode: 'DE-HH',
        latitude: 53.630402,
        longitude: 9.988228,
        airportType: 'small_airport',
        scheduledService: false,
        isCommercial: false,
        commercialServiceTier: 'local',
        isMajorCommercial: false,
      }),
    ]);
    mocks.adminGetAirportCatalog.mockResolvedValue({
      source: 'database',
      databaseAvailable: true,
      airports: [
        buildAirport(),
        buildAirport({
          ident: 'EDDH',
          iataCode: 'HAM',
          icaoCode: 'EDDH',
          name: 'Hamburg Airport',
          municipality: 'Hamburg',
          subdivisionName: 'Hamburg',
          regionCode: 'DE-HH',
          latitude: 53.630402,
          longitude: 9.988228,
        }),
      ],
      metadata: {
        dataVersion: '2026-03-21-4086',
        generatedAt: '2026-03-21T16:45:00.000Z',
        commercialAirportCount: 4086,
        sourceAirportCount: 84934,
        sources: {
          primary: 'primary',
          mirror: 'mirror',
          enrichment: 'enrichment',
        },
        syncedAt: '2026-03-21T17:00:00.000Z',
        syncedBy: 'admin-user',
      },
    });
    mocks.ensureRuntimeLocationLoaded.mockResolvedValue({
      loading: false,
      available: true,
      source: 'netlify-context',
      fetchedAt: '2026-03-21T18:00:00.000Z',
      location: {
        city: 'Berlin',
        countryCode: 'DE',
        countryName: 'Germany',
        subdivisionCode: 'BE',
        subdivisionName: 'Berlin',
        latitude: 52.52,
        longitude: 13.405,
        timezone: 'Europe/Berlin',
        postalCode: '10115',
      },
    });
    mocks.fetchNearbyAirports.mockResolvedValue({
      origin: { lat: 52.52, lng: 13.405 },
      dataVersion: '2026-03-21-4086',
      airports: [
        {
          airport: buildAirport(),
          airDistanceKm: 18.9,
          rank: 1,
        },
      ],
    });
    mocks.reverseGeocodeCountry.mockResolvedValue({ code: 'DE', name: 'Germany' });
    mocks.adminCreateAirportCatalogRecord.mockImplementation(async (airport) => airport);
    mocks.adminDeleteAirportCatalogRecords.mockResolvedValue(['EDDH']);
    mocks.adminUpdateAirportCatalogRecord.mockImplementation(async (airport) => airport);
    mocks.adminSyncAirportCatalog.mockResolvedValue({
      source: 'database',
      databaseAvailable: true,
      airports: [buildAirport()],
      metadata: {
        dataVersion: '2026-03-21-4086',
        generatedAt: '2026-03-21T16:45:00.000Z',
        commercialAirportCount: 4086,
        sourceAirportCount: 84934,
        sources: {
          primary: 'primary',
          mirror: 'mirror',
          enrichment: 'enrichment',
        },
        syncedAt: '2026-03-21T17:00:00.000Z',
        syncedBy: 'admin-user',
      },
    });
  });

  it('loads the airport catalog and lets admins save an edited row', async () => {
    const user = userEvent.setup();
    renderAdminAirportsPage();

    expect(await screen.findByRole('tab', { name: /Catalog/ })).toHaveAttribute('aria-selected', 'true');
    await user.click(await screen.findByRole('row', { name: /Hamburg Airport\s+HAM · EDDH/i }));
    await waitFor(() => {
      expect(screen.getByDisplayValue('Hamburg Airport')).toBeInTheDocument();
    });

    const airportNameInput = screen.getByDisplayValue('Hamburg Airport');
    await user.clear(airportNameInput);
    await user.type(airportNameInput, 'Hamburg International');

    await user.click(screen.getByRole('button', { name: 'Save airport' }));

    await waitFor(() => {
      expect(mocks.adminUpdateAirportCatalogRecord).toHaveBeenCalledWith(expect.objectContaining({
        ident: 'EDDH',
        name: 'Hamburg International',
        commercialServiceTier: 'major',
        isMajorCommercial: true,
      }));
    });
  }, 30000);

  it('creates a new airport row from the admin editor', async () => {
    const user = userEvent.setup();
    renderAdminAirportsPage();

    expect(await screen.findByText('Berlin Brandenburg Airport')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'New airport' }));

    await user.type(screen.getByLabelText('Ident'), 'EDDM');
    await user.type(screen.getByLabelText('IATA code'), 'MUC');
    await user.type(screen.getByLabelText('ICAO code'), 'EDDM');
    await user.type(screen.getByLabelText('Airport name'), 'Munich Airport');
    await user.type(screen.getByLabelText('Municipality'), 'Munich');
    await user.click(screen.getByLabelText('Country or region'));
    await user.type(screen.getByLabelText('Country or region'), 'Germany');
    await user.click(await screen.findByRole('option', { name: 'Germany' }));
    await user.clear(screen.getByLabelText('Latitude', { selector: 'input#admin-airports-editor-latitude' }));
    await user.type(screen.getByLabelText('Latitude', { selector: 'input#admin-airports-editor-latitude' }), '48.3538');
    await user.clear(screen.getByLabelText('Longitude', { selector: 'input#admin-airports-editor-longitude' }));
    await user.type(screen.getByLabelText('Longitude', { selector: 'input#admin-airports-editor-longitude' }), '11.7861');

    await user.click(screen.getByRole('button', { name: 'Create airport' }));

    await waitFor(() => {
      expect(mocks.adminCreateAirportCatalogRecord).toHaveBeenCalledWith(expect.objectContaining({
        ident: 'EDDM',
        iataCode: 'MUC',
        icaoCode: 'EDDM',
        name: 'Munich Airport',
        countryCode: 'DE',
        commercialServiceTier: 'regional',
        isCommercial: true,
      }));
    });
  }, 30000);

  it('triggers the upstream sync action from the page', async () => {
    const user = userEvent.setup();
    renderAdminAirportsPage();

    await screen.findByText('Berlin Brandenburg Airport');
    await user.click(screen.getByRole('button', { name: 'More catalog actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Sync from upstream' }));

    await waitFor(() => {
      expect(mocks.confirm).toHaveBeenCalled();
      expect(mocks.adminSyncAirportCatalog).toHaveBeenCalledTimes(1);
    });
    // The progress toast stays until the result replaces it, instead of
    // expiring after the default few seconds mid-sync.
    expect(mocks.showAppToast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Syncing airports',
      // The loading tone stays up until the result toast replaces it (appToast: loading => Infinity).
      tone: 'loading',
    }));
    expect(mocks.showAppToast).toHaveBeenCalledWith(expect.objectContaining({
      id: 'toast-id',
      title: 'Airport sync finished',
    }));
  });

  it('applies bulk edits to selected airports', async () => {
    const user = userEvent.setup();
    renderAdminAirportsPage();

    await user.click(await screen.findByRole('checkbox', { name: 'Select Hamburg Airport' }));
    await user.click(screen.getByRole('button', { name: 'Bulk edit' }));
    expect(await screen.findByRole('dialog', { name: 'Bulk edit 1 airport' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply bulk edit' })).toBeDisabled();
    await user.click(screen.getByRole('combobox', { name: 'Scheduled service' }));
    await user.click(await screen.findByRole('option', { name: 'Set scheduled service off' }));
    await user.click(screen.getByRole('combobox', { name: 'Airport type' }));
    await user.click(await screen.findByRole('option', { name: 'Set to small airport' }));

    await user.click(screen.getByRole('button', { name: 'Apply bulk edit' }));

    await waitFor(() => {
      expect(mocks.adminBulkUpdateAirportCatalogRecords).toHaveBeenCalledWith({
        idents: ['EDDH'],
        patch: {
          airportType: 'small_airport',
          scheduledService: false,
        },
      });
    });
  }, 30000);

  it('deletes selected airport rows from the bulk editor', async () => {
    const user = userEvent.setup();
    renderAdminAirportsPage();

    await user.click(await screen.findByRole('checkbox', { name: 'Select Hamburg Airport' }));
    await user.click(screen.getByRole('button', { name: 'Delete selected' }));

    await waitFor(() => {
      expect(mocks.adminDeleteAirportCatalogRecords).toHaveBeenCalledWith(['EDDH']);
    });
  });

  it('renders a fake ticket preview from the nearby-airport lookup', async () => {
    const user = userEvent.setup();
    renderAdminAirportsPage([
      '/admin/airports?nearbyCity=Berlin%2C%20Germany&nearbyLat=52.52&nearbyLng=13.405',
    ]);

    expect(await screen.findByRole('button', { name: 'Lookup nearby airports' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Lookup nearby airports' }));
    await waitFor(() => expect(mocks.fetchNearbyAirports).toHaveBeenCalled());
    await user.click(screen.getByRole('tab', { name: 'Ticket lab' }));

    expect(await screen.findByText('Digital Boarding Pass')).toBeInTheDocument();
    expect(screen.getByText('Horizontal style')).toBeInTheDocument();
    expect(screen.getAllByText('Vertical style').length).toBeGreaterThan(0);
    expect(screen.getAllByText('TravelFlow Air').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Alex Morgan').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Berlin Brandenburg Airport').length).toBeGreaterThan(0);
    expect(screen.getAllByAltText('TravelFlow QR code').length).toBeGreaterThan(0);
  });

  it('renders a BER testing fallback before nearby-airport data arrives', async () => {
    mocks.fetchNearbyAirports.mockImplementation(() => new Promise(() => undefined));
    renderAdminAirportsPage(['/admin/airports?tab=ticket']);

    expect(await screen.findByText('Testing fallback active')).toBeInTheDocument();
    expect(screen.getByText('Using Berlin Brandenburg Airport (BER) as the default ticket departure until you run a nearby-airport lookup.')).toBeInTheDocument();
    expect(screen.getByText('Digital Boarding Pass')).toBeInTheDocument();
    expect(screen.getAllByText('Berlin Brandenburg Airport').length).toBeGreaterThan(0);
  });

  it('reruns the nearby-airport lookup when same-country filtering is enabled', async () => {
    const user = userEvent.setup();
    mocks.fetchNearbyAirports
      .mockResolvedValueOnce({
        origin: { lat: 52.52, lng: 13.405 },
        dataVersion: '2026-03-21-4086',
        airports: [
          {
            airport: buildAirport(),
            airDistanceKm: 18.9,
            rank: 1,
          },
          {
            airport: buildAirport({
              ident: 'LFPG',
              iataCode: 'CDG',
              icaoCode: 'LFPG',
              name: 'Paris Charles de Gaulle Airport',
              municipality: 'Paris',
              subdivisionName: 'Ile-de-France',
              regionCode: 'FR-IDF',
              countryCode: 'FR',
              countryName: 'France',
              latitude: 49.0097,
              longitude: 2.5479,
            }),
            airDistanceKm: 850.2,
            rank: 2,
          },
        ],
      })
      .mockResolvedValueOnce({
        origin: { lat: 52.52, lng: 13.405 },
        dataVersion: '2026-03-21-4086',
        airports: [
          {
            airport: buildAirport(),
            airDistanceKm: 18.9,
            rank: 1,
          },
        ],
      });
    renderAdminAirportsPage([
      '/admin/airports?nearbyCity=Berlin%2C%20Germany&nearbyLat=52.52&nearbyLng=13.405',
    ]);

    expect(await screen.findByRole('button', { name: 'Lookup nearby airports' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Lookup nearby airports' }));
    await waitFor(() => {
      expect(mocks.fetchNearbyAirports).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole('switch', { name: 'Same-country only' }));

    await waitFor(() => {
      expect(mocks.fetchNearbyAirports).toHaveBeenNthCalledWith(2, expect.objectContaining({
        countryCode: 'DE',
      }));
    });
    expect(screen.getByTestId('location-search').textContent).toContain('nearbySameCountry=1');
  });

  it('renders resize handles for the airport table columns', async () => {
    renderAdminAirportsPage();

    expect(await screen.findByLabelText('Resize airport column')).toBeInTheDocument();
    expect(screen.getByLabelText('Resize location column')).toBeInTheDocument();
    expect(screen.getByLabelText('Resize timezone column')).toBeInTheDocument();
  });

  it('defaults the nearby-airport tester to runtime location and major-only lookups', async () => {
    renderAdminAirportsPage(['/admin/airports?tab=tester']);

    expect(await screen.findByDisplayValue('Berlin, Germany')).toBeInTheDocument();
    expect(screen.getByDisplayValue('52.52')).toBeInTheDocument();
    expect(screen.getByDisplayValue('13.405')).toBeInTheDocument();
    expect(screen.getByText('Large airports used for big commercial traffic.')).toBeInTheDocument();
    await waitFor(() => {
      expect(mocks.ensureRuntimeLocationLoaded).toHaveBeenCalledTimes(1);
      expect(mocks.fetchNearbyAirports).toHaveBeenCalledWith(expect.objectContaining({
        lat: 52.52,
        lng: 13.405,
        minimumServiceTier: 'major',
      }));
    });
    await waitFor(() => {
      expect(screen.getByTestId('location-search').textContent).toContain('nearbyCity=Berlin');
      expect(screen.getByTestId('location-search').textContent).toContain('nearbyLookup=1');
    });
  });

  it('does not auto-retry a failed restored nearby-airport lookup until the user retries manually', async () => {
    const user = userEvent.setup();
    mocks.fetchNearbyAirports
      .mockRejectedValueOnce(new Error('Nearby airports request failed with 500.'))
      .mockResolvedValueOnce({
        origin: { lat: 52.52, lng: 13.405 },
        dataVersion: '2026-03-21-4086',
        airports: [
          {
            airport: buildAirport(),
            airDistanceKm: 18.9,
            rank: 1,
          },
        ],
      });

    renderAdminAirportsPage(['/admin/airports?tab=tester']);

    expect(await screen.findByText('Nearby airports request failed with 500.')).toBeInTheDocument();
    await new Promise((resolve) => window.setTimeout(resolve, 50));
    expect(mocks.fetchNearbyAirports).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Nearest airports')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Lookup nearby airports' }));

    await waitFor(() => {
      expect(mocks.fetchNearbyAirports).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText('Nearest airports')).toBeInTheDocument();
  });

  it('persists airport filters in the URL and restores nearby lookups on refresh', async () => {
    renderAdminAirportsPage([
      '/admin/airports?country=DE&catalogTier=major&nearbyCity=Berlin%2C%20Germany&nearbyLat=52.52&nearbyLng=13.405&nearbyLimit=3&nearbySameCountry=1&nearbyLookup=1',
    ]);

    expect(await screen.findByDisplayValue('Germany')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Berlin, Germany')).toBeInTheDocument();
    expect(screen.getByDisplayValue('52.52')).toBeInTheDocument();
    expect(screen.getByDisplayValue('13.405')).toBeInTheDocument();
    expect(screen.getByText('Large airports used for big commercial traffic.')).toBeInTheDocument();
    await waitFor(() => {
      expect(mocks.fetchNearbyAirports).toHaveBeenCalledWith(expect.objectContaining({
        lat: 52.52,
        lng: 13.405,
        minimumServiceTier: 'major',
      }));
    });
    expect(screen.getByTestId('location-search').textContent).toContain('country=DE');
    expect(screen.getByTestId('location-search').textContent).toContain('catalogTier=major');
    expect(screen.getByTestId('location-search').textContent).toContain('nearbySameCountry=1');
    expect(screen.getByTestId('location-search').textContent).toContain('nearbyLookup=1');
    // Older links without `tab` open the tester they were pointing at, and the
    // tab is written back so the link stays unambiguous.
    expect(screen.getByRole('tab', { name: 'Nearby tester' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('location-search').textContent).toContain('tab=tester');
  });

  it('opens on the catalog without loading the tester, its location or its lookup', async () => {
    const user = userEvent.setup();
    renderAdminAirportsPage();

    expect(await screen.findByText('Hamburg Airport')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lookup nearby airports' })).not.toBeInTheDocument();
    expect(mocks.ensureRuntimeLocationLoaded).not.toHaveBeenCalled();
    expect(mocks.fetchNearbyAirports).not.toHaveBeenCalled();

    await user.click(screen.getByRole('tab', { name: 'Nearby tester' }));

    expect(await screen.findByRole('button', { name: 'Lookup nearby airports' })).toBeInTheDocument();
    await waitFor(() => expect(mocks.ensureRuntimeLocationLoaded).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('location-search').textContent).toContain('tab=tester');
  });

  it('shows bulk actions only while airports are selected', async () => {
    const user = userEvent.setup();
    renderAdminAirportsPage();

    await screen.findByText('Hamburg Airport');
    expect(screen.queryByRole('region', { name: 'Bulk actions' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete selected' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Select Hamburg Airport' }));
    expect(screen.getByRole('region', { name: 'Bulk actions' })).toHaveTextContent('1 airport selected');

    await user.click(screen.getByRole('button', { name: /Select all 2 matching/ }));
    expect(screen.getByRole('region', { name: 'Bulk actions' })).toHaveTextContent('2 airports selected');

    await user.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(screen.queryByRole('region', { name: 'Bulk actions' })).not.toBeInTheDocument();
  });

  it('deletes one airport from its row menu', async () => {
    const user = userEvent.setup();
    renderAdminAirportsPage();

    await user.click(await screen.findByRole('button', { name: 'Actions for Hamburg Airport' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete airport' }));

    await waitFor(() => {
      expect(mocks.adminDeleteAirportCatalogRecords).toHaveBeenCalledWith(['EDDH']);
    });
  });

  it('opens the airport named in the URL and records the open airport', async () => {
    renderAdminAirportsPage(['/admin/airports?airport=EDDH']);

    expect(await screen.findByDisplayValue('Hamburg Airport')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveTextContent('HAM · EDDH');
    expect(screen.getByTestId('location-search').textContent).toContain('airport=EDDH');
  });

  it('turns editing off and offers a sync while the catalog is a snapshot', async () => {
    const user = userEvent.setup();
    mocks.adminGetAirportCatalog.mockResolvedValueOnce({
      ...(await mocks.adminGetAirportCatalog()),
      source: 'snapshot',
      databaseAvailable: true,
    });
    renderAdminAirportsPage();

    expect(await screen.findByText('Edits are off until the database catalog is synced')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Select Hamburg Airport' }));
    expect(screen.getByRole('button', { name: 'Bulk edit' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete selected' })).toBeDisabled();
  });
});
