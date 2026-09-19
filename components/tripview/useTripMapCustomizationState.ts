import React, { useCallback, useMemo, useState } from 'react';

import { readUserDefaultMapCustomization, writeUserDefaultMapCustomization } from './mapCustomizationStorage';
import {
  DEFAULT_MAP_PREFERENCES,
  normalizeMapCustomization,
  resolveMapPreferences,
  toStoredMapCustomization,
  type ResolvedMapPreferences,
} from '../../shared/mapPreferences';
import type {
  IMapCustomization,
  IUserSettings,
  IViewSettings,
  MapColorMode,
  MapStyle,
  RouteMode,
} from '../../types';

/**
 * The customize sheet's state.
 *
 * Two shapes are edited at once. `mapStyle`, `routeMode`, `showCityNames` and
 * the colour mode already had homes and keep them, so their existing readers,
 * their persistence and their view-settings sync are untouched. Everything new
 * goes into one nested object. A patch is routed to whichever of the two the
 * field belongs to, so callers never have to know which is which.
 */

interface UseTripMapCustomizationStateOptions {
  initialViewSettings?: IViewSettings;
  userSettings?: Partial<IUserSettings> | null;
  mapStyle: MapStyle;
  setMapStyle: (style: MapStyle) => void;
  routeMode: RouteMode;
  setRouteMode: (mode: RouteMode) => void;
  showCityNames: boolean;
  setShowCityNames: (enabled: boolean) => void;
  colorMode: MapColorMode;
  setColorMode: (mode: MapColorMode) => void;
  /**
   * Lifted into `useTripLayoutControlsState` because the trip's view settings
   * are assembled before the colour-mode handler this hook also needs exists.
   */
  customization: IMapCustomization;
  setCustomization: React.Dispatch<React.SetStateAction<IMapCustomization>>;
}

export const useTripMapCustomizationState = ({
  initialViewSettings,
  userSettings,
  mapStyle,
  setMapStyle,
  routeMode,
  setRouteMode,
  showCityNames,
  setShowCityNames,
  colorMode,
  setColorMode,
  customization,
  setCustomization,
}: UseTripMapCustomizationStateOptions) => {
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);

  const preferences = useMemo<ResolvedMapPreferences>(() => ({
    ...resolveMapPreferences({
      viewSettings: { ...initialViewSettings, mapCustomization: customization } as Partial<IViewSettings>,
      userSettings,
    }),
    // The flat fields are read from live state rather than from the settings
    // snapshot: they change through their own setters and must not be stale.
    routeMode,
    showCityNames,
    colorMode,
  }), [colorMode, customization, initialViewSettings, mapStyle, routeMode, showCityNames, userSettings]);
  // `mapStyle` stays in the dependency list because `resolveMapPreferences`
  // decomposes it into axes for a trip saved before the axes existed.

  const applyPatch = useCallback((patch: Partial<ResolvedMapPreferences>) => {
    // `mapStyle` is no longer edited directly — it is derived from the look's
    // axes and pushed back into the flat field by the owner, so a trip keeps a
    // named style that Google and older readers still understand.
    if (patch.routeMode !== undefined) setRouteMode(patch.routeMode);
    if (patch.showCityNames !== undefined) setShowCityNames(patch.showCityNames);
    if (patch.colorMode !== undefined) setColorMode(patch.colorMode);

    const {
      routeMode: _route,
      showCityNames: _names,
      colorMode: _colors,
      ...nested
    } = patch;

    if (Object.keys(nested).length === 0) return;
    // Trip-level only: experimenting on one trip must not silently rewrite the
    // look every other trip opens with. That is what the explicit save is for.
    setCustomization((current) => normalizeMapCustomization({ ...current, ...nested }));
  }, [setColorMode, setCustomization, setRouteMode, setShowCityNames]);

  const reset = useCallback(() => {
    setCustomization({});
    setRouteMode(DEFAULT_MAP_PREFERENCES.routeMode);
    setShowCityNames(DEFAULT_MAP_PREFERENCES.showCityNames);
    setColorMode(DEFAULT_MAP_PREFERENCES.colorMode);
  }, [setColorMode, setCustomization, setRouteMode, setShowCityNames]);

  const [savedPreset, setSavedPreset] = useState<IMapCustomization>(() => readUserDefaultMapCustomization());

  const saveAsDefault = useCallback(() => {
    const stored = toStoredMapCustomization(preferences);
    writeUserDefaultMapCustomization(stored);
    setSavedPreset(stored);
  }, [preferences]);

  /**
   * Puts the traveller's own saved preset back onto this trip. Only the nested
   * fields are restored — the flat ones are applied through their own setters
   * so their existing persistence and view-settings sync still run.
   */
  const applySavedPreset = useCallback(() => {
    setCustomization(normalizeMapCustomization(savedPreset));
  }, [savedPreset, setCustomization]);

  return {
    preferences,
    applyPatch,
    reset,
    saveAsDefault,
    applySavedPreset,
    hasSavedPreset: Object.keys(savedPreset).length > 0,
    isCustomizeOpen,
    openCustomize: useCallback(() => setIsCustomizeOpen(true), []),
    closeCustomize: useCallback(() => setIsCustomizeOpen(false), []),
  };
};
