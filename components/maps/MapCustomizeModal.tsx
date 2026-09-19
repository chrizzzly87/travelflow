import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy, RotateCcw, Star, X } from 'lucide-react';

import { Drawer, DrawerContent } from '../ui/drawer';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { SettingsPanel, SettingsRow, SettingsSection } from '../ui/settings-panel';
import { MapSegmentedControl } from './MapSegmentedControl';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import {
  MAP_PITCH_STEPS,
  MAP_PREFERENCE_PRESETS,
  MAP_STYLE_PRESETS,
  matchMapPreferencePreset,
  matchMapStylePreset,
  serializeMapPreset,
  type MapPreferencePresetId,
  type ResolvedMapPreferences,
} from '../../shared/mapPreferences';
import type { MapStyle } from '../../types';

/**
 * The map's customize sheet.
 *
 * Non-blocking on every size: a bottom sheet on a phone, a side dock on
 * desktop. The whole point is changing something and watching the map answer,
 * so the real map with the real trip stays visible and interactive — which is a
 * better preview than any thumbnail of a generic place could be. Every control
 * applies immediately; the only save step promotes the look to a personal
 * default.
 */

export interface MapCustomizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: ResolvedMapPreferences;
  onChange: (patch: Partial<ResolvedMapPreferences>) => void;
  onReset: () => void;
  /** Promotes the current look to the traveller's own starting point. */
  onSaveAsDefault?: () => void;
  /** True once a personal preset has been saved, which offers it back. */
  hasSavedPreset?: boolean;
  onApplySavedPreset?: () => void;
  isMobile?: boolean;
  /** What is drawing now, which is not always what was asked for. */
  activeRenderer: 'google' | 'mapbox';
  isMapboxAvailable?: boolean;
  tripId?: string;
}

type TabKey = 'look' | 'detail' | 'trip' | 'camera';

const TAB_ORDER: TabKey[] = ['look', 'detail', 'trip', 'camera'];

/**
 * Colour chips for the preset row.
 *
 * Deliberately CSS rather than rendered map imagery: Mapbox's Static Images API
 * cannot apply a Standard style's `theme`/`lightPreset` config, so a "preview"
 * built from it would show a different map from the one the preset produces.
 * A chip that honestly signals light/dark and warm/cool beats a thumbnail that
 * quietly lies, and the live map behind the sheet is the real preview.
 */
const PRESET_SWATCH: Record<MapStyle, { background: string; border?: string }> = {
  standard: { background: 'linear-gradient(135deg,#eef3f8 0%,#dbe5ee 60%,#c3d4e3 100%)' },
  minimal: { background: 'linear-gradient(135deg,#fafafa 0%,#edf2f7 60%,#dfe5eb 100%)' },
  clean: { background: 'linear-gradient(135deg,#f7f9fa 0%,#e8eef2 60%,#d6e2e8 100%)' },
  dark: { background: 'linear-gradient(135deg,#334155 0%,#1e293b 60%,#0f172a 100%)', border: 'rgba(255,255,255,0.18)' },
  cleanDark: { background: 'linear-gradient(135deg,#1f2937 0%,#111827 60%,#030712 100%)', border: 'rgba(255,255,255,0.18)' },
  satellite: { background: 'linear-gradient(135deg,#6b7f62 0%,#4d6972 55%,#2f4a52 100%)', border: 'rgba(255,255,255,0.18)' },
};

