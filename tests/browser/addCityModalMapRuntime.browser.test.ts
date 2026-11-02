// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loadSettings: vi.fn<() => Promise<unknown>>(),
}));

vi.mock('../../services/aiRuntimeSettingsService', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, loadPublicAiRuntimeSettings: mocks.loadSettings };
});

import { AddCityModal } from '../../components/AddCityModal';
import { MapRuntimeProvider } from '../../components/GoogleMapsLoader';
import {
  resetMapRendererChoiceForTests,
  setRuntimeMapPreset,
} from '../../services/mapRuntimeService';

describe('AddCityModal under the map runtime provider', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', `AIzaBAD${'x'.repeat(32)}`);
    vi.stubEnv('VITE_MAPBOX_ACCESS_TOKEN', 'pk.test-token');
    vi.stubEnv('VITE_MAP_RUNTIME_PRESET', 'google_all');
    // Pending, so the shared Google script loader is never started.
    mocks.loadSettings.mockReturnValue(new Promise(() => {}));
    resetMapRendererChoiceForTests();
    setRuntimeMapPreset(null);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ features: [] }),
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    setRuntimeMapPreset(null);
    document.querySelectorAll('script[src*="maps.googleapis.com"]').forEach((node) => node.remove());
  });

  it('becomes ready when the admin preset switches to mapbox_all after mount', async () => {
    render(React.createElement(
      MapRuntimeProvider,
      null,
      React.createElement(AddCityModal, { isOpen: true, onAdd: vi.fn(), onClose: vi.fn() }),
    ));
    await act(async () => { await Promise.resolve(); });

    expect(screen.getByText('Loading Map services…')).toBeInTheDocument();

    await act(async () => { setRuntimeMapPreset('mapbox_all'); });

    expect(screen.queryByText('Loading Map services…')).not.toBeInTheDocument();
    expect(screen.getByText('Start typing to search and select a city suggestion.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search City'), { target: { value: 'Kapstadt' } });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 300)); });
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).startsWith('https://api.mapbox.com/'))).toBe(true);
  });
});
