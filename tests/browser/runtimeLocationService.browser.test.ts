// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const buildResponse = (payload: unknown) => new Response(JSON.stringify(payload), {
  status: 200,
  headers: {
    'content-type': 'application/json; charset=utf-8',
  },
});

describe('services/runtimeLocationService', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
  });

  it('fetches and persists the runtime location snapshot once per session', async () => {
    const fetchMock = vi.fn().mockResolvedValue(buildResponse({
      available: true,
      source: 'netlify-context',
      fetchedAt: '2026-03-19T10:30:00.000Z',
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
    }));
    vi.stubGlobal('fetch', fetchMock);

    const service = await import('../../services/runtimeLocationService');
    const snapshot = await service.ensureRuntimeLocationLoaded();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(snapshot.loading).toBe(false);
    expect(snapshot.source).toBe('netlify-context');
    expect(snapshot.location.city).toBe('Berlin');
    expect(window.sessionStorage.getItem(service.RUNTIME_LOCATION_SESSION_STORAGE_KEY)).toContain('"city":"Berlin"');
  });

  it('hydrates from session storage without triggering another fetch', async () => {
    window.sessionStorage.setItem('tf_runtime_location_v1', JSON.stringify({
      available: true,
      source: 'netlify-context',
      fetchedAt: '2026-03-19T10:30:00.000Z',
      location: {
        city: 'Lisbon',
        countryCode: 'PT',
        countryName: 'Portugal',
        subdivisionCode: null,
        subdivisionName: null,
        latitude: 38.7223,
        longitude: -9.1393,
        timezone: 'Europe/Lisbon',
        postalCode: null,
      },
    }));

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const service = await import('../../services/runtimeLocationService');
    const snapshot = await service.ensureRuntimeLocationLoaded();

    expect(snapshot.source).toBe('session-cache');
    expect(snapshot.location.city).toBe('Lisbon');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refresh replaces cached session data with the latest endpoint payload', async () => {
    window.sessionStorage.setItem('tf_runtime_location_v1', JSON.stringify({
      available: true,
      source: 'netlify-context',
      fetchedAt: '2026-03-19T10:30:00.000Z',
      location: {
        city: 'Munich',
        countryCode: 'DE',
        countryName: 'Germany',
        subdivisionCode: 'BY',
        subdivisionName: 'Bavaria',
        latitude: 48.1372,
        longitude: 11.5761,
        timezone: 'Europe/Berlin',
        postalCode: '80331',
      },
    }));

    const fetchMock = vi.fn().mockResolvedValue(buildResponse({
      available: true,
      source: 'netlify-context',
      fetchedAt: '2026-03-19T12:00:00.000Z',
      location: {
        city: 'Hamburg',
        countryCode: 'DE',
        countryName: 'Germany',
        subdivisionCode: 'HH',
        subdivisionName: 'Hamburg',
        latitude: 53.5511,
        longitude: 9.9937,
        timezone: 'Europe/Berlin',
        postalCode: '20095',
      },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const service = await import('../../services/runtimeLocationService');
    const snapshot = await service.refreshRuntimeLocation();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(snapshot.source).toBe('netlify-context');
    expect(snapshot.location.city).toBe('Hamburg');
    expect(window.sessionStorage.getItem(service.RUNTIME_LOCATION_SESSION_STORAGE_KEY)).toContain('"city":"Hamburg"');
  });

  it('notifies subscribers and the window event bridge when the snapshot updates', async () => {
    const fetchMock = vi.fn().mockResolvedValue(buildResponse({
      available: false,
      source: 'unavailable',
      fetchedAt: '2026-03-19T12:00:00.000Z',
      location: {
        city: null,
        countryCode: null,
        countryName: null,
        subdivisionCode: null,
        subdivisionName: null,
        latitude: null,
        longitude: null,
        timezone: null,
        postalCode: null,
      },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const service = await import('../../services/runtimeLocationService');
    const snapshots: string[] = [];
    const events: string[] = [];

    const unsubscribe = service.subscribeRuntimeLocation((snapshot) => {
      snapshots.push(`${snapshot.source}:${snapshot.loading ? 'loading' : 'idle'}`);
    });
    window.addEventListener(service.RUNTIME_LOCATION_EVENT, ((event: Event) => {
      const detail = (event as CustomEvent<{ source: string }>).detail;
      events.push(detail.source);
    }) as EventListener);

    await service.ensureRuntimeLocationLoaded();
    unsubscribe();

    expect(snapshots).toContain('unavailable:idle');
    expect(snapshots).toContain('unavailable:loading');
    expect(events.at(-1)).toBe('unavailable');
  });
});
