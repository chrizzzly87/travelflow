// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { makeActivityItem, makeCityItem } from '../helpers/tripFixtures';

const mocks = vi.hoisted(() => ({
  loadSettings: vi.fn<() => Promise<unknown>>(),
}));

vi.mock('../../services/aiRuntimeSettingsService', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, loadPublicAiRuntimeSettings: mocks.loadSettings };
});

vi.mock('../../components/AppDialogProvider', () => ({
  useAppDialog: () => ({ confirm: vi.fn(async () => false), prompt: vi.fn(async () => null) }),
}));

vi.mock('../../services/analyticsService', () => ({
  trackEvent: vi.fn(),
  getAnalyticsDebugAttributes: () => ({}),
}));

import { DetailsPanel } from '../../components/DetailsPanel';
import { MapRuntimeProvider } from '../../components/GoogleMapsLoader';
import {
  resetMapRendererChoiceForTests,
  setRuntimeMapPreset,
} from '../../services/mapRuntimeService';

const NOTICE = 'Place search is unavailable right now.';

describe('components/DetailsPanel with place search off (mapbox_all)', () => {
  const city = makeCityItem({ id: 'city-1', title: 'Kyoto', startDateOffset: 0, duration: 3 });
  const activity = makeActivityItem('activity-1', 'Kyoto', 1);
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', `AIzaBAD${'x'.repeat(32)}`);
    vi.stubEnv('VITE_MAPBOX_ACCESS_TOKEN', 'pk.test-token');
    vi.stubEnv('VITE_MAP_RUNTIME_PRESET', 'mapbox_all');
    mocks.loadSettings.mockReturnValue(new Promise(() => {}));
    resetMapRendererChoiceForTests();
    setRuntimeMapPreset('mapbox_all');
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ features: [] }) });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    setRuntimeMapPreset(null);
  });

  const renderPanel = (item: typeof city) => render(
    <MapRuntimeProvider>
      <DetailsPanel
        item={item}
        isOpen
        onClose={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        tripStartDate="2026-03-10"
        tripItems={[city, activity]}
        variant="sidebar"
      />
    </MapRuntimeProvider>,
  );

  it('activity and hotel search show the unavailable notice under mapbox_all', async () => {
    renderPanel(activity);
    await act(async () => { await Promise.resolve(); });

    fireEvent.click(screen.getByRole('button', { name: 'Edit location' }));
    expect(screen.getByText(NOTICE)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search location'), { target: { value: 'Fushimi Inari' } });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 400)); });
    expect(screen.queryByText('Searching places…')).not.toBeInTheDocument();
    expect(screen.getByText(NOTICE)).toBeInTheDocument();

    cleanup();
    renderPanel(city);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText(NOTICE)).toBeInTheDocument();
    expect(screen.queryByLabelText('Search hotels')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Find' })).not.toBeInTheDocument();
  });

  it('does not offer "Search with Google Places" when search is not Google', async () => {
    renderPanel(activity);
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole('button', { name: 'Edit location' }));
    expect(screen.queryByText('Search with Google Places')).not.toBeInTheDocument();

    cleanup();
    renderPanel(city);
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByTitle('Edit city'));
    expect(screen.queryByText('Search with Google Places')).not.toBeInTheDocument();
  });

  it('shows "Search with Google Places" when Google is the search provider', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', `AIza${'x'.repeat(35)}`);
    vi.stubEnv('VITE_MAP_RUNTIME_PRESET', 'google_all');
    setRuntimeMapPreset('google_all');
    renderPanel(activity);
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole('button', { name: 'Edit location' }));
    expect(screen.getByText('Search with Google Places')).toBeInTheDocument();
  });

  it('the city search uses the Mapbox city lookup instead of waiting on Google', async () => {
    renderPanel(city);
    await act(async () => { await Promise.resolve(); });

    fireEvent.click(screen.getByTitle('Edit city'));
    fireEvent.change(screen.getByLabelText('Search city'), { target: { value: 'Osaka' } });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 400)); });

    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls.some((url) => url.includes('mapbox.com'))).toBe(true);
    expect(urls.some((url) => url.includes('googleapis.com'))).toBe(false);
  });
});
