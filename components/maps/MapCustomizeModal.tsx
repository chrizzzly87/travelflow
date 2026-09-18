import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy, RotateCcw, Star } from 'lucide-react';

import { AppModal } from '../ui/app-modal';
import { Drawer, DrawerContent } from '../ui/drawer';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Slider } from '../ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { SettingsPanel, SettingsRow, SettingsSection } from '../ui/settings-panel';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import {
  DEFAULT_MAP_PREFERENCES,
  MAP_PITCH_RANGE,
  MAP_ROUTE_LINE_WEIGHT_RANGE,
  serializeMapPreset,
  type ResolvedMapPreferences,
} from '../../shared/mapPreferences';
import type { MapStyle } from '../../types';

/**
 * The map's customize sheet.
 *
 * Deliberately non-blocking on a phone: the whole point is changing something
 * and watching the map answer, so the sheet takes the bottom half and leaves
 * the map both visible and interactive above it. Every control applies
 * immediately — there is no save step for the live preview, only for promoting
 * the current look to a personal default.
 */

export interface MapCustomizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: ResolvedMapPreferences;
  onChange: (patch: Partial<ResolvedMapPreferences>) => void;
  onReset: () => void;
  /** Absent for a signed-out traveller, who has nowhere to save a default. */
  onSaveAsDefault?: () => void;
  isMobile?: boolean;
  /** Mapbox-only controls are shown disabled elsewhere rather than hidden. */
  activeRenderer: 'google' | 'mapbox';
  /** Drives the "not available in this deploy" note on the provider picker. */
  isMapboxAvailable?: boolean;
  tripId?: string;
}

const MAP_STYLE_ORDER: MapStyle[] = ['standard', 'minimal', 'clean', 'dark', 'cleanDark', 'satellite'];

type TabKey = 'basemap' | 'journey' | 'places' | 'camera';

const TAB_ORDER: TabKey[] = ['basemap', 'journey', 'places', 'camera'];