export const MapCustomizeModal: React.FC<MapCustomizeModalProps> = ({
  isOpen,
  onClose,
  preferences,
  onChange,
  onReset,
  onSaveAsDefault,
  hasSavedPreset = false,
  onApplySavedPreset,
  isMobile = false,
  activeRenderer,
  isMapboxAvailable = true,
  tripId,
}) => {
  const { t } = useTranslation('common');
  const [activeTab, setActiveTab] = useState<TabKey>('look');
  const [didCopyPreset, setDidCopyPreset] = useState(false);
  const [didSaveDefault, setDidSaveDefault] = useState(false);

  const isMapboxActive = activeRenderer === 'mapbox';
  const isGoogleActive = activeRenderer === 'google';
  const activePreset = matchMapStylePreset(preferences);
  const activePreferencePreset = matchMapPreferencePreset(preferences);

  const key = useCallback(
    (suffix: string, fallback: string) => t(`tripView.mapCustomize.${suffix}`, fallback),
    [t],
  );

  const handleChange = useCallback(
    (patch: Partial<ResolvedMapPreferences>) => {
      const [field] = Object.keys(patch);
      trackEvent('trip_view__map_customize--change', {
        trip_id: tripId,
        field,
        value: String(patch[field as keyof ResolvedMapPreferences]),
      });
      onChange(patch);
    },
    [onChange, tripId],
  );

  /**
   * The way out of a control that is disabled because the other renderer owns
   * it. A note saying "Mapbox only" explains the problem and leaves you to go
   * and solve it; this solves it.
   */
  const switchToMapbox = useCallback(() => {
    handleChange({ renderer: 'mapbox' });
  }, [handleChange]);

  const mapboxOnlyNote = useCallback((): React.ReactNode => {
    if (isMapboxActive) return undefined;
    if (!isMapboxAvailable) {
      return key('mapboxUnavailableHere', 'Needs Mapbox, which is not configured here.');
    }
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        {key('mapboxOnly', 'Available with Mapbox.')}
        <button
          type="button"
          onClick={switchToMapbox}
          className="font-semibold text-accent-700 underline underline-offset-2 hover:text-accent-800"
          {...getAnalyticsDebugAttributes('trip_view__map_customize--switch_mapbox', { surface: 'map_customize' })}
        >
          {key('switchToMapbox', 'Switch to Mapbox')}
        </button>
      </span>
    );
  }, [isMapboxActive, isMapboxAvailable, key, switchToMapbox]);

  const googleOnlyNote = isGoogleActive
    ? undefined
    : key('googleOnly', 'Available with Google Maps.');

  const handleCopyPreset = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(serializeMapPreset(preferences));
      setDidCopyPreset(true);
      window.setTimeout(() => setDidCopyPreset(false), 2000);
      trackEvent('trip_view__map_customize--copy_preset', { trip_id: tripId });
    } catch {
      // A clipboard the browser refuses is not worth an error dialog over: the
      // button simply does not confirm, which reads as "that did not work".
      setDidCopyPreset(false);
    }
  }, [preferences, tripId]);

  const handleSaveAsDefault = useCallback(() => {
    if (!onSaveAsDefault) return;
    onSaveAsDefault();
    setDidSaveDefault(true);
    window.setTimeout(() => setDidSaveDefault(false), 2000);
    trackEvent('trip_view__map_customize--save_default', { trip_id: tripId });
  }, [onSaveAsDefault, tripId]);

  const presetOptions = useMemo(() => MAP_STYLE_PRESETS.map((preset) => ({
    value: preset.id,
    label: key(`style.${preset.id}`, preset.id),
    swatch: PRESET_SWATCH[preset.id],
  })), [key]);

  const tabLabels: Record<TabKey, string> = {
    look: key('tab.look', 'Look'),
    detail: key('tab.detail', 'Detail'),
    trip: key('tab.trip', 'Trip'),
    camera: key('tab.camera', 'Camera'),
  };

  const title = key('title', 'Customize map');
  const description = key('description', 'Saved with this trip as you change it.');

  /**
   * Whole-panel presets, above the tabs rather than inside one: they cut across
   * every tab, so putting them in "Look" would suggest they only change colour.
   */
  const presetRow = (
    <div className="pb-3">
      <span className="mb-1.5 block text-xs font-medium text-slate-600">
        {key('presetSet.label', 'Start from')}
      </span>
      <MapSegmentedControl
        name="map-preference-preset"
        label={key('presetSet.label', 'Start from')}
        value={activePreferencePreset ?? ('custom' as MapPreferencePresetId | 'custom')}
        options={[
          ...MAP_PREFERENCE_PRESETS.map((preset) => ({
            value: preset.id as MapPreferencePresetId | 'custom',
            label: key(`presetSet.${preset.id}`, preset.id),
          })),
          ...(hasSavedPreset && onApplySavedPreset
            ? [{ value: 'custom' as const, label: key('presetSet.mine', 'Mine') }]
            : []),
        ]}
        onChange={(presetId) => {
          if (presetId === 'custom') {
            onApplySavedPreset?.();
            return;
          }
          const preset = MAP_PREFERENCE_PRESETS.find((entry) => entry.id === presetId);
          if (preset) handleChange(preset.values);
        }}
      />
      {activePreferencePreset === null && (
        <span className="mt-1.5 block text-xs text-slate-500">
          {key('presetSet.customNote', 'Your own mix of settings.')}
        </span>
      )}
    </div>
  );

  const tabPanels = (
    <>
      <TabsContent value="look">
        <SettingsPanel>
          <SettingsSection>
            <SettingsRow label={key('preset.label', 'Presets')} layout="stacked">
              <MapSegmentedControl
                name="map-preset"
                wrap
                label={key('preset.label', 'Presets')}
                value={activePreset ?? ('' as MapStyle)}
                options={presetOptions}
                onChange={(style) => {
                  const preset = MAP_STYLE_PRESETS.find((entry) => entry.id === style);
                  if (!preset) return;
                  handleChange({
                    base: preset.base,
                    colorTheme: preset.colorTheme,
                    lightPreset: preset.lightPreset,
                  });
                }}
              />
            </SettingsRow>

            <SettingsRow
              label={key('base.label', 'Base')}
              description={key('base.description', 'A drawn map, or satellite imagery.')}
              layout="stacked"
            >
              <MapSegmentedControl
                name="map-base"
                label={key('base.label', 'Base')}
                value={preferences.base}
                options={[
                  { value: 'map', label: key('base.map', 'Map') },
                  { value: 'satellite', label: key('base.satellite', 'Satellite') },
                ]}
                onChange={(base) => handleChange({ base })}
              />
            </SettingsRow>

            <SettingsRow
              label={key('colorTheme.label', 'Colour')}
              description={key('colorTheme.description', 'How much colour the map carries.')}
              layout="stacked"
              note={preferences.base === 'satellite'
                ? key('colorTheme.satelliteNote', 'Satellite imagery has its own colour.')
                : undefined}
            >
              <MapSegmentedControl
                name="map-theme"
                label={key('colorTheme.label', 'Colour')}
                disabled={preferences.base === 'satellite'}
                value={preferences.colorTheme}
                options={[
                  { value: 'default', label: key('colorTheme.default', 'Full') },
                  { value: 'faded', label: key('colorTheme.faded', 'Faded') },
                  { value: 'monochrome', label: key('colorTheme.monochrome', 'Mono') },
                ]}
                onChange={(colorTheme) => handleChange({ colorTheme })}
              />
            </SettingsRow>

            <SettingsRow
              label={key('light.label', 'Light')}
              description={key('light.description', 'Time of day the map is lit for. Automatic follows your device.')}
              layout="stacked"
              note={isMapboxActive ? undefined : key('light.googleNote', 'Google Maps has day and night only.')}
            >
              <MapSegmentedControl
                name="map-light"
                label={key('light.label', 'Light')}
                value={preferences.lightPreset}
                options={[
                  { value: 'auto', label: key('light.auto', 'Auto') },
                  { value: 'dawn', label: key('light.dawn', 'Dawn') },
                  { value: 'day', label: key('light.day', 'Day') },
                  { value: 'dusk', label: key('light.dusk', 'Dusk') },
                  { value: 'night', label: key('light.night', 'Night') },
                ]}
                onChange={(lightPreset) => handleChange({ lightPreset })}
              />
            </SettingsRow>

            <SettingsRow
              label={key('renderer.label', 'Map provider')}
              description={key('renderer.description', 'Which map the app draws.')}
              layout="stacked"
              note={preferences.renderer !== 'google' && !isMapboxAvailable
                ? key('renderer.mapboxUnavailable', 'Mapbox is not configured here, so Google is being used.')
                : undefined}
            >
              <MapSegmentedControl
                name="map-renderer"
                label={key('renderer.label', 'Map provider')}
                value={preferences.renderer}
                options={[
                  { value: 'auto', label: key('renderer.auto', 'Auto') },
                  { value: 'google', label: key('renderer.google', 'Google') },
                  { value: 'mapbox', label: key('renderer.mapbox', 'Mapbox') },
                ]}
                onChange={(renderer) => handleChange({ renderer })}
              />
            </SettingsRow>

            <SettingsRow
              label={key('handoff.label', 'Open places in')}
              description={key('handoff.description', 'Which app gets offered first when you open a place.')}
              layout="stacked"
            >
              <MapSegmentedControl
                name="map-handoff"
                label={key('handoff.label', 'Open places in')}
                value={preferences.handoffTarget}
                options={[
                  { value: 'google', label: key('handoff.google', 'Google Maps') },
                  { value: 'apple', label: key('handoff.apple', 'Apple Maps') },
                ]}
                onChange={(handoffTarget) => handleChange({ handoffTarget })}
              />
            </SettingsRow>
          </SettingsSection>
        </SettingsPanel>
      </TabsContent>

      <TabsContent value="detail">
        <SettingsPanel>
          <SettingsSection title={key('group.labels', 'Labels')}>
            <SettingsRow label={key('placeLabels.label', 'Place names')} description={key('placeLabels.description', 'Towns and cities on the basemap.')}>
              <Switch
                checked={preferences.showPlaceLabels}
                onCheckedChange={(checked) => handleChange({ showPlaceLabels: checked })}
                aria-label={key('placeLabels.label', 'Place names')}
              />
            </SettingsRow>
            <SettingsRow label={key('roadLabels.label', 'Street names')} description={key('roadLabels.description', 'Useful up close, noisy from far away.')}>
              <Switch
                checked={preferences.showRoadLabels}
                onCheckedChange={(checked) => handleChange({ showRoadLabels: checked })}
                aria-label={key('roadLabels.label', 'Street names')}
              />
            </SettingsRow>
            <SettingsRow label={key('transitLabels.label', 'Station names')} description={key('transitLabels.description', 'Stops and stations by name.')}>
              <Switch
                checked={preferences.showTransitLabels}
                onCheckedChange={(checked) => handleChange({ showTransitLabels: checked })}
                aria-label={key('transitLabels.label', 'Station names')}
              />
            </SettingsRow>
            <SettingsRow label={key('poiLabels.label', 'Points of interest')} description={key('poiLabels.description', 'Shops, landmarks and places you have not planned.')}>
              <Switch
                checked={preferences.showPoiLabels}
                onCheckedChange={(checked) => handleChange({ showPoiLabels: checked })}
                aria-label={key('poiLabels.label', 'Points of interest')}
              />
            </SettingsRow>
          </SettingsSection>

          <SettingsSection title={key('group.features', 'Features')}>
            <SettingsRow label={key('roads.label', 'Roads and transit')} description={key('roads.description', 'Turn off for a clean map of just your trip.')}>
              <Switch
                checked={preferences.showRoadsAndTransit}
                onCheckedChange={(checked) => handleChange({ showRoadsAndTransit: checked })}
                aria-label={key('roads.label', 'Roads and transit')}
              />
            </SettingsRow>
            <SettingsRow label={key('paths.label', 'Footpaths')} description={key('paths.description', 'Pedestrian paths and walkways.')}>
              <Switch
                checked={preferences.showPedestrianRoads}
                disabled={!preferences.showRoadsAndTransit}
                onCheckedChange={(checked) => handleChange({ showPedestrianRoads: checked })}
                aria-label={key('paths.label', 'Footpaths')}
              />
            </SettingsRow>
            <SettingsRow label={key('boundaries.label', 'Region borders')} description={key('boundaries.description', 'Borders inside a country, not just between them.')}>
              <Switch
                checked={preferences.showAdminBoundaries}
                onCheckedChange={(checked) => handleChange({ showAdminBoundaries: checked })}
                aria-label={key('boundaries.label', 'Region borders')}
              />
            </SettingsRow>
            <SettingsRow
              label={key('buildings.label', '3D buildings')}
              description={key('buildings.description', 'Raised buildings, best seen with some tilt.')}
              note={mapboxOnlyNote()}
            >
              <Switch
                checked={preferences.show3dObjects}
                disabled={!isMapboxActive}
                onCheckedChange={(checked) => handleChange({ show3dObjects: checked })}
                aria-label={key('buildings.label', '3D buildings')}
              />
            </SettingsRow>
            <SettingsRow label={key('traffic.label', 'Live traffic')} description={key('traffic.description', 'Current conditions on the roads.')} note={googleOnlyNote}>
              <Switch
                checked={preferences.showTraffic}
                disabled={!isGoogleActive}
                onCheckedChange={(checked) => handleChange({ showTraffic: checked })}
                aria-label={key('traffic.label', 'Live traffic')}
              />
            </SettingsRow>
            <SettingsRow label={key('transitLines.label', 'Transit lines')} description={key('transitLines.description', 'Metro and rail lines on the map.')} note={googleOnlyNote}>
              <Switch
                checked={preferences.showTransitLines}
                disabled={!isGoogleActive}
                onCheckedChange={(checked) => handleChange({ showTransitLines: checked })}
                aria-label={key('transitLines.label', 'Transit lines')}
              />
            </SettingsRow>
          </SettingsSection>
        </SettingsPanel>
      </TabsContent>

      <TabsContent value="trip">
        <SettingsPanel>
          <SettingsSection title={key('group.pins', 'Your pins')}>
            <SettingsRow label={key('cityNames.label', 'City names')} description={key('cityNames.description', 'Label each stop on your route.')}>
              <Switch
                checked={preferences.showCityNames}
                onCheckedChange={(checked) => handleChange({ showCityNames: checked })}
                aria-label={key('cityNames.label', 'City names')}
              />
            </SettingsRow>
            <SettingsRow label={key('activityMarkers.label', 'Activity pins')} description={key('activityMarkers.description', 'The places you planned to visit.')}>
              <Switch
                checked={preferences.showActivityMarkers}
                onCheckedChange={(checked) => handleChange({ showActivityMarkers: checked })}
                aria-label={key('activityMarkers.label', 'Activity pins')}
              />
            </SettingsRow>
            <SettingsRow label={key('dimPast.label', 'Fade past days')} description={key('dimPast.description', 'Push days you have already had into the background.')}>
              <Switch
                checked={preferences.dimPastDays}
                onCheckedChange={(checked) => handleChange({ dimPastDays: checked })}
                aria-label={key('dimPast.label', 'Fade past days')}
              />
            </SettingsRow>
          </SettingsSection>

          <SettingsSection title={key('group.routes', 'Route lines')}>
            <SettingsRow
              label={key('routeMode.label', 'Shape')}
              description={key('routeMode.description', 'Follow the roads, or draw straight between stops.')}
              layout="stacked"
            >
              <MapSegmentedControl
                name="map-route-mode"
                label={key('routeMode.label', 'Shape')}
                value={preferences.routeMode}
                options={[
                  { value: 'simple', label: key('routeMode.simple', 'Direct') },
                  { value: 'realistic', label: key('routeMode.realistic', 'Follow roads') },
                ]}
                onChange={(routeMode) => handleChange({ routeMode })}
              />
            </SettingsRow>
            <SettingsRow label={key('thickness.label', 'Thickness')} layout="stacked">
              <MapSegmentedControl
                name="map-route-thickness"
                label={key('thickness.label', 'Thickness')}
                value={preferences.routeThickness}
                options={[
                  { value: 'thin', label: key('thickness.thin', 'Thin') },
                  { value: 'normal', label: key('thickness.normal', 'Normal') },
                  { value: 'thick', label: key('thickness.thick', 'Thick') },
                ]}
                onChange={(routeThickness) => handleChange({ routeThickness })}
              />
            </SettingsRow>
            <SettingsRow label={key('colorMode.label', 'Colour')} layout="stacked">
              <MapSegmentedControl
                name="map-route-color"
                label={key('colorMode.label', 'Colour')}
                value={preferences.colorMode}
                options={[
                  { value: 'trip', label: key('colorMode.trip', 'City colours') },
                  { value: 'brand', label: key('colorMode.brand', 'One accent') },
                ]}
                onChange={(colorMode) => handleChange({ colorMode })}
              />
            </SettingsRow>
            <SettingsRow label={key('arrows.label', 'Direction arrows')} description={key('arrows.description', 'Show which way the journey runs.')}>
              <Switch
                checked={preferences.showRouteArrows}
                onCheckedChange={(checked) => handleChange({ showRouteArrows: checked })}
                aria-label={key('arrows.label', 'Direction arrows')}
              />
            </SettingsRow>
            <SettingsRow label={key('dashed.label', 'Dashed lines')} description={key('dashed.description', 'Dashes rather than solid lines.')}>
              <Switch
                checked={preferences.dashedRoutes}
                onCheckedChange={(checked) => handleChange({ dashedRoutes: checked })}
                aria-label={key('dashed.label', 'Dashed lines')}
              />
            </SettingsRow>
          </SettingsSection>
        </SettingsPanel>
      </TabsContent>

      <TabsContent value="camera">
        <SettingsPanel>
          <SettingsSection>
            <SettingsRow
              label={key('cityFocus.label', 'Focus a city when selected')}
              description={key('cityFocus.description', 'Frame the city on your own plan and hide the rest of the journey.')}
            >
              <Switch
                checked={preferences.cityFocusMode}
                onCheckedChange={(checked) => handleChange({ cityFocusMode: checked })}
                aria-label={key('cityFocus.label', 'Focus a city when selected')}
              />
            </SettingsRow>

            <SettingsRow
              label={key('pitch.label', 'Tilt')}
              description={key('pitch.description', 'Look across the map rather than straight down.')}
              layout="stacked"
              note={mapboxOnlyNote()}
            >
              <MapSegmentedControl
                name="map-pitch"
                label={key('pitch.label', 'Tilt')}
                disabled={!isMapboxActive}
                value={MAP_PITCH_STEPS.reduce((closest, step) => (
                  Math.abs(step - preferences.pitch) < Math.abs(closest - preferences.pitch) ? step : closest
                ), MAP_PITCH_STEPS[0])}
                options={MAP_PITCH_STEPS.map((step) => ({
                  value: step,
                  label: step === 0 ? key('pitch.flat', 'Flat') : `${step}°`,
                }))}
                onChange={(pitch) => handleChange({ pitch })}
              />
            </SettingsRow>

            <SettingsRow
              label={key('globe.label', 'Globe view')}
              description={key('globe.description', 'Curves the world. Best on a long trip and a large map.')}
              note={mapboxOnlyNote()}
            >
              <Switch
                checked={preferences.useGlobeProjection}
                disabled={!isMapboxActive}
                onCheckedChange={(checked) => handleChange({ useGlobeProjection: checked })}
                aria-label={key('globe.label', 'Globe view')}
              />
            </SettingsRow>

            <SettingsRow
              label={key('terrain.label', 'Terrain')}
              description={key('terrain.description', 'Raises hills and mountains.')}
              note={mapboxOnlyNote()}
            >
              <Switch
                checked={preferences.showTerrain}
                disabled={!isMapboxActive}
                onCheckedChange={(checked) => handleChange({ showTerrain: checked })}
                aria-label={key('terrain.label', 'Terrain')}
              />
            </SettingsRow>
          </SettingsSection>
        </SettingsPanel>
      </TabsContent>
    </>
  );

  /**
   * The tab bar and the preset row are pinned; only the panels scroll.
   *
   * They used to sit inside the one scrolling area, so adding the preset row
   * above them and capping the panel height meant the tab bar scrolled off the
   * top as soon as you reached for a control — the tabs looked like they had
   * been removed. A row of tabs you cannot see is a row of tabs that does not
   * exist.
   *
   * `SettingsRow`'s inline layout reserves an 18rem control track at the `sm:`
   * breakpoint, which is a *viewport* query — inside a 380px panel on a desktop
   * screen it still applies, leaving the caption about 60px and wrapping every
   * label one word per line. Narrowing the track to the control's own width
   * gives the text the rest, without changing the row anywhere else.
   */
  const SCROLL_AREA_CLASS = 'min-h-0 flex-1 overflow-y-auto [&_[data-slot=settings-row][data-layout=inline]]:sm:grid-cols-[minmax(0,1fr)_auto] [&_[data-slot=settings-row][data-layout=inline]]:sm:gap-x-3';

  const tabbedBody = (
    <Tabs
      value={activeTab}
      onValueChange={(value) => setActiveTab(value as TabKey)}
      className="flex min-h-0 flex-1 flex-col gap-0"
    >
      <div className="shrink-0 border-b border-slate-100 px-4 pb-3 pt-3">
        {presetRow}
        <TabsList className="w-full">
          {TAB_ORDER.map((tab) => (
            <TabsTrigger key={tab} value={tab} className="flex-1">{tabLabels[tab]}</TabsTrigger>
          ))}
        </TabsList>
      </div>
      <div className={`${SCROLL_AREA_CLASS} px-4 py-3`}>{tabPanels}</div>
    </Tabs>
  );

  const footer = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Button type="button" variant="ghost" size="sm" onClick={onReset}>
        <RotateCcw size={15} />
        {key('reset', 'Reset')}
      </Button>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={handleCopyPreset}>
          {didCopyPreset ? <Check size={15} /> : <Copy size={15} />}
          {didCopyPreset ? key('copied', 'Copied') : key('copyPreset', 'Copy')}
        </Button>
        {onSaveAsDefault && (
          <Button type="button" variant="default" size="sm" onClick={handleSaveAsDefault}>
            {didSaveDefault ? <Check size={15} /> : <Star size={15} />}
            {didSaveDefault ? key('saved', 'Saved') : key('saveAsDefault', 'Save as my preset')}
          </Button>
        )}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }} modal={false}>
        <DrawerContent
          hideOverlay
          accessibleTitle={title}
          accessibleDescription={description}
          className="max-h-[64vh]"
          data-testid="map-customize-sheet"
        >
          <div className="flex max-h-[58vh] min-h-0 flex-col">
            <h2 className="shrink-0 px-4 pb-1 pt-2 text-base font-semibold text-slate-900">{title}</h2>
            {tabbedBody}
          </div>
          <div className="border-t border-slate-200 px-4 py-3">{footer}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  if (!isOpen) return null;

  /*
   * A side dock rather than a centred dialog. A modal covered the very thing
   * every one of these controls changes, which is backwards for a panel whose
   * purpose is experimenting on the live map.
   *
   * Non-modal by design, so it takes `role="dialog"`, a real close control and
   * Escape, but no focus trap and no `aria-modal` — trapping focus would be
   * wrong for a panel you are meant to use alongside the map.
   */
  /*
   * `bottom-24` stops the panel short of the floating "plan with AI" launcher,
   * which sits at `bottom-4` on a higher layer and was being covered by the
   * panel's footer. Those insets bound the height on their own; an extra cap
   * only shortened the scroll area and pushed the pinned tabs harder against
   * the content below them.
   */
  return (
    <div
      role="dialog"
      aria-label={title}
      data-testid="map-customize-panel"
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.stopPropagation();
        onClose();
      }}
      className="fixed bottom-24 end-4 top-20 z-[1400] flex w-[min(92vw,380px)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={key('close', 'Close')}
          className="-me-1 -mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <X size={16} />
        </button>
      </div>
      {tabbedBody}
      <div className="border-t border-slate-200 px-4 py-3">{footer}</div>
    </div>
  );
};
