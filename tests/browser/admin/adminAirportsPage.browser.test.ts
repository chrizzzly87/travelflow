// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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
  AdminShell: ({ title, description, actions, children }: { title: string; description?: string; actions?: React.ReactNode; children: React.ReactNode }) => (
    React.createElement(
      'section',
      null,
      React.createElement('h1', null, title),
      description ? React.createElement('p', null, description) : null,
      actions,
      children,
    )
  ),
}));

vi.mock('../../../components/GoogleMapsLoader', () => ({
  GoogleMapsLoader: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  useGoogleMaps: () => ({ isLoaded: true, loadError: null }),
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
    render(React.createElement(AdminAirportsPage));

    expect(await screen.findByText('Airport Catalog')).toBeInTheDocument();
    expect(await screen.findByDisplayValue('Berlin Brandenburg Airport')).toBeInTheDocument();

    await user.click(screen.getByText('Hamburg Airport'));
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
  });

  it('creates a new airport row from the admin editor', async () => {
    const user = userEvent.setup();
    render(React.createElement(AdminAirportsPage));

    expect(await screen.findByDisplayValue('Berlin Brandenburg Airport')).toBeInTheDocument();
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
  });

  it('triggers the upstream sync action from the page', async () => {
    const user = userEvent.setup();
    render(React.createElement(AdminAirportsPage));

    expect(await screen.findByRole('button', { name: 'Sync from upstream' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sync from upstream' }));

    await waitFor(() => {
      expect(mocks.confirm).toHaveBeenCalled();
      expect(mocks.adminSyncAirportCatalog).toHaveBeenCalledTimes(1);
    });
  });

  it('applies bulk edits to selected airports', async () => {
    const user = userEvent.setup();
    render(React.createElement(AdminAirportsPage));

    expect(await screen.findByRole('button', { name: 'Apply bulk edit' })).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Select Hamburg Airport' }));
    await user.click(screen.getByRole('combobox', { name: 'Scheduled Service' }));
    await user.click(await screen.findByRole('option', { name: 'Set scheduled service off' }));
    await user.click(screen.getAllByRole('combobox', { name: 'Airport Type' })[0]);
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
  });

  it('deletes selected airport rows from the bulk editor', async () => {
    const user = userEvent.setup();
    render(React.createElement(AdminAirportsPage));

    expect(await screen.findByRole('button', { name: 'Delete selected' })).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Select Hamburg Airport' }));
    await user.click(screen.getByRole('button', { name: 'Delete selected' }));

    await waitFor(() => {
      expect(mocks.adminDeleteAirportCatalogRecords).toHaveBeenCalledWith(['EDDH']);
    });
  });

  it('renders a fake ticket preview from the nearby-airport lookup', async () => {
    const user = userEvent.setup();
    render(React.createElement(AdminAirportsPage));

    expect(await screen.findByRole('button', { name: 'Lookup nearby airports' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Use runtime location' }));
    await user.click(screen.getByRole('button', { name: 'Lookup nearby airports' }));

    expect(await screen.findByText('Digital Boarding Pass')).toBeInTheDocument();
    expect(screen.getByText('TravelFlow Air')).toBeInTheDocument();
    expect(screen.getByText('Alex Morgan')).toBeInTheDocument();
    expect(screen.getAllByText('Berlin Brandenburg Airport').length).toBeGreaterThan(0);
  });

  it('passes the same-country filter through to the nearby-airports lookup', async () => {
    const user = userEvent.setup();
    render(React.createElement(AdminAirportsPage));

    expect(await screen.findByRole('button', { name: 'Lookup nearby airports' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Use runtime location' }));
    await user.click(screen.getByRole('switch', { name: 'Same-country only' }));
    await user.click(screen.getByRole('button', { name: 'Lookup nearby airports' }));

    await waitFor(() => {
      expect(mocks.fetchNearbyAirports).toHaveBeenCalledWith(expect.objectContaining({
        countryCode: 'DE',
      }));
    });
  });

  it('renders resize handles for the airport table columns', async () => {
    render(React.createElement(AdminAirportsPage));

    expect(await screen.findByLabelText('Resize code column')).toBeInTheDocument();
    expect(screen.getByLabelText('Resize airport column')).toBeInTheDocument();
    expect(screen.getByLabelText('Resize timezone column')).toBeInTheDocument();
  });
});