export const MapCustomizeModal: React.FC<MapCustomizeModalProps> = ({
  isOpen,
  onClose,
  preferences,
  onChange,
  onReset,
  onSaveAsDefault,
  isMobile = false,
  activeRenderer,
  isMapboxAvailable = true,
  tripId,
}) => {
  const { t } = useTranslation('common');
  const [activeTab, setActiveTab] = useState<TabKey>('basemap');
  const [didCopyPreset, setDidCopyPreset] = useState(false);
  const [didSaveDefault, setDidSaveDefault] = useState(false);

  const isMapboxActive = activeRenderer === 'mapbox';

  const key = useCallback(
    (suffix: string, fallback: string) => t(`tripView.mapCustomize.${suffix}`, fallback),
    [t],
  );

  /**
   * Tracked changes. Sliders call `onChange` directly instead: a drag fires a
   * change per pixel, and one analytics event each would drown the surface.
   */
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

  const styleLabels = useMemo<Record<MapStyle, string>>(() => ({
    standard: key('style.standard', 'Standard'),
    minimal: key('style.minimal', 'Minimal'),
    clean: key('style.clean', 'Clean'),
    dark: key('style.dark', 'Dark'),
    cleanDark: key('style.cleanDark', 'Clean dark'),
    satellite: key('style.satellite', 'Satellite'),
  }), [key]);

  const tabLabels = useMemo<Record<TabKey, string>>(() => ({
    basemap: key('tab.basemap', 'Basemap'),
    journey: key('tab.journey', 'Journey'),
    places: key('tab.places', 'Places'),
    camera: key('tab.camera', 'Camera'),
  }), [key]);

  const body = (
    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabKey)}>
      <TabsList className="w-full">
        {TAB_ORDER.map((tab) => (
          <TabsTrigger key={tab} value={tab} className="flex-1">
            {tabLabels[tab]}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="basemap">
        <SettingsPanel>
          <SettingsSection>
            <SettingsRow
              label={key('renderer.label', 'Map provider')}
              description={key('renderer.description', 'Which map the app draws.')}
              note={preferences.renderer === 'mapbox' && !isMapboxAvailable
                ? key('renderer.mapboxUnavailable', 'Mapbox is not configured here, so Google is being used.')
                : undefined}
            >
              <Select
                value={preferences.renderer}
                onValueChange={(value) => handleChange({ renderer: value as ResolvedMapPreferences['renderer'] })}
              >
                <SelectTrigger className="w-full" aria-label={key('renderer.label', 'Map provider')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">{key('renderer.auto', 'Automatic')}</SelectItem>
                  <SelectItem value="google">{key('renderer.google', 'Google Maps')}</SelectItem>
                  <SelectItem value="mapbox">{key('renderer.mapbox', 'Mapbox')}</SelectItem>
                </SelectContent>
              </Select>
            </SettingsRow>

            <SettingsRow
              label={key('handoff.label', 'Open places in')}
              description={key('handoff.description', 'Which app the "open in maps" links use.')}
              note={key('handoff.appleNote', 'Apple Maps cannot be drawn inside the app, so it opens in the Apple Maps app.')}
            >
              <Select
                value={preferences.handoffTarget}
                onValueChange={(value) => handleChange({ handoffTarget: value as ResolvedMapPreferences['handoffTarget'] })}
              >
                <SelectTrigger className="w-full" aria-label={key('handoff.label', 'Open places in')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="google">{key('handoff.google', 'Google Maps')}</SelectItem>
                  <SelectItem value="apple">{key('handoff.apple', 'Apple Maps')}</SelectItem>
                </SelectContent>
              </Select>
            </SettingsRow>

            <SettingsRow
              label={key('style.label', 'Map style')}
              layout="stacked"
            >
              <div className="grid w-full grid-cols-3 gap-2">
                {MAP_STYLE_ORDER.map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => handleChange({ mapStyle: style })}
                    aria-pressed={preferences.mapStyle === style}
                    className={`rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                      preferences.mapStyle === style
                        ? 'border-accent-400 bg-accent-50 text-accent-700'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-accent-300 hover:bg-accent-50/50'
                    }`}
                    {...getAnalyticsDebugAttributes('trip_view__map_customize--style', {
                      surface: 'map_customize',
                      style,
                    })}
                  >
                    {styleLabels[style]}
                  </button>
                ))}
              </div>
            </SettingsRow>

            <SettingsRow
              label={key('theme.label', 'Light or dark')}
              description={key('theme.description', 'Automatic follows your device.')}
            >
              <Select
                value={preferences.themeMode}
                onValueChange={(value) => handleChange({ themeMode: value as ResolvedMapPreferences['themeMode'] })}
              >
                <SelectTrigger className="w-full" aria-label={key('theme.label', 'Light or dark')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">{key('theme.auto', 'Automatic')}</SelectItem>
                  <SelectItem value="light">{key('theme.light', 'Light')}</SelectItem>
                  <SelectItem value="dark">{key('theme.dark', 'Dark')}</SelectItem>
                </SelectContent>
              </Select>
            </SettingsRow>
          </SettingsSection>
        </SettingsPanel>
      </TabsContent>

      <TabsContent value="journey">
        <SettingsPanel>
          <SettingsSection>
            <SettingsRow
              label={key('routeMode.label', 'Route lines')}
              description={key('routeMode.description', 'Realistic follows roads; simple draws a direct line.')}
            >
              <Select
                value={preferences.routeMode}
                onValueChange={(value) => handleChange({ routeMode: value as ResolvedMapPreferences['routeMode'] })}
              >
                <SelectTrigger className="w-full" aria-label={key('routeMode.label', 'Route lines')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simple">{key('routeMode.simple', 'Simple')}</SelectItem>
                  <SelectItem value="realistic">{key('routeMode.realistic', 'Realistic')}</SelectItem>
                </SelectContent>
              </Select>
            </SettingsRow>

            <SettingsRow
              label={key('colorMode.label', 'Line colour')}
              description={key('colorMode.description', 'Match each city, or use one accent throughout.')}
            >
              <Select
                value={preferences.colorMode}
                onValueChange={(value) => handleChange({ colorMode: value as ResolvedMapPreferences['colorMode'] })}
              >
                <SelectTrigger className="w-full" aria-label={key('colorMode.label', 'Line colour')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trip">{key('colorMode.trip', 'City colours')}</SelectItem>
                  <SelectItem value="brand">{key('colorMode.brand', 'Single accent')}</SelectItem>
                </SelectContent>
              </Select>
            </SettingsRow>

            <SettingsRow
              label={key('lineWeight.label', 'Line thickness')}
              layout="stacked"
              note={`${preferences.routeLineWeight.toFixed(2)}×`}
            >
              <Slider
                value={[preferences.routeLineWeight]}
                min={MAP_ROUTE_LINE_WEIGHT_RANGE.min}
                max={MAP_ROUTE_LINE_WEIGHT_RANGE.max}
                step={0.05}
                aria-label={key('lineWeight.label', 'Line thickness')}
                onValueChange={([value]) => onChange({ routeLineWeight: value })}
              />
            </SettingsRow>
          </SettingsSection>
        </SettingsPanel>
      </TabsContent>

      <TabsContent value="places">
        <SettingsPanel>
          <SettingsSection>
            <SettingsRow
              label={key('cityNames.label', 'City names')}
              description={key('cityNames.description', 'Label each stop on the map.')}
            >
              <Switch
                checked={preferences.showCityNames}
                onCheckedChange={(checked) => handleChange({ showCityNames: checked })}
                aria-label={key('cityNames.label', 'City names')}
              />
            </SettingsRow>

            <SettingsRow
              label={key('activityMarkers.label', 'Activity pins')}
              description={key('activityMarkers.description', 'Show your planned places once the map is close enough.')}
            >
              <Switch
                checked={preferences.showActivityMarkers}
                onCheckedChange={(checked) => handleChange({ showActivityMarkers: checked })}
                aria-label={key('activityMarkers.label', 'Activity pins')}
              />
            </SettingsRow>

            <SettingsRow
              label={key('poiLabels.label', 'Points of interest')}
              description={key('poiLabels.description', "Shops, landmarks and other places you have not planned.")}
            >
              <Switch
                checked={preferences.showPoiLabels}
                onCheckedChange={(checked) => handleChange({ showPoiLabels: checked })}
                aria-label={key('poiLabels.label', 'Points of interest')}
              />
            </SettingsRow>

            <SettingsRow
              label={key('roads.label', 'Roads and transit')}
              description={key('roads.description', 'Turn off for a cleaner map of just your trip.')}
            >
              <Switch
                checked={preferences.showRoadsAndTransit}
                onCheckedChange={(checked) => handleChange({ showRoadsAndTransit: checked })}
                aria-label={key('roads.label', 'Roads and transit')}
              />
            </SettingsRow>

            <SettingsRow
              label={key('boundaries.label', 'Region borders')}
              description={key('boundaries.description', 'Borders within a country, not just between them.')}
            >
              <Switch
                checked={preferences.showAdminBoundaries}
                onCheckedChange={(checked) => handleChange({ showAdminBoundaries: checked })}
                aria-label={key('boundaries.label', 'Region borders')}
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
              label={key('globe.label', 'Globe view')}
              description={key('globe.description', 'Curves the world. Best on a long trip and a large map.')}
              note={isMapboxActive ? undefined : key('mapboxOnly', 'Available with Mapbox.')}
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
              note={isMapboxActive ? undefined : key('mapboxOnly', 'Available with Mapbox.')}
            >
              <Switch
                checked={preferences.showTerrain}
                disabled={!isMapboxActive}
                onCheckedChange={(checked) => handleChange({ showTerrain: checked })}
                aria-label={key('terrain.label', 'Terrain')}
              />
            </SettingsRow>

            <SettingsRow
              label={key('pitch.label', 'Tilt')}
              layout="stacked"
              note={isMapboxActive
                ? `${Math.round(preferences.pitch)}°`
                : key('mapboxOnly', 'Available with Mapbox.')}
            >
              <Slider
                value={[preferences.pitch]}
                min={MAP_PITCH_RANGE.min}
                max={MAP_PITCH_RANGE.max}
                step={1}
                disabled={!isMapboxActive}
                aria-label={key('pitch.label', 'Tilt')}
                onValueChange={([value]) => onChange({ pitch: value })}
              />
            </SettingsRow>
          </SettingsSection>
        </SettingsPanel>
      </TabsContent>
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
          {didCopyPreset ? key('copied', 'Copied') : key('copyPreset', 'Copy preset')}
        </Button>
        {onSaveAsDefault && (
          <Button type="button" variant="default" size="sm" onClick={handleSaveAsDefault}>
            {didSaveDefault ? <Check size={15} /> : <Star size={15} />}
            {didSaveDefault ? key('saved', 'Saved') : key('saveAsDefault', 'Save as my default')}
          </Button>
        )}
      </div>
    </div>
  );

  const title = key('title', 'Customize map');
  const description = key('description', 'Changes apply straight away and are kept with this trip.');

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }} modal={false}>
        <DrawerContent
          hideOverlay
          accessibleTitle={title}
          accessibleDescription={description}
          className="max-h-[62vh]"
          data-testid="map-customize-sheet"
        >
          <div className="flex max-h-[58vh] flex-col overflow-y-auto px-4 pb-4 pt-2">
            <h2 className="pb-2 text-base font-semibold text-slate-900">{title}</h2>
            {body}
          </div>
          <div className="border-t border-slate-200 px-4 py-3">{footer}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      size="lg"
      footer={footer}
      contentClassName="max-h-[82vh]"
    >
      <div data-testid="map-customize-modal">{body}</div>
    </AppModal>
  );
};

export const MAP_CUSTOMIZE_DEFAULTS = DEFAULT_MAP_PREFERENCES;
