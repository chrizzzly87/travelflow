// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  USER_LOCATION_STORAGE_KEY,
  acquireUserLocationWatch,
  disableUserLocation,
  enableUserLocation,
  getUserLocationSnapshot,
  parseStoredUserLocation,
  resetUserLocationServiceForTests,
} from '../../services/userLocationService';

type SuccessCallback = (position: GeolocationPosition) => void;
type ErrorCallback = (error: GeolocationPositionError) => void;

const createGeolocationMock = () => {
  let success: SuccessCallback | null = null;
  let failure: ErrorCallback | null = null;
  const mock = {
    watchPosition: vi.fn((onSuccess: SuccessCallback, onError: ErrorCallback) => {
      success = onSuccess;
      failure = onError;
      return 7;
    }),
    clearWatch: vi.fn(),
    getCurrentPosition: vi.fn((onSuccess: SuccessCallback, onError: ErrorCallback) => {
      success = onSuccess;
      failure = onError;
    }),
    emit(lat: number, lng: number, accuracy = 12, timestamp = Date.now()) {
      success?.({ coords: { latitude: lat, longitude: lng, accuracy }, timestamp } as GeolocationPosition);
    },
    deny() {
      failure?.({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3, message: 'denied' } as GeolocationPositionError);
    },
    timeout() {
      failure?.({ code: 3, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3, message: 'timeout' } as GeolocationPositionError);
    },
  };
  return mock;
};

let geolocation: ReturnType<typeof createGeolocationMock>;

const readStored = () => JSON.parse(window.localStorage.getItem(USER_LOCATION_STORAGE_KEY) ?? 'null');

beforeEach(() => {
  window.localStorage.clear();
  geolocation = createGeolocationMock();
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: geolocation });
  Object.defineProperty(navigator, 'permissions', { configurable: true, value: undefined });
  resetUserLocationServiceForTests();
});

afterEach(() => {
  resetUserLocationServiceForTests();
});

describe('userLocationService', () => {
  it('never asks for the position until the traveller turns it on', () => {
    const release = acquireUserLocationWatch();
    expect(geolocation.watchPosition).not.toHaveBeenCalled();
    expect(geolocation.getCurrentPosition).not.toHaveBeenCalled();
    expect(getUserLocationSnapshot()).toMatchObject({ enabled: null, status: 'off', fix: null });
    release();
  });

  it('turns on from a tap, tracks the position and remembers both on this device', () => {
    const release = acquireUserLocationWatch();
    enableUserLocation();
    expect(geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(geolocation.watchPosition).toHaveBeenCalledTimes(1);

    geolocation.emit(25.033, 121.5654);
    expect(getUserLocationSnapshot()).toMatchObject({
      enabled: true,
      status: 'active',
      fix: { lat: 25.033, lng: 121.5654, accuracyMeters: 12, isLive: true },
    });
    // The write goes through the storage registry; an unregistered key would be dropped silently.
    expect(readStored()).toMatchObject({ enabled: true, fix: { lat: 25.033, lng: 121.5654 } });

    release();
    expect(geolocation.clearWatch).toHaveBeenCalledWith(7);
  });

  it('restores the remembered position as not live and resumes watching on the next visit', () => {
    window.localStorage.setItem(USER_LOCATION_STORAGE_KEY, JSON.stringify({
      enabled: true,
      fix: { lat: 48.1, lng: 11.5, accuracyMeters: 30, recordedAt: 1_700_000_000_000 },
    }));
    resetUserLocationServiceForTests();

    expect(getUserLocationSnapshot().fix).toMatchObject({ lat: 48.1, lng: 11.5, isLive: false });

    const release = acquireUserLocationWatch();
    expect(geolocation.watchPosition).toHaveBeenCalledTimes(1);
    expect(getUserLocationSnapshot().status).toBe('locating');
    release();
  });

  it('keeps the last fix but marks it stale when the signal drops', () => {
    const release = acquireUserLocationWatch();
    enableUserLocation();
    geolocation.emit(1, 2);
    geolocation.timeout();
    expect(getUserLocationSnapshot().fix).toMatchObject({ lat: 1, lng: 2, isLive: false });
    expect(geolocation.clearWatch).not.toHaveBeenCalled();
    release();
  });

  it('stops watching when the browser denies access', () => {
    const release = acquireUserLocationWatch();
    enableUserLocation();
    geolocation.deny();
    expect(getUserLocationSnapshot().status).toBe('denied');
    expect(geolocation.clearWatch).toHaveBeenCalledWith(7);
    release();
  });

  it('turning it off stops the watch, forgets the position and is remembered', () => {
    const release = acquireUserLocationWatch();
    enableUserLocation();
    geolocation.emit(1, 2);
    disableUserLocation();

    expect(geolocation.clearWatch).toHaveBeenCalledWith(7);
    expect(getUserLocationSnapshot()).toMatchObject({ enabled: false, status: 'off', fix: null });
    expect(readStored()).toEqual({ enabled: false, fix: null });

    release();
    resetUserLocationServiceForTests();
    const releaseAgain = acquireUserLocationWatch();
    expect(geolocation.watchPosition).toHaveBeenCalledTimes(1);
    releaseAgain();
  });

  it('starts without a tap when the site already holds the permission', async () => {
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: { query: vi.fn().mockResolvedValue({ state: 'granted' }) },
    });
    const release = acquireUserLocationWatch();
    await vi.waitFor(() => expect(geolocation.watchPosition).toHaveBeenCalledTimes(1));
    expect(getUserLocationSnapshot().enabled).toBe(true);
    release();
  });

  it('does not override an explicit off even when the permission is granted', async () => {
    window.localStorage.setItem(USER_LOCATION_STORAGE_KEY, JSON.stringify({ enabled: false, fix: null }));
    resetUserLocationServiceForTests();
    const query = vi.fn().mockResolvedValue({ state: 'granted' });
    Object.defineProperty(navigator, 'permissions', { configurable: true, value: { query } });

    const release = acquireUserLocationWatch();
    await Promise.resolve();
    expect(query).not.toHaveBeenCalled();
    expect(geolocation.watchPosition).not.toHaveBeenCalled();
    release();
  });

  it('pauses the watch while the tab is hidden', () => {
    const release = acquireUserLocationWatch();
    enableUserLocation();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(geolocation.clearWatch).toHaveBeenCalledWith(7);

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(geolocation.watchPosition).toHaveBeenCalledTimes(2);
    release();
  });
});

describe('parseStoredUserLocation', () => {
  it('drops malformed or out-of-range fixes', () => {
    expect(parseStoredUserLocation('not json')).toEqual({ enabled: null, fix: null });
    expect(parseStoredUserLocation(JSON.stringify({ enabled: true, fix: { lat: 200, lng: 0, recordedAt: 1 } })))
      .toEqual({ enabled: true, fix: null });
    expect(parseStoredUserLocation(JSON.stringify({ enabled: 'yes', fix: { lat: 1, lng: 2, recordedAt: 3 } })))
      .toEqual({ enabled: null, fix: { lat: 1, lng: 2, accuracyMeters: null, recordedAt: 3 } });
  });
});
