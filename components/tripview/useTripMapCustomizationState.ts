import React, { useCallback, useMemo, useState } from 'react';

import { writeUserDefaultMapCustomization } from './mapCustomizationStorage';
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
    mapStyle,
    routeMode,
    showCityNames,
    colorMode,
  }), [colorMode, customization, initialViewSettings, mapStyle, routeMode, showCityNames, userSettings]);

  const applyPatch = useCallback((patch: Partial<ResolvedMapPreferences>) => {
    if (patch.mapStyle !== undefined) setMapStyle(patch.mapStyle);
    if (patch.routeMode !== undefined) setRouteMode(patch.routeMode);
    if (patch.showCityNames !== undefined) setShowCityNames(patch.showCityNames);
    if (patch.colorMode !== undefined) setColorMode(patch.colorMode);

    const {
      mapStyle: _style,
      routeMode: _route,
      showCityNames: _names,
      colorMode: _colors,
      ...nested
    } = patch;

    if (Object.keys(nested).length === 0) return;
    // Trip-level only: experimenting on one trip must not silently rewrite the
    // look every other trip opens with. That is what the explicit save is for.
    setCustomization((current) => normalizeMapCustomization({ ...current, ...nested }));
  }, [setColorMode, setCustomization, setMapStyle, setRouteMode, setShowCityNames]);

  const reset = useCallback(() => {
    setCustomization({});
    setMapStyle(DEFAULT_MAP_PREFERENCES.mapStyle);
    setRouteMode(DEFAULT_MAP_PREFERENCES.routeMode);
    setShowCityNames(DEFAULT_MAP_PREFERENCES.showCityNames);
    setColorMode(DEFAULT_MAP_PREFERENCES.colorMode);
  }, [setColorMode, setCustomization, setMapStyle, setRouteMode, setShowCityNames]);

  const saveAsDefault = useCallback(() => {
    writeUserDefaultMapCustomization(toStoredMapCustomization(preferences));
  }, [preferences]);

  return {
    preferences,
    applyPatch,
    reset,
    saveAsDefault,
    isCustomizeOpen,
    openCustomize: useCallback(() => setIsCustomizeOpen(true), []),
    closeCustomize: useCallback(() => setIsCustomizeOpen(false), []),
  };
};
