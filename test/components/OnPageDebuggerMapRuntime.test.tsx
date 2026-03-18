// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OnPageDebugger, buildMapRuntimeDebugOverride } from '../../components/OnPageDebugger';
import { useAuth } from '../../hooks/useAuth';
import {
  applyMapRuntimeAdminOverride,
  getClientMapRuntimeResolution,
} from '../../services/mapRuntimeService';
import type { MapRuntimeResolution } from '../../shared/mapRuntime';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../services/mapRuntimeService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/mapRuntimeService')>();
  return {
    ...actual,
    applyMapRuntimeAdminOverride: vi.fn(),
    getClientMapRuntimeResolution: vi.fn(),
  };
});

const mockedUseAuth = vi.mocked(useAuth);
const mockedApplyMapRuntimeAdminOverride = vi.mocked(applyMapRuntimeAdminOverride);
const mockedGetClientMapRuntimeResolution = vi.mocked(getClientMapRuntimeResolution);

const buildRuntimeResolution = (): MapRuntimeResolution => ({
  defaultPreset: 'google_all',
  requestedPreset: 'google_all',
  requestedSelection: {
    renderer: 'google',
    routes: 'google',
    locationSearch: 'google',
    staticMaps: 'google',
  },
  effectiveSelection: {
    renderer: 'google',
    routes: 'google',
    locationSearch: 'google',
    staticMaps: 'google',
  },
  effectivePresetMatch: 'google_all',
  override: null,
  overrideSource: 'default',
  warnings: [],
  availability: {
    googleMapsKeyAvailable: true,
    mapboxAccessTokenAvailable: true,
  },
  activeSelectionKey: 'gggg',
  implementationCapabilities: {
    google: {
      renderer: true,
      routes: true,
      locationSearch: true,
      staticMaps: true,
    },
    mapbox: {
      renderer: true,
      routes: false,
      locationSearch: false,
      staticMaps: true,
    },
  },
});

const renderOpenedDebugger = async (): Promise<void> => {
  render(
    <MemoryRouter>
      <OnPageDebugger />
    </MemoryRouter>,
  );

  await waitFor(() => {
    expect(window.debug).toBeTypeOf('function');
  });

  await act(async () => {
    window.debug?.(true);
  });
};

describe('components/OnPageDebugger map runtime controls', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockedApplyMapRuntimeAdminOverride.mockReset();
    mockedGetClientMapRuntimeResolution.mockReset();
    mockedGetClientMapRuntimeResolution.mockReturnValue(buildRuntimeResolution());
    mockedUseAuth.mockReset();
    mockedUseAuth.mockReturnValue({ isAdmin: false, isLoading: false } as ReturnType<typeof useAuth>);

    if (!window.matchMedia) {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: false,
          media: query,
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          addListener: vi.fn(),
          removeListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
    }
  });

  it('builds compact runtime overrides for preset and subsystem commands', () => {
    const runtime = buildRuntimeResolution();

    expect(buildMapRuntimeDebugOverride({ preset: 'mapbox_visuals' }, runtime)).toEqual({
      preset: 'mapbox_visual_google_services',
    });

    expect(buildMapRuntimeDebugOverride({ staticMaps: 'mapbox' }, runtime)).toEqual({
      selection: {
        staticMaps: 'mapbox',
      },
    });

    expect(buildMapRuntimeDebugOverride({ preset: 'default' }, {
      ...runtime,
      override: { preset: 'mapbox_visual_google_services' },
      requestedPreset: 'mapbox_visual_google_services',
      requestedSelection: {
        renderer: 'mapbox',
        routes: 'google',
        locationSearch: 'google',
        staticMaps: 'mapbox',
      },
    })).toBeNull();
  });

  it('hides admin-only runtime controls for non-admin sessions', async () => {
    await renderOpenedDebugger();

    expect(screen.queryByRole('button', { name: 'Maps' })).not.toBeInTheDocument();
    expect(screen.queryByText('Map Runtime')).not.toBeInTheDocument();
  });

  it('shows admin runtime controls and applies preset overrides through the shared service', async () => {
    mockedUseAuth.mockReturnValue({ isAdmin: true, isLoading: false } as ReturnType<typeof useAuth>);

    await renderOpenedDebugger();

    fireEvent.click(screen.getByRole('button', { name: 'Maps' }));
    expect(screen.getByText('Map Runtime')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Force Mapbox Visuals' }));

    expect(mockedApplyMapRuntimeAdminOverride).toHaveBeenCalledWith({
      preset: 'mapbox_visual_google_services',
    });
  });

  it('restores the maps tab when it was the last persisted debugger workspace', async () => {
    mockedUseAuth.mockReturnValue({ isAdmin: true, isLoading: false } as ReturnType<typeof useAuth>);
    window.localStorage.setItem('tf_debug_open', '1');
    window.localStorage.setItem('tf_debug_active_tab', 'maps');

    render(
      <MemoryRouter>
        <OnPageDebugger />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen
          .getAllByRole('button', { name: 'Maps' })
          .some((button) => button.className.includes('border-slate-900')),
      ).toBe(true);
    });

    expect(screen.getAllByText('Map Runtime').length).toBeGreaterThan(0);
  });

  it('keeps the persisted maps tab until admin auth finishes resolving', async () => {
    let authState = { isAdmin: false, isLoading: true };
    mockedUseAuth.mockImplementation(() => authState as ReturnType<typeof useAuth>);
    window.localStorage.setItem('tf_debug_open', '1');
    window.localStorage.setItem('tf_debug_active_tab', 'maps');

    const view = render(
      <MemoryRouter>
        <OnPageDebugger />
      </MemoryRouter>,
    );

    expect(window.localStorage.getItem('tf_debug_active_tab')).toBe('maps');

    authState = { isAdmin: true, isLoading: false };
    view.rerender(
      <MemoryRouter>
        <OnPageDebugger />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Maps' }).length).toBeGreaterThan(0);
    });

    expect(window.localStorage.getItem('tf_debug_active_tab')).toBe('maps');
    expect(screen.getAllByText('Map Runtime').length).toBeGreaterThan(0);
  });
});
