// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loadSettings: vi.fn<() => Promise<unknown>>(),
}));

vi.mock('../../services/aiRuntimeSettingsService', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, loadPublicAiRuntimeSettings: mocks.loadSettings };
});

import {
  GoogleMapsLoader,
  useGoogleMaps,
  useMapRuntime,
} from '../../components/GoogleMapsLoader';
import { MAP_PRESET_SETTLE_TIMEOUT_MS } from '../../components/MapRuntimeProvider';
import {
  resetMapRendererChoiceForTests,
  setMapRendererChoice,
  setRuntimeMapPreset,
} from '../../services/mapRuntimeService';

type Probe = {
  google: ReturnType<typeof useGoogleMaps>;
  runtime: ReturnType<typeof useMapRuntime>;
};
let latest: Probe | null = null;

const ProbeChild: React.FC = () => {
  latest = { google: useGoogleMaps(), runtime: useMapRuntime() };
  return null;
};

const renderLoader = () => render(
  React.createElement(GoogleMapsLoader, null, React.createElement(ProbeChild)),
);

const googleScripts = () => document.querySelectorAll('script[src*="maps.googleapis.com"]');

describe('MapRuntimeProvider without Google', () => {
  beforeEach(() => {
    latest = null;
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', `AIzaBAD${'x'.repeat(32)}`);
    vi.stubEnv('VITE_MAPBOX_ACCESS_TOKEN', 'pk.test-token');
    vi.stubEnv('VITE_MAP_RUNTIME_PRESET', 'mapbox_all');
    mocks.loadSettings.mockReset();
    mocks.loadSettings.mockResolvedValue({});
    resetMapRendererChoiceForTests();
    setRuntimeMapPreset(null);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.useRealTimers();
    document.querySelectorAll('script[src*="maps.googleapis.com"]').forEach((node) => node.remove());
    delete (window as { gm_authFailure?: unknown }).gm_authFailure;
  });

  it('mapbox_all loads no Google script and reports no load error', async () => {
    renderLoader();
    await act(async () => { await Promise.resolve(); });

    expect(googleScripts()).toHaveLength(0);
    expect(latest?.google).toEqual({ isLoaded: false, loadError: null, disabled: true });
    expect((window as { gm_authFailure?: unknown }).gm_authFailure).toBeUndefined();
  });

  it('a saved google renderer choice is ignored under mapbox_all', async () => {
    setMapRendererChoice('google');
    renderLoader();
    await act(async () => { await Promise.resolve(); });

    expect(latest?.runtime.runtime.effectiveSelection.renderer).toBe('mapbox');
    expect(latest?.runtime.rendererLocked).toBe(true);
    expect(googleScripts()).toHaveLength(0);
  });

  it('switching the admin preset re-resolves without a reload', async () => {
    vi.stubEnv('VITE_MAP_RUNTIME_PRESET', 'google_all');
    // Pending, so the shared Google script loader is never started by this test.
    mocks.loadSettings.mockReturnValue(new Promise(() => {}));
    renderLoader();
    await act(async () => { await Promise.resolve(); });
    expect(latest?.google.disabled).toBe(false);

    act(() => { setRuntimeMapPreset('mapbox_all'); });

    expect(latest?.google.disabled).toBe(true);
    expect(latest?.runtime.rendererLocked).toBe(true);
  });

  it('presetSettled turns true after the timeout when settings never answer', () => {
    vi.useFakeTimers();
    mocks.loadSettings.mockReturnValue(new Promise(() => {}));
    renderLoader();
    expect(latest?.runtime.presetSettled).toBe(false);

    act(() => { vi.advanceTimersByTime(MAP_PRESET_SETTLE_TIMEOUT_MS); });

    expect(latest?.runtime.presetSettled).toBe(true);
  });

  it('presetSettled turns true when the settings load rejects', async () => {
    mocks.loadSettings.mockRejectedValue(new Error('boom'));
    renderLoader();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(latest?.runtime.presetSettled).toBe(true);
  });

  it('mounts no Google script until the admin preset is known', async () => {
    vi.stubEnv('VITE_MAP_RUNTIME_PRESET', 'google_all');
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', `AIza${'A'.repeat(35)}`);
    let resolveSettings: (value: unknown) => void = () => {};
    mocks.loadSettings.mockReturnValue(new Promise((resolve) => { resolveSettings = resolve; }));

    renderLoader();
    await act(async () => { await Promise.resolve(); });
    expect(googleScripts()).toHaveLength(0);
    expect(latest?.runtime.presetSettled).toBe(false);

    await act(async () => {
      resolveSettings({});
      await Promise.resolve();
    });

    expect(latest?.runtime.presetSettled).toBe(true);
    expect(googleScripts().length).toBeGreaterThan(0);
  });
});
