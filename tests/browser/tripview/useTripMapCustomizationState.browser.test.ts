// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useTripMapCustomizationState } from '../../../components/tripview/useTripMapCustomizationState';
import { DEFAULT_MAP_PREFERENCES } from '../../../shared/mapPreferences';
import type { IMapCustomization } from '../../../types';

/**
 * The hook edits `customization` through a setter its owner holds, so the test
 * plays that owner: a tiny store the hook writes into and reads back.
 */
const renderCustomizationHook = () => {
  let customization: IMapCustomization = {};
  const setCustomization = vi.fn((next: IMapCustomization | ((current: IMapCustomization) => IMapCustomization)) => {
    customization = typeof next === 'function' ? next(customization) : next;
  });

  const rendered = renderHook(() => useTripMapCustomizationState({
    mapStyle: 'standard',
    setMapStyle: vi.fn(),
    routeMode: DEFAULT_MAP_PREFERENCES.routeMode,
    setRouteMode: vi.fn(),
    showCityNames: DEFAULT_MAP_PREFERENCES.showCityNames,
    setShowCityNames: vi.fn(),
    colorMode: DEFAULT_MAP_PREFERENCES.colorMode,
    setColorMode: vi.fn(),
    customization,
    setCustomization,
  }));

  return { ...rendered, setCustomization };
};

describe('components/tripview/useTripMapCustomizationState', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('remembers that the saved preset is the pick, because the values cannot say so', () => {
    /**
     * A saved preset covers only the nested customization — routeMode,
     * showCityNames and colorMode live on the view settings — so applying it can
     * land on values a named preset also matches. Deriving the selection from
     * the values alone made "Mine" snap back to "Default" the moment it was
     * tapped.
     */
    const { result } = renderCustomizationHook();
    expect(result.current.isSavedPresetActive).toBe(false);

    act(() => result.current.applySavedPreset());
    expect(result.current.isSavedPresetActive).toBe(true);
  });

  it('drops the saved-preset pick as soon as anything else is changed', () => {
    const { result } = renderCustomizationHook();

    act(() => result.current.applySavedPreset());
    act(() => result.current.applyPatch({ showTerrain: true }));
    expect(result.current.isSavedPresetActive).toBe(false);

    act(() => result.current.applySavedPreset());
    act(() => result.current.reset());
    expect(result.current.isSavedPresetActive).toBe(false);
  });
});
