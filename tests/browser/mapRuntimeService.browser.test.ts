// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyMapRuntimePresetOverride,
  clearMapRuntimeAdminOverride,
  getDefaultMapRuntimePreset,
  setRuntimeMapPreset,
  subscribeToRuntimeMapPreset,
  readMapRuntimeAdminOverride,
  writeMapRuntimeAdminOverride,
} from '../../services/mapRuntimeService';
import { MAP_RUNTIME_OVERRIDE_COOKIE_NAME } from '../../shared/mapRuntime';

const clearAllCookies = (): void => {
  const cookieParts = document.cookie ? document.cookie.split(';') : [];
  for (const cookiePart of cookieParts) {
    const [name] = cookiePart.trim().split('=');
    if (!name) continue;
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
  }
};

describe('services/mapRuntimeService', () => {
  beforeEach(() => {
    clearAllCookies();
  });

  it('writes and reads the session override cookie', () => {
    writeMapRuntimeAdminOverride({
      preset: 'mapbox_visual_google_services',
      selection: { renderer: 'mapbox', staticMaps: 'mapbox' },
    });

    expect(document.cookie).toContain(MAP_RUNTIME_OVERRIDE_COOKIE_NAME);
    expect(readMapRuntimeAdminOverride()).toEqual({
      preset: 'mapbox_visual_google_services',
      selection: { renderer: 'mapbox', staticMaps: 'mapbox' },
    });
  });

  it('clears the runtime override cookie', () => {
    writeMapRuntimeAdminOverride({ preset: 'google_all' });
    clearMapRuntimeAdminOverride();

    expect(readMapRuntimeAdminOverride()).toBeNull();
  });

  it('treats the default preset override as a cookie reset', () => {
    writeMapRuntimeAdminOverride({ preset: 'mapbox_visual_google_services' });

    applyMapRuntimePresetOverride('default', { reload: false });

    expect(readMapRuntimeAdminOverride()).toBeNull();
  });

  it('notifies subscribers when the admin preset changes', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToRuntimeMapPreset(listener);

    setRuntimeMapPreset('mapbox_all');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getDefaultMapRuntimePreset()).toBe('mapbox_all');

    setRuntimeMapPreset('mapbox_all');
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    setRuntimeMapPreset(null);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
