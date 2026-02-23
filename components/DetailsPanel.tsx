import React, { Suspense, lazy, useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ITimelineItem, TransportMode, ActivityType, IHotel, RouteMode, ICoordinates } from '../types';
import { X, MapPin, Clock, Trash2, Hotel, Search, AlertTriangle, ExternalLink, Sparkles, RefreshCw, Maximize, Minimize, Minus, Plus, Palette, Pencil } from 'lucide-react';
import type { CityNotesEnhancementMode } from '../services/aiService';
import { HexColorPicker } from 'react-colorful';
import { ALL_ACTIVITY_TYPES, TRAVEL_COLOR, addDays, applyCityPaletteToItems, CITY_COLOR_PALETTES, DEFAULT_CITY_COLOR_PALETTE_ID, formatDate, getContrastTextColor, getHexFromColorClass, getStoredAppLanguage, getActivityColorByTypes, getCityColorPalette, isTailwindCityColorValue, normalizeActivityTypes, normalizeCityColorInput, DEFAULT_DISTANCE_UNIT, estimateTravelHours, formatDistance, formatDurationHours, getTravelLegMetricsForItem, getNormalizedCityName, COUNTRIES, shiftHexColor } from '../utils';
import { useGoogleMaps } from './GoogleMapsLoader';
import type { MarkdownAiAction } from './MarkdownEditor';
import { ActivityTypeIcon, formatActivityTypeLabel, getActivityTypeButtonClass } from './ActivityTypeVisuals';
import { TransportModeIcon } from './TransportModeIcon';
import { useAppDialog } from './AppDialogProvider';
import { normalizeTransportMode, TRANSPORT_MODE_UI_ORDER } from '../shared/transportModes';
import { FlagIcon } from './flags/FlagIcon';
import { Switch } from './ui/switch';
import { loadLazyComponentWithRecovery } from '../services/lazyImportRecovery';

interface DetailsPanelProps {
  item: ITimelineItem | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<ITimelineItem>) => void;
  onBatchUpdate?: (
      changes: Array<{ id: string; updates: Partial<ITimelineItem> }>,
      options?: { label?: string; deferCommit?: boolean; skipPendingLabel?: boolean }
  ) => void;
  onDelete: (id: string) => void;
  tripStartDate: string;
  tripItems?: ITimelineItem[];
  routeMode?: RouteMode;
  routeStatus?: 'calculating' | 'ready' | 'failed' | 'idle';
  onForceFill?: (id: string) => void;
  forceFillMode?: 'stretch' | 'shrink';
  forceFillLabel?: string;
  variant?: 'overlay' | 'sidebar'; // New Prop
  readOnly?: boolean;
  cityColorPaletteId?: string;
  onCityColorPaletteChange?: (paletteId: string, options: { applyToCities: boolean }) => void;
}

interface PendingCityNotesProposal {
    actionLabel: string;
    addition: string;
}

interface DurationDraft {
    startDateOffset: number;
    duration: number;
}

interface CityDraft {
    location: string;
    title: string;
    coordinates?: ICoordinates;
    countryName?: string;
    countryCode?: string;
}

interface HotelSearchResult {
    id: string;
    name: string;
    address: string;
}

const CITY_NOTES_AI_ACTIONS: MarkdownAiAction[] = [
    {
        id: 'expand-checklists',
        label: 'Extend Must See/Try/Do',
        description: 'Adds fresh checkbox ideas for attractions, food, and activities.'
    },
    {
        id: 'local-tips',
        label: 'Add practical local tips',
        description: 'Adds transport, timing, reservation, and safety/crowd tips.'
    },
    {
        id: 'day-plan',
        label: 'Add day-plan ideas',
        description: 'Adds lightweight morning/afternoon/evening checklist ideas.'
    }
];

type AiServiceModule = typeof import('../services/aiService');
let aiServicePromise: Promise<AiServiceModule> | null = null;

const LazyMarkdownEditor = lazy(() =>
    loadLazyComponentWithRecovery('MarkdownEditor', () =>
        import('./MarkdownEditor').then((module) => ({ default: module.MarkdownEditor }))
    )
);

const loadAiService = async (): Promise<AiServiceModule> => {
    if (!aiServicePromise) {
        aiServicePromise = import('../services/aiService');
    }
    return aiServicePromise;
};

const EMPTY_TRIP_ITEMS: ITimelineItem[] = [];

const appendNotes = (existing: string, addition: string): string => {
    const trimmedExisting = existing.trim();
    const trimmedAddition = addition.trim();

    if (!trimmedAddition) return existing;
    if (!trimmedExisting) return trimmedAddition;
    return `${existing.trimEnd()}\n\n${trimmedAddition}`;
};

const getCountryFromText = (text?: string): { countryName?: string; countryCode?: string } => {
    if (!text) return {};
    const parts = text.split(',').map(part => part.trim()).filter(Boolean);
    if (parts.length < 2) return {};
    const rawCountry = parts[parts.length - 1];
    const matched = COUNTRIES.find(country => country.name.toLocaleLowerCase() === rawCountry.toLocaleLowerCase());
    if (!matched) return {};
    return {
        countryName: matched.name,
        countryCode: matched.code,
    };
};

const getCityNameFromText = (text: string): string => {
    const firstPart = text.split(',')[0]?.trim();
    return firstPart || text.trim();
};

export const DetailsPanel: React.FC<DetailsPanelProps> = ({ 
    item, 
    isOpen, 
    onClose, 
    onUpdate, 
    onBatchUpdate,
    onDelete, 
    tripStartDate, 
    tripItems = EMPTY_TRIP_ITEMS,
    routeMode = 'simple',
    routeStatus,
    onForceFill,
    forceFillMode,
    forceFillLabel,
    variant = 'overlay',
    readOnly = false,
    cityColorPaletteId = DEFAULT_CITY_COLOR_PALETTE_ID,
    onCityColorPaletteChange
}) => {
  const canEdit = !readOnly;
  const [loading, setLoading] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [pendingNotesProposal, setPendingNotesProposal] = useState<PendingCityNotesProposal | null>(null);
  const initialCachedItemRef = useRef<ITimelineItem | null>(item);
  const [cachedItem, setCachedItem] = useState<ITimelineItem | null>(initialCachedItemRef.current);
  const [isDurationEditorOpen, setIsDurationEditorOpen] = useState(false);
  const [durationDraft, setDurationDraft] = useState<DurationDraft | null>(null);
  const [isCityEditorOpen, setIsCityEditorOpen] = useState(false);
  const [cityDraft, setCityDraft] = useState<CityDraft | null>(null);
  const [cityInputValue, setCityInputValue] = useState('');
  const [citySearchError, setCitySearchError] = useState<string | null>(null);
  const cityInputRef = useRef<HTMLInputElement>(null);
  const cityAutocompleteRef = useRef<any>(null);
  const lastItemIdRef = useRef<string | null>(item?.id || null);
  const durationBaselineRef = useRef<DurationDraft | null>(null);
  const cityBaselineRef = useRef<CityDraft | null>(null);
  const cityRoundTripContextRef = useRef<{ isRoundTrip: boolean; isFirstCity: boolean; lastCityId: string | null } | null>(null);

  // Search State for Hotels
  const [hotelQuery, setHotelQuery] = useState('');
  const [isSearchingHotels, setIsSearchingHotels] = useState(false);
  const [hotelResults, setHotelResults] = useState<HotelSearchResult[]>([]);
  
  // Places Service
  const [placesService, setPlacesService] = useState<any>(null);
  const placesServiceDivRef = useRef<HTMLDivElement>(null);
  const [apiKeyError, setApiKeyError] = useState(false);

  // Custom Drawer State
  const initialRenderedRef = useRef(isOpen);
  const [isRendered, setIsRendered] = useState(initialRenderedRef.current);
  const [isVisible, setIsVisible] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef<number | null>(null);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [customColorHex, setCustomColorHex] = useState('#4f46e5');
  const [customColorInput, setCustomColorInput] = useState('#4F46E5');
  const [customColorError, setCustomColorError] = useState<string | null>(null);

  const { isLoaded } = useGoogleMaps();
  const { confirm: confirmDialog } = useAppDialog();
  const mapLanguage = getStoredAppLanguage();

  const applyItemChanges = (
      changes: Array<{ id: string; updates: Partial<ITimelineItem> }>,
      options?: { label?: string; deferCommit?: boolean; skipPendingLabel?: boolean }
  ) => {
      if (!canEdit || changes.length === 0) return;
      if (changes.length === 1 && !onBatchUpdate) {
          if (options?.deferCommit) return;
          onUpdate(changes[0].id, changes[0].updates);
          return;
      }
      if (onBatchUpdate) {
          onBatchUpdate(changes, options);
          return;
      }
      changes.forEach(change => onUpdate(change.id, change.updates));
  };

  const closeDurationEditor = (options?: { revertPreview?: boolean }) => {
      if (options?.revertPreview !== false && displayItem?.type === 'city' && durationBaselineRef.current) {
          applyItemChanges(
              [{
                  id: displayItem.id,
                  updates: {
                      startDateOffset: durationBaselineRef.current.startDateOffset,
                      duration: durationBaselineRef.current.duration,
                  },
              }],
              { deferCommit: true, skipPendingLabel: true }
          );
      }
      setIsDurationEditorOpen(false);
      setDurationDraft(null);
      durationBaselineRef.current = null;
  };

  const closeCityEditor = (_options?: { revertPreview?: boolean }) => {
      setIsCityEditorOpen(false);
      setCityDraft(null);
      setCityInputValue('');
      setCitySearchError(null);
      cityAutocompleteRef.current = null;
      cityBaselineRef.current = null;
      cityRoundTripContextRef.current = null;
  };

  const discardDraftEdits = () => {
      closeDurationEditor();
      closeCityEditor();
      setIsColorPickerOpen(false);
  };

  const handleClosePanel = () => {
      discardDraftEdits();
      onClose();
  };

  // Initialize Google Places Service (TextSearch)
  useEffect(() => {
    if (!isOpen && variant === 'overlay') return;
    if (!item && variant === 'sidebar') return; 
    
    setApiKeyError(false);

    if (isLoaded && (window as any).google?.maps?.places && placesServiceDivRef.current) {
        try {
            // PlacesService requires a Map or an HTML Element (hidden div works)
            const service = new (window as any).google.maps.places.PlacesService(placesServiceDivRef.current);
            setPlacesService(service);
        } catch (e) {
            console.error("Places Service Init Failed", e);
            setApiKeyError(true);
        }
    }
  }, [isOpen, item, variant, isLoaded]);

  // Handle Mount/Unmount Animation for Overlay
  useEffect(() => {
    if (variant === 'sidebar') {
        setIsRendered(!!item);
        setIsVisible(!!item);
        return;
    }

    let rafId: number;
    let timerId: ReturnType<typeof setTimeout>;

    if (isOpen) {
        setIsRendered(true);
        rafId = requestAnimationFrame(() => setIsVisible(true));
    } else {
        setIsVisible(false);
        setIsColorPickerOpen(false); 
        setIsDurationEditorOpen(false);
        setDurationDraft(null);
        setIsCityEditorOpen(false);
        setCityDraft(null);
        setCityInputValue('');
        setCitySearchError(null);
        durationBaselineRef.current = null;
        cityBaselineRef.current = null;
        cityRoundTripContextRef.current = null;
        timerId = setTimeout(() => {
            setIsRendered(false);
            setDragOffset(0);
        }, 300);
    }

    return () => {
        if (rafId) cancelAnimationFrame(rafId);
        if (timerId) clearTimeout(timerId);
    };
  }, [isOpen, item, variant]);

  // Handle Escape Key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (isOpen && e.key === 'Escape') {
            if (isColorPickerOpen) {
                e.preventDefault();
                e.stopImmediatePropagation();
                setIsColorPickerOpen(false);
                return;
            }
            if (isDurationEditorOpen) {
                e.preventDefault();
                e.stopImmediatePropagation();
                closeDurationEditor();
                return;
            }
            if (isCityEditorOpen) {
                e.preventDefault();
                e.stopImmediatePropagation();
                closeCityEditor();
                return;
            }
            e.preventDefault();
            e.stopImmediatePropagation();
            handleClosePanel();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isColorPickerOpen, isDurationEditorOpen, isCityEditorOpen, onClose, closeDurationEditor, closeCityEditor, handleClosePanel]);

  // Cache Item logic
  useEffect(() => {
    if (!item) {
        lastItemIdRef.current = null;
        return;
    }

    const switchedItem = lastItemIdRef.current !== item.id;
    setCachedItem(item);

    if (switchedItem) {
        setHotelQuery('');
        setHotelResults([]);
        setIsColorPickerOpen(false);
        setIsDurationEditorOpen(false);
        setDurationDraft(null);
        setIsCityEditorOpen(false);
        setCityDraft(null);
        setCityInputValue('');
        setCitySearchError(null);
        durationBaselineRef.current = null;
        cityBaselineRef.current = null;
        cityRoundTripContextRef.current = null;
        setAiStatus(null);
        setAiError(null);
        setPendingNotesProposal(null);
    }

    lastItemIdRef.current = item.id;
  }, [item]);

  useEffect(() => {
      if (!isCityEditorOpen) return;
      if (!isLoaded || !cityInputRef.current || !(window as any).google?.maps?.places) return;

      let listener: { remove: () => void } | null = null;

      try {
          const autocomplete = new (window as any).google.maps.places.Autocomplete(cityInputRef.current, {
              types: ['(cities)'],
              fields: ['geometry', 'name', 'formatted_address'],
          });
          cityAutocompleteRef.current = autocomplete;

          listener = autocomplete.addListener('place_changed', () => {
              const place = autocomplete.getPlace();
              if (!place) return;
              const name = place.name || place.formatted_address?.split(',')[0] || cityInputRef.current?.value || '';
              const geometry = place.geometry?.location;
              const coordinates = geometry
                  ? { lat: geometry.lat(), lng: geometry.lng() }
                  : undefined;
              const parsedCountry = getCountryFromText(place.formatted_address || '');
              const nextDraft = buildCityDraft(name, {
                  coordinates,
                  countryName: parsedCountry.countryName,
                  countryCode: parsedCountry.countryCode,
              });

              setCityInputValue(name);
              setCityDraft(nextDraft);
              setCitySearchError(null);
          });
      } catch (error) {
          console.error('City autocomplete init failed', error);
          setCitySearchError('City search is unavailable. You can still type manually.');
      }

      return () => {
          if (listener) listener.remove();
          cityAutocompleteRef.current = null;
      };
  }, [isCityEditorOpen, isLoaded]);

  useEffect(() => {
      if (!aiStatus || isEnhancing) return;
      const timer = setTimeout(() => setAiStatus(null), 5000);
      return () => clearTimeout(timer);
  }, [aiStatus, isEnhancing]);

  const displayItem = item || cachedItem;

  useEffect(() => {
      if (!displayItem || displayItem.type !== 'city') return;
      const nextHex = getHexFromColorClass(displayItem.color || '');
      setCustomColorHex(nextHex);
      setCustomColorInput(nextHex.toUpperCase());
      setCustomColorError(null);
  }, [displayItem?.id, displayItem?.type, displayItem?.color]);

  const handleUpdate = (id: string, updates: Partial<ITimelineItem>) => {
      if (!canEdit) return;
      onUpdate(id, updates);
  };

  const handleDeleteItem = (id: string) => {
      if (!canEdit) return;
      onDelete(id);
  };

  const sortedCityItems = React.useMemo(
      () => tripItems
          .filter(entry => entry.type === 'city')
          .sort((a, b) => a.startDateOffset - b.startDateOffset),
      [tripItems]
  );
  const handleSetItemApproved = (checked: boolean) => {
      if (!canEdit || !displayItem) return;

      if (displayItem.type === 'city') {
          if (checked) {
              handleUpdate(displayItem.id, {
                  isApproved: true,
                  cityPlanStatus: 'confirmed',
              });
              return;
          }

          const normalizedStart = Number(displayItem.startDateOffset.toFixed(3));
          const defaultGroupId = `city-option-${normalizedStart}`;
          const nextGroupId = displayItem.cityPlanGroupId || defaultGroupId;
          const siblingOptionIndexes = sortedCityItems
              .filter(entry =>
                  entry.id !== displayItem.id
                  && entry.cityPlanStatus === 'uncertain'
                  && entry.cityPlanGroupId === nextGroupId
              )
              .map(entry => (
                  typeof entry.cityPlanOptionIndex === 'number' && Number.isFinite(entry.cityPlanOptionIndex)
                      ? Number(entry.cityPlanOptionIndex)
                      : -1
              ));
          const existingOptionIndex = (typeof displayItem.cityPlanOptionIndex === 'number' && Number.isFinite(displayItem.cityPlanOptionIndex))
              ? Number(displayItem.cityPlanOptionIndex)
              : undefined;
          const nextOptionIndex = existingOptionIndex !== undefined
              ? Math.max(0, Math.floor(existingOptionIndex))
              : (Math.max(-1, ...siblingOptionIndexes) + 1);

          handleUpdate(displayItem.id, {
              isApproved: false,
              cityPlanStatus: 'uncertain',
              cityPlanGroupId: nextGroupId,
              cityPlanOptionIndex: nextOptionIndex,
          });
          return;
      }

      if (displayItem.type === 'activity') {
          handleUpdate(displayItem.id, {
              isApproved: checked,
          });
      }
  };
  const firstCityItem = sortedCityItems[0] || null;
  const lastCityItem = sortedCityItems.length > 1 ? sortedCityItems[sortedCityItems.length - 1] : null;
  const isRoundTripSequence = !!(
      firstCityItem &&
      lastCityItem &&
      getNormalizedCityName(firstCityItem.title || firstCityItem.location) ===
          getNormalizedCityName(lastCityItem.title || lastCityItem.location)
  );
  const isEditingFirstCity = !!(displayItem && displayItem.type === 'city' && firstCityItem && displayItem.id === firstCityItem.id);

  const areCoordinatesEqual = (a?: ICoordinates, b?: ICoordinates): boolean => {
      if (!a && !b) return true;
      if (!a || !b) return false;
      return Math.abs(a.lat - b.lat) < 0.000001 && Math.abs(a.lng - b.lng) < 0.000001;
  };

  const areCityDraftEqual = (a: CityDraft, b: CityDraft): boolean => {
      return (
          getNormalizedCityName(a.location) === getNormalizedCityName(b.location) &&
          getNormalizedCityName(a.title) === getNormalizedCityName(b.title) &&
          (a.countryName || '') === (b.countryName || '') &&
          (a.countryCode || '') === (b.countryCode || '') &&
          areCoordinatesEqual(a.coordinates, b.coordinates)
      );
  };

  const buildCityDraft = (
      location: string,
      options?: Partial<Pick<CityDraft, 'coordinates' | 'countryName' | 'countryCode' | 'title'>>
  ): CityDraft => {
      const locationValue = location.trim();
      const parsedCountry = getCountryFromText(locationValue);
      return {
          location: locationValue,
          title: (options?.title || getCityNameFromText(locationValue || options?.title || '')).trim() || locationValue,
          coordinates: options?.coordinates,
          countryName: options?.countryName ?? parsedCountry.countryName,
          countryCode: options?.countryCode ?? parsedCountry.countryCode,
      };
  };

  const resolveCityApplyPayload = (cityItem: ITimelineItem, draft: CityDraft): Partial<ITimelineItem> => {
      const normalizedCurrent = getNormalizedCityName(cityItem.location || cityItem.title);
      const normalizedNext = getNormalizedCityName(draft.location || draft.title);
      const cityChanged = normalizedCurrent !== normalizedNext;

      return {
          title: draft.title || getCityNameFromText(draft.location || cityItem.title),
          location: draft.location || cityItem.location || cityItem.title,
          coordinates: draft.coordinates ?? (cityChanged ? undefined : cityItem.coordinates),
          countryName: draft.countryName ?? (cityChanged ? undefined : cityItem.countryName),
          countryCode: draft.countryCode ?? (cityChanged ? undefined : cityItem.countryCode),
      };
  };

  const applyDurationPreview = (next: DurationDraft) => {
      if (!displayItem || displayItem.type !== 'city') return;
      applyItemChanges(
          [{ id: displayItem.id, updates: { startDateOffset: next.startDateOffset, duration: next.duration } }],
          { deferCommit: true, skipPendingLabel: true }
      );
  };

  const openDurationEditor = () => {
      if (!canEdit || !displayItem || displayItem.type !== 'city') return;
      closeCityEditor();
      durationBaselineRef.current = {
          startDateOffset: displayItem.startDateOffset,
          duration: displayItem.duration,
      };
      setIsDurationEditorOpen(true);
      setDurationDraft({
          startDateOffset: displayItem.startDateOffset,
          duration: displayItem.duration,
      });
  };

  const updateDurationStartDraft = (delta: number) => {
      setDurationDraft(prev => {
          if (!prev) return prev;
          const next = {
              startDateOffset: prev.startDateOffset + delta,
              duration: Math.max(0.5, prev.duration - delta),
          };
          applyDurationPreview(next);
          return next;
      });
  };

  const updateDurationEndDraft = (delta: number) => {
      setDurationDraft(prev => {
          if (!prev) return prev;
          const next = {
              ...prev,
              duration: Math.max(0.5, prev.duration + delta),
          };
          applyDurationPreview(next);
          return next;
      });
  };

  const handleForceFillDraft = () => {
      if (!displayItem || displayItem.type !== 'city') return;
      const cityItems = sortedCityItems;
      const targetIndex = cityItems.findIndex(entry => entry.id === displayItem.id);
      if (targetIndex === -1) return;

      const targetCity = cityItems[targetIndex];
      const prevCity = targetIndex > 0 ? cityItems[targetIndex - 1] : null;
      const nextCity = targetIndex < cityItems.length - 1 ? cityItems[targetIndex + 1] : null;

      const prevEnd = prevCity ? prevCity.startDateOffset + prevCity.duration : 0;
      const newStart = prevCity ? prevEnd : 0;
      let newDuration = targetCity.duration;

      if (nextCity) {
          const availableDuration = nextCity.startDateOffset - newStart;
          newDuration = Math.max(0.5, availableDuration);
      }

      const nextDraft = {
          startDateOffset: newStart,
          duration: Math.max(0.5, newDuration),
      };
      setDurationDraft(nextDraft);
      applyDurationPreview(nextDraft);
  };

  const handleApplyDurationEdit = () => {
      if (!canEdit || !displayItem || displayItem.type !== 'city' || !durationDraft) return;
      const baseline = durationBaselineRef.current;
      if (!baseline) {
          closeDurationEditor({ revertPreview: false });
          return;
      }
      const hasChange =
          Math.abs(durationDraft.startDateOffset - baseline.startDateOffset) > 0.001 ||
          Math.abs(durationDraft.duration - baseline.duration) > 0.001;
      if (hasChange) {
          applyItemChanges(
              [{ id: displayItem.id, updates: { startDateOffset: durationDraft.startDateOffset, duration: durationDraft.duration } }],
              { label: `Data: Changed city duration in ${displayItem.title}` }
          );
      }
      closeDurationEditor({ revertPreview: false });
  };

  const openCityEditor = () => {
      if (!canEdit || !displayItem || displayItem.type !== 'city') return;
      closeDurationEditor({ revertPreview: true });
      const baseLocation = displayItem.location || displayItem.title;
      const baselineDraft = buildCityDraft(baseLocation, {
          title: displayItem.title,
          coordinates: displayItem.coordinates,
          countryName: displayItem.countryName,
          countryCode: displayItem.countryCode,
      });
      cityBaselineRef.current = baselineDraft;
      cityRoundTripContextRef.current = {
          isRoundTrip: isRoundTripSequence,
          isFirstCity: isEditingFirstCity,
          lastCityId: lastCityItem?.id || null,
      };
      setIsCityEditorOpen(true);
      setCityDraft(baselineDraft);
      setCityInputValue(baseLocation);
      setCitySearchError(null);
      window.setTimeout(() => cityInputRef.current?.focus(), 30);
  };

  const hasCityUpdateChanges = (cityItem: ITimelineItem, updates: Partial<ITimelineItem>): boolean => {
      if (updates.title !== undefined && updates.title !== cityItem.title) return true;
      if (updates.location !== undefined && updates.location !== cityItem.location) return true;
      if (updates.countryName !== undefined && updates.countryName !== cityItem.countryName) return true;
      if (updates.countryCode !== undefined && updates.countryCode !== cityItem.countryCode) return true;
      if (!areCoordinatesEqual(cityItem.coordinates, updates.coordinates)) return true;
      return false;
  };

  const handleApplyCityEdit = async () => {
      if (!canEdit || !displayItem || displayItem.type !== 'city' || !cityDraft) return;
      const baseline = cityBaselineRef.current;
      if (!baseline) {
          closeCityEditor({ revertPreview: false });
          return;
      }
      const nextLocation = cityInputValue.trim() || cityDraft.location.trim();
      if (!nextLocation) {
          setCitySearchError('Please choose a city name.');
          return;
      }

      const normalizedCurrent = getNormalizedCityName(baseline.location || baseline.title);
      const normalizedNext = getNormalizedCityName(nextLocation);
      const isUnchanged = normalizedCurrent === normalizedNext;
      const nextDraft = buildCityDraft(nextLocation, {
          title: getCityNameFromText(nextLocation),
          coordinates: cityDraft.coordinates,
          countryName: cityDraft.countryName,
          countryCode: cityDraft.countryCode,
      });
      const changes: Array<{ id: string; updates: Partial<ITimelineItem> }> = [];
      const primaryUpdates = resolveCityApplyPayload(displayItem, nextDraft);
      if (!areCityDraftEqual(nextDraft, baseline) || hasCityUpdateChanges(displayItem, primaryUpdates)) {
          changes.push({ id: displayItem.id, updates: primaryUpdates });
      }

      const roundTripContext = cityRoundTripContextRef.current;
      if (roundTripContext?.isRoundTrip && roundTripContext.isFirstCity && roundTripContext.lastCityId && !isUnchanged) {
          const shouldSyncLastCity = await confirmDialog({
              title: 'Update Roundtrip Endpoint?',
              message: `This trip looks like a roundtrip. Also change the final city to "${nextDraft.title}"?`,
              confirmLabel: 'Yes, Update Last City',
              cancelLabel: 'No, Keep As Is',
          });
          if (shouldSyncLastCity) {
              const roundTripLastCity = tripItems.find(entry => entry.id === roundTripContext.lastCityId && entry.type === 'city') || null;
              if (roundTripLastCity && roundTripLastCity.id !== displayItem.id) {
                  const lastCityUpdates = resolveCityApplyPayload(roundTripLastCity, nextDraft);
                  if (hasCityUpdateChanges(roundTripLastCity, lastCityUpdates)) {
                      changes.push({
                          id: roundTripLastCity.id,
                          updates: lastCityUpdates,
                      });
                  }
              }
          }
      }

      if (changes.length === 0) {
          closeCityEditor({ revertPreview: false });
          return;
      }

      applyItemChanges(changes, {
          label: changes.length > 1
              ? `Data: Updated roundtrip city and title to ${nextDraft.title}`
              : `Data: Changed city and title to ${nextDraft.title}`,
      });
      closeCityEditor({ revertPreview: false });
  };

  const handleCityInputChange = (rawValue: string) => {
      const input = rawValue;
      const explicitCountry = getCountryFromText(input);
      setCityInputValue(input);
      setCityDraft(prev => {
          const previous = prev || buildCityDraft(displayItem?.location || displayItem?.title || input, {
              title: displayItem?.title || getCityNameFromText(input),
              coordinates: displayItem?.coordinates,
              countryName: displayItem?.countryName,
              countryCode: displayItem?.countryCode,
          });
          const isSameLocation = getNormalizedCityName(previous.location) === getNormalizedCityName(input);
          const next = buildCityDraft(input, {
              coordinates: isSameLocation ? previous.coordinates : undefined,
              countryName: explicitCountry.countryName ?? (isSameLocation ? previous.countryName : undefined),
              countryCode: explicitCountry.countryCode ?? (isSameLocation ? previous.countryCode : undefined),
          });
          return next;
      });
      setCitySearchError(null);
  };

  // -- Data Fetching & Helpers (Same as before) --
  const fetchDetails = async () => {
      if (!canEdit) return;
      if (!displayItem) return;
      setLoading(true);
      try {
          const aiService = await loadAiService();
          const details = await aiService.suggestActivityDetails(displayItem.title, displayItem.location || "");
          handleUpdate(displayItem.id, {
              aiInsights: { cost: details.cost, bestTime: details.bestTime, tips: details.tips },
          });
      } finally {
          setLoading(false);
      }
  };

  const handleEnhanceNotes = async (mode: CityNotesEnhancementMode) => {
      if (!canEdit) return;
      if (!displayItem) return;
      const action = CITY_NOTES_AI_ACTIONS.find((entry) => entry.id === mode);
      const actionLabel = action?.label || 'Enhance notes';

      setAiError(null);
      setAiStatus(`Generating: ${actionLabel}...`);
      setIsEnhancing(true);

      try {
          const aiService = await loadAiService();
          const addition = await aiService.generateCityNotesAddition(
              displayItem.location || displayItem.title,
              displayItem.description || '',
              mode
          );
          const trimmedAddition = addition.trim();

          if (!trimmedAddition) {
              setPendingNotesProposal(null);
              setAiStatus('No new suggestions were generated for your current notes.');
              return;
          }

          setPendingNotesProposal({
              actionLabel,
              addition: trimmedAddition,
          });
          setAiStatus('Draft ready. Review the preview and accept or decline.');
      } catch (error) {
          console.error('Failed to generate city note proposal', error);
          setAiError('AI request failed. Please try again.');
          setAiStatus(null);
      } finally {
          setIsEnhancing(false);
      }
  };

  const handleAcceptNotesProposal = () => {
      if (!canEdit) return;
      if (!displayItem || !pendingNotesProposal) return;
      const nextNotes = appendNotes(displayItem.description || '', pendingNotesProposal.addition);
      handleUpdate(displayItem.id, { description: nextNotes });
      setPendingNotesProposal(null);
      setAiError(null);
      setAiStatus('AI update applied to notes.');
  };

  const handleDeclineNotesProposal = () => {
      if (!canEdit) return;
      setPendingNotesProposal(null);
      setAiError(null);
      setAiStatus('Draft discarded.');
  };

  // Hotel & Link handlers...
  const addHotel = () => {
      if (!canEdit) return;
      if (!displayItem) return;
      const newHotel: IHotel = { id: `hotel-${Date.now()}`, name: '', address: '' };
      handleUpdate(displayItem.id, { hotels: [...(displayItem.hotels || []), newHotel] });
  };
  const updateHotel = (hotelId: string, updates: Partial<IHotel>) => {
      if (!canEdit) return;
      if (!displayItem?.hotels) return;
      handleUpdate(displayItem.id, { hotels: displayItem.hotels.map(h => h.id === hotelId ? { ...h, ...updates } : h) });
  };
  const removeHotel = (hotelId: string) => {
      if (!canEdit) return;
      if (!displayItem?.hotels) return;
      handleUpdate(displayItem.id, { hotels: displayItem.hotels.filter(h => h.id !== hotelId) });
  };
  
  const handleHotelSearch = () => {
      if (!hotelQuery || !displayItem || !placesService) return;
      setIsSearchingHotels(true);
      
      const searchString = `${hotelQuery} in ${displayItem.location || displayItem.title}`;
      
      try {
          const request = {
              query: searchString,
              type: 'lodging' as any // Forcing type to match API expectation
          };

          placesService.textSearch(request, (results: any[], status: any) => {
              setIsSearchingHotels(false);
              if (status === (window as any).google.maps.places.PlacesServiceStatus.OK && results) {
                  setHotelResults(results.map(p => ({ 
                      id: typeof p.place_id === 'string' && p.place_id.trim().length > 0
                          ? p.place_id
                          : `${p.name || 'hotel'}-${p.formatted_address || ''}`,
                      name: p.name || 'Hotel',
                      address: p.formatted_address || '',
                  })).slice(0, 5));
              } else {
                  setHotelResults([]);
              }
          });
      } catch (e) {
          console.error("Hotel search error", e);
          setIsSearchingHotels(false);
      }
  };
  
  const selectHotelResult = (result: HotelSearchResult) => {
      if (!canEdit) return;
      if (!displayItem) return;
      handleUpdate(displayItem.id, { hotels: [...(displayItem.hotels || []), { id: `hotel-${Date.now()}`, name: result.name, address: result.address }] });
      setHotelResults([]);
      setHotelQuery('');
  };
  const openExternalLink = (provider: 'gyg' | 'tripadvisor' | 'viator' | 'airbnb') => {
      if (!displayItem) return;
      const query = encodeURIComponent(`${displayItem.title} ${displayItem.location || ''}`);
      const itemStartDate = isValidDate ? addDays(new Date(tripStartDate), displayItem.startDateOffset) : new Date();
      const dateStr = isValidDate ? itemStartDate.toISOString().split('T')[0] : '';
      let url = '';
      if(provider === 'gyg') url = `https://www.getyourguide.com/s?q=${query}&date_from=${dateStr}`;
      if(provider === 'tripadvisor') url = `https://www.tripadvisor.com/Search?q=${query}`;
      if(provider === 'viator') url = `https://www.viator.com/searchResults/all?text=${query}`;
      if(provider === 'airbnb') url = `https://www.airbnb.com/s/${encodeURIComponent(displayItem.location || '')}/experiences?query=${encodeURIComponent(displayItem.title)}`;
      if (url) window.open(url, '_blank');
  };
  
  // Touch Handlers (Overlay Mobile)
  const handleTouchStart = (e: React.TouchEvent) => { if (variant === 'overlay' && window.innerWidth < 640) { dragStartY.current = e.touches[0].clientY; setIsDragging(true); }};
  const handleTouchMove = (e: React.TouchEvent) => { if (variant === 'overlay' && window.innerWidth < 640 && dragStartY.current !== null) { const delta = e.touches[0].clientY - dragStartY.current; if (delta > 0) setDragOffset(delta); }};
  const handleTouchEnd = () => { if (variant === 'overlay' && window.innerWidth < 640) { setIsDragging(false); dragStartY.current = null; if (dragOffset > 100) handleClosePanel(); else setDragOffset(0); }};


  if (!isRendered || !displayItem) return null;

  const isTransport = displayItem.type === 'travel' || displayItem.type === 'travel-empty';
  const isActivity = displayItem.type === 'activity';
  const isCity = displayItem.type === 'city';
  const aiDetails = displayItem.aiInsights;
  const proposedNotesPreview = pendingNotesProposal
      ? appendNotes(displayItem.description || '', pendingNotesProposal.addition)
      : '';
  
  // Logic Vars
  let selectedActivityTypes: ActivityType[] = [];
  if (isActivity) selectedActivityTypes = normalizeActivityTypes(displayItem.activityType);
  const toggleActivityType = (type: ActivityType) => {
      if (!canEdit) return;
      let newTypes = [...selectedActivityTypes];
      if (newTypes.includes(type)) {
          if (newTypes.length > 1) {
              newTypes = newTypes.filter(t => t !== type);
          }
      } else {
          newTypes.push(type);
      }
      const normalizedTypes = normalizeActivityTypes(newTypes);
      handleUpdate(displayItem.id, { activityType: normalizedTypes, color: getActivityColorByTypes(normalizedTypes) });
  };
  const handleTransportConvert = (mode: TransportMode) => {
      if (!canEdit) return;
      handleUpdate(displayItem.id, { type: 'travel', transportMode: mode, title: `${mode.charAt(0).toUpperCase() + mode.slice(1)} Travel`, color: TRAVEL_COLOR, duration: Math.max(0.1, displayItem.duration) });
  };
  const handlePaletteSelection = async (paletteId: string) => {
      if (!canEdit || !isCity || !onCityColorPaletteChange) return;
      if (paletteId === cityColorPaletteId) return;

      const applyToCities = await confirmDialog({
          title: 'Apply palette to current cities?',
          message: 'Choose “Apply automatically” to recolor all cities now. Choose “Manual selection” to keep existing city colors and only switch the active palette.',
          confirmLabel: 'Apply automatically',
          cancelLabel: 'Manual selection',
      });

      onCityColorPaletteChange(paletteId, { applyToCities });

      if (applyToCities) {
          const previewItems = applyCityPaletteToItems(tripItems, paletteId);
          const currentCity = previewItems.find(entry => entry.id === displayItem.id);
          if (currentCity?.color) {
              const nextHex = getHexFromColorClass(currentCity.color);
              setCustomColorHex(nextHex);
              setCustomColorInput(nextHex.toUpperCase());
          }
      }
  };
  const applyCustomCityColor = () => {
      if (!canEdit || !isCity) return;
      const normalized = normalizeCityColorInput(customColorInput) || normalizeCityColorInput(customColorHex);
      if (!normalized) {
          setCustomColorError('Use a HEX color (e.g. #f43f5e) or RGB value (e.g. rgb(244,63,94) / 244,63,94).');
          return;
      }

      setCustomColorError(null);
      setCustomColorHex(normalized);
      setCustomColorInput(normalized.toUpperCase());
      handleUpdate(displayItem.id, { color: normalized });
  };
  const tripStart = new Date(tripStartDate);
  const isValidDate = !isNaN(tripStart.getTime());
  const cityDurationPreview = isCity && isDurationEditorOpen && durationDraft
      ? durationDraft
      : null;
  const previewStartOffset = cityDurationPreview?.startDateOffset ?? displayItem.startDateOffset;
  const previewDuration = cityDurationPreview?.duration ?? displayItem.duration;
  const itemStartDate = isValidDate ? addDays(tripStart, previewStartOffset) : new Date();
  const itemEndDate = isValidDate ? addDays(tripStart, previewStartOffset + previewDuration) : new Date();
  const travelLegMetrics =
      isTransport && displayItem.id && tripItems.length > 0
          ? getTravelLegMetricsForItem(tripItems, displayItem.id)
          : null;
  const normalizedTransportMode = normalizeTransportMode(displayItem.transportMode);
  const airDistanceLabel = travelLegMetrics?.distanceKm
      ? formatDistance(travelLegMetrics.distanceKm, DEFAULT_DISTANCE_UNIT, { maximumFractionDigits: 1 })
      : null;
  const routeDistanceKm = Number.isFinite(displayItem.routeDistanceKm)
      ? (displayItem.routeDistanceKm as number)
      : null;
  const routeDistanceDisplayKm = normalizedTransportMode === 'plane'
      ? (travelLegMetrics?.distanceKm ?? null)
      : routeDistanceKm;
  const routeDistanceLabel = routeDistanceDisplayKm
      ? formatDistance(routeDistanceDisplayKm, DEFAULT_DISTANCE_UNIT, { maximumFractionDigits: 1 })
      : null;
  const routeDistanceText = (() => {
      if (routeDistanceLabel) return routeDistanceLabel;
      const canRoute =
          routeMode === 'realistic' &&
          !!travelLegMetrics?.distanceKm &&
          !['plane', 'boat', 'na'].includes(normalizedTransportMode);
      if (routeStatus === 'calculating' || (canRoute && routeStatus !== 'failed')) return 'Calculating…';
      return 'N/A';
  })();
  const effectiveDistanceKm = routeDistanceDisplayKm ?? travelLegMetrics?.distanceKm ?? null;
  const estimatedHours = effectiveDistanceKm ? estimateTravelHours(effectiveDistanceKm, normalizedTransportMode) : null;
  const estimatedLabel = formatDurationHours(estimatedHours);
  const displayedDurationDays = isCity ? previewDuration : displayItem.duration;
  const durationBaseline = durationBaselineRef.current;
  const hasDurationDraftChanges = !!(
      isCity &&
      durationBaseline &&
      durationDraft &&
      (Math.abs(durationDraft.startDateOffset - durationBaseline.startDateOffset) > 0.001 ||
          Math.abs(durationDraft.duration - durationBaseline.duration) > 0.001)
  );
  const displayedCityLocation = isCity && isCityEditorOpen
      ? (cityInputValue || cityDraft?.location || displayItem.location || displayItem.title)
      : (displayItem.location || displayItem.title);
  const cityBaseline = cityBaselineRef.current;
  const hasCityDraftChanges = !!(
      isCity &&
      cityBaseline &&
      cityDraft &&
      !areCityDraftEqual(cityDraft, cityBaseline)
  );
  const cityDisplayName = getCityNameFromText(displayedCityLocation || displayItem.title || '');
  const countryNameForDisplay = (
      (isCity && isCityEditorOpen ? cityDraft?.countryName : undefined) ||
      displayItem.countryName ||
      getCountryFromText(displayedCityLocation).countryName
  );
  const countryCodeForDisplay = (
      (isCity && isCityEditorOpen ? cityDraft?.countryCode : undefined) ||
      displayItem.countryCode ||
      getCountryFromText(displayedCityLocation).countryCode
  );
  
  const effectiveColor = isActivity ? getActivityColorByTypes(displayItem.activityType) : displayItem.color;
  const usesClassColor = (isActivity || isTransport) ? true : isTailwindCityColorValue(effectiveColor);
  const colorParts = usesClassColor && effectiveColor ? effectiveColor.split(' ') : [];
  const bgClass = colorParts.find(part => part.startsWith('bg-')) || 'bg-gray-100';
  const textClass = colorParts.find(part => part.startsWith('text-')) || 'text-gray-800';
  const effectiveColorHex = getHexFromColorClass(effectiveColor || '');
  const customBadgeBackgroundColor = shiftHexColor(effectiveColorHex, 52);
  const effectiveTextColor = getContrastTextColor(customBadgeBackgroundColor);
  const effectiveBorderColor = shiftHexColor(effectiveColorHex, -20);
  const selectedCityColorHex = isCity ? getHexFromColorClass(displayItem.color || '') : null;
  const activeCityPalette = getCityColorPalette(cityColorPaletteId);
  const routeModeLabel = normalizedTransportMode !== 'na'
      ? normalizedTransportMode
      : 'route';
  const showRouteDistance = routeMode === 'realistic';
  const supportsApproval = isCity || isActivity;
  const isItemApproved = supportsApproval ? displayItem.isApproved !== false : true;
  const isUncertainCity = isCity && displayItem.cityPlanStatus === 'uncertain';
  const uncertainOptionLabel = isUncertainCity
      ? (
          (typeof displayItem.cityPlanOptionIndex === 'number' && Number.isFinite(displayItem.cityPlanOptionIndex))
              ? `Option ${(displayItem.cityPlanOptionIndex || 0) + 1}`
              : 'Tentative stop'
      )
      : '';

  const Content = (
      <div className={`flex flex-col h-full w-full min-w-0 bg-gray-50 ${variant === 'sidebar' ? 'border-l border-gray-200' : 'rounded-t-[20px] sm:rounded-2xl'}`}>
          <style>{`.pac-container { z-index: 10000 !important; }`}</style>
          {/* Header */}
          <div className="bg-white p-4 sm:p-6 border-b border-gray-100 pb-6 relative flex-shrink-0">
             {variant === 'overlay' && (
                <div 
                    className="w-full flex sm:hidden items-center justify-center p-3 cursor-grab absolute top-0 left-0 right-0"
                    onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
                >
                    <div className="w-12 h-1.5 rounded-full bg-gray-300" />
                </div>
             )}
             
             <div className="flex justify-between items-start mb-4 pr-8 sm:pr-28">
                  <div className="flex items-center gap-2">
                      <div
                          className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider transition-colors ${usesClassColor ? `${bgClass} ${textClass} bg-opacity-50` : ''}`}
                          style={!usesClassColor ? {
                              backgroundColor: customBadgeBackgroundColor,
                              color: effectiveTextColor,
                              border: `1px solid ${effectiveBorderColor}`,
                          } : undefined}
                      >
                          {displayItem.type}
                      </div>
                      {isUncertainCity && (
                        <div className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
                            <AlertTriangle size={12} />
                            <span>Uncertain{uncertainOptionLabel ? ` · ${uncertainOptionLabel}` : ''}</span>
                        </div>
                      )}
                      {supportsApproval && (
                        <label
                            className={`inline-flex items-center gap-2 rounded-md border px-2 py-1 text-[11px] font-semibold ${
                                isItemApproved
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                    : 'border-amber-200 bg-amber-50 text-amber-700'
                            } ${canEdit ? '' : 'opacity-50 cursor-not-allowed'}`}
                            title={isItemApproved ? 'Item approved' : 'Item needs approval'}
                        >
                            <Switch
                                checked={isItemApproved}
                                onCheckedChange={handleSetItemApproved}
                                disabled={!canEdit}
                                className="h-5 w-9 data-[state=checked]:bg-emerald-600 data-[state=unchecked]:bg-amber-400"
                                aria-label="Toggle item approval"
                            />
                            <span>{isItemApproved ? 'Approved' : 'Needs approval'}</span>
                        </label>
                      )}
                      {isCity && (
                        <div className="relative">
                            <button
                                onClick={() => { if (!canEdit) return; setIsColorPickerOpen(!isColorPickerOpen); }}
                                disabled={!canEdit}
                                className={`p-1 rounded-full text-gray-400 transition-colors ${canEdit ? 'hover:bg-gray-100 hover:text-accent-600' : 'opacity-50 cursor-not-allowed'}`}
                                aria-label={isColorPickerOpen ? 'Close color picker' : 'Open color picker'}
                            >
                                <Palette size={14} />
                            </button>
                            {isColorPickerOpen && (
                                <div className="absolute top-full left-0 mt-2 p-3 bg-white rounded-xl shadow-xl border border-gray-100 z-50 w-[280px] space-y-3">
                                    <div>
                                        <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Palettes</div>
                                        <div className="grid grid-cols-2 gap-2">
                                            {CITY_COLOR_PALETTES.map((palette) => (
                                                <button
                                                    key={palette.id}
                                                    type="button"
                                                    onClick={() => { void handlePaletteSelection(palette.id); }}
                                                    disabled={!canEdit}
                                                    className={`rounded-lg border p-1 transition-colors ${cityColorPaletteId === palette.id ? 'border-accent-400 bg-accent-50' : 'border-gray-200 hover:border-gray-300'} ${canEdit ? '' : 'opacity-50 cursor-not-allowed'}`}
                                                    title={palette.name}
                                                >
                                                    <div className="flex h-5 w-full gap-[2px]">
                                                        {palette.colors.map((paletteColor, colorIndex) => (
                                                            <span
                                                                key={`${palette.id}-${colorIndex}`}
                                                                className="h-full flex-1 rounded-[2px]"
                                                                style={{ backgroundColor: paletteColor }}
                                                            />
                                                        ))}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Palette colors</div>
                                        <div className="grid grid-cols-8 gap-1.5">
                                            {activeCityPalette.colors.map((paletteColor) => {
                                                const normalizedSwatchHex = getHexFromColorClass(paletteColor).toLowerCase();
                                                const isSelected = selectedCityColorHex?.toLowerCase() === normalizedSwatchHex;
                                                return (
                                                    <button
                                                        key={`${activeCityPalette.id}-color-${paletteColor}`}
                                                        onClick={() => { if (!canEdit) return; handleUpdate(displayItem.id, { color: paletteColor }); }}
                                                        disabled={!canEdit}
                                                        className={`h-6 w-6 rounded-full border-2 transition-transform ${isSelected ? 'border-gray-900 shadow-inner' : 'border-transparent'} ${canEdit ? 'hover:scale-110 hover:border-gray-200' : 'opacity-50 cursor-not-allowed'}`}
                                                        style={{ backgroundColor: paletteColor }}
                                                        title="Palette color"
                                                    />
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="space-y-2 border-t border-gray-100 pt-3">
                                        <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Custom color</div>
                                        <HexColorPicker
                                            color={customColorHex}
                                            onChange={(nextColor) => {
                                                setCustomColorHex(nextColor);
                                                setCustomColorInput(nextColor.toUpperCase());
                                                if (customColorError) setCustomColorError(null);
                                            }}
                                            className="!w-full"
                                        />
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={customColorInput}
                                                onChange={(event) => {
                                                    setCustomColorInput(event.target.value);
                                                    if (customColorError) setCustomColorError(null);
                                                }}
                                                placeholder="#F43F5E or rgb(244,63,94)"
                                                className="flex-1 rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-accent-400"
                                            />
                                            <button
                                                type="button"
                                                onClick={applyCustomCityColor}
                                                disabled={!canEdit}
                                                className={`px-2.5 py-1.5 text-xs font-semibold rounded-md text-white ${canEdit ? 'bg-accent-600 hover:bg-accent-700' : 'bg-accent-300 cursor-not-allowed'}`}
                                            >
                                                Apply
                                            </button>
                                        </div>
                                        {customColorError && (
                                            <p className="text-[11px] text-red-600">{customColorError}</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                      )}
                  </div>
                  {variant !== 'sidebar' && (
                      <>
                          <button
                              onClick={() => { if (!canEdit) return; handleDeleteItem(displayItem.id); handleClosePanel(); }}
                              disabled={!canEdit}
                              className={`p-2 bg-red-50 text-red-500 rounded-full transition-colors sm:hidden ${canEdit ? 'hover:bg-red-100' : 'opacity-50 cursor-not-allowed'}`}
                              aria-label="Delete item"
                          >
                              <Trash2 size={20} />
                          </button>
                          <button
                              onClick={() => { if (!canEdit) return; handleDeleteItem(displayItem.id); handleClosePanel(); }}
                              disabled={!canEdit}
                              className={`hidden sm:block text-red-400 transition-colors text-xs font-medium px-2 py-1 ${canEdit ? 'hover:text-red-600' : 'opacity-50 cursor-not-allowed'}`}
                          >
                              Delete
                          </button>
                      </>
                  )}
                  {variant === 'overlay' && <div className="hidden sm:flex absolute top-4 right-4 z-10"><button onClick={handleClosePanel} className="p-2 bg-gray-200 hover:bg-gray-300 rounded-full text-gray-600" aria-label="Close details"><X size={18} /></button></div>}
                  {variant === 'sidebar' && (
                      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 flex items-center gap-5">
                          <button
                              onClick={() => { if (!canEdit) return; handleDeleteItem(displayItem.id); handleClosePanel(); }}
                              disabled={!canEdit}
                              className={`p-2 bg-red-50 text-red-500 rounded-full transition-colors ${canEdit ? 'hover:bg-red-100' : 'opacity-50 cursor-not-allowed'}`}
                              aria-label="Delete item"
                              title="Delete"
                          >
                              <Trash2 size={16} />
                          </button>
                          <button
                              onClick={handleClosePanel}
                              className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-500"
                              aria-label="Close details"
                              title="Close"
                          >
                              <X size={16} />
                          </button>
                      </div>
                  )}
             </div>
             
             <textarea 
                value={displayItem.title} 
                onChange={canEdit ? ((e) => handleUpdate(displayItem.id, { title: e.target.value })) : undefined} 
                readOnly={!canEdit}
                className={`text-2xl sm:text-3xl font-bold text-gray-900 bg-transparent border-none placeholder-gray-300 focus:ring-0 p-0 w-full resize-none overflow-hidden leading-tight ${canEdit ? '' : 'cursor-not-allowed opacity-70'}`}
                rows={1} placeholder="Title" 
                style={{ fieldSizing: 'content', minHeight: '2.5rem' } as any}
             />
             
             <div className="flex flex-col gap-3 mt-4">
                 <div className="flex items-start text-gray-600">
                    <Clock size={18} className="mr-3 text-accent-500 mt-0.5" />
                    {isTransport ? (
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">Duration:</span>
                                <input
                                    type="number"
                                    min="0.5"
                                    value={Math.round(displayItem.duration * 24 * 10) / 10}
                                    onChange={canEdit ? ((e) => { const h = parseFloat(e.target.value); if (!isNaN(h) && h > 0) handleUpdate(displayItem.id, { duration: h / 24 }); }) : undefined}
                                    disabled={!canEdit}
                                    className={`w-16 p-1 border-b border-gray-300 bg-transparent text-center font-bold text-gray-900 outline-none ${canEdit ? 'focus:border-accent-500' : 'cursor-not-allowed opacity-70'}`}
                                />
                                <span className="font-medium text-sm">hours</span>
                            </div>
                            <span className="text-[11px] text-gray-400">
                                Estimated {estimatedLabel ?? '—'}
                            </span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <span className="font-medium">{Number(displayedDurationDays.toFixed(1))} day{displayedDurationDays !== 1 ? 's' : ''}</span>
                            {isCity && (
                                <button
                                    onClick={openDurationEditor}
                                    disabled={!canEdit}
                                    className={`p-1 rounded text-gray-400 transition-colors ${canEdit ? 'hover:bg-gray-100 hover:text-accent-600' : 'opacity-50 cursor-not-allowed'}`}
                                    title="Edit duration"
                                >
                                    <Pencil size={13} />
                                </button>
                            )}
                        </div>
                    )}
                 </div>
                 {isTransport && (
                    <div className="flex items-start text-gray-600">
                        <MapPin size={18} className="mr-3 text-accent-500 mt-0.5" />
                        <div className="flex flex-col gap-0.5">
                            <span className="font-medium">Air distance: {airDistanceLabel ?? '—'}</span>
                            {showRouteDistance && (
                                <span className="text-[11px] text-gray-400">
                                    Route distance ({routeModeLabel}): {routeDistanceText}
                                </span>
                            )}
                        </div>
                    </div>
                 )}
                 {(isCity || displayItem.location) && (
                    <div className="flex items-start text-gray-600">
                        <MapPin size={18} className="mr-3 text-accent-500 mt-0.5" />
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                {countryCodeForDisplay && (
                                    <FlagIcon code={countryCodeForDisplay} size="sm" fallback={null} />
                                )}
                                <span className="font-medium">{isCity ? (cityDisplayName || 'No city selected') : displayItem.location}</span>
                                {isCity && (
                                    <button
                                        onClick={openCityEditor}
                                        disabled={!canEdit}
                                        className={`p-1 rounded text-gray-400 transition-colors ${canEdit ? 'hover:bg-gray-100 hover:text-accent-600' : 'opacity-50 cursor-not-allowed'}`}
                                        title="Edit city"
                                    >
                                        <Pencil size={13} />
                                    </button>
                                )}
                            </div>
                            {isCity && countryNameForDisplay && (
                                <div className="text-xs text-gray-500 mt-0.5">{countryNameForDisplay}</div>
                            )}
                        </div>
                    </div>
                 )}
             </div>
          </div>

          {/* Body */}
          <div className="p-4 sm:p-6 space-y-6 flex-1 overflow-y-auto min-w-0">
             {isCity && isValidDate && isDurationEditorOpen && (
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
                    <div className="flex justify-between items-center pb-2 border-b border-gray-50">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Schedule</h3>
                        <div className="flex items-center gap-2">
                            <div className="text-xs font-medium text-accent-600 bg-accent-50 px-2 py-0.5 rounded">{Number(previewDuration.toFixed(1))} Nights</div>
                            {onForceFill && forceFillLabel && (
                                <button
                                    onClick={() => { if (!canEdit) return; handleForceFillDraft(); }}
                                    disabled={!canEdit}
                                    className={`px-2 py-1 rounded text-gray-500 flex items-center gap-1 text-[10px] font-semibold ${canEdit ? 'hover:bg-gray-100 hover:text-accent-600' : 'opacity-50 cursor-not-allowed'}`}
                                    title={forceFillLabel || 'Occupy available space'}
                                >
                                    {(forceFillMode === 'shrink') ? <Minimize size={12} /> : <Maximize size={12} />}
                                    <span>{forceFillLabel || 'Occupy available space'}</span>
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-gray-400 uppercase">Arrival</span>
                            <span className="text-sm font-bold text-gray-800">{formatDate(itemStartDate)}</span>
                        </div>
                        <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1">
                            <button
                                onClick={() => updateDurationStartDraft(-1)}
                                disabled={!canEdit}
                                className={`p-1.5 rounded-md transition-all text-gray-500 ${canEdit ? 'hover:bg-white hover:shadow-sm hover:text-accent-600' : 'opacity-50 cursor-not-allowed'}`}
                            >
                                <Minus size={14} />
                            </button>
                            <span className="text-[10px] font-bold text-gray-400 px-1 select-none">START</span>
                            <button
                                onClick={() => updateDurationStartDraft(1)}
                                disabled={!canEdit}
                                className={`p-1.5 rounded-md transition-all text-gray-500 ${canEdit ? 'hover:bg-white hover:shadow-sm hover:text-accent-600' : 'opacity-50 cursor-not-allowed'}`}
                            >
                                <Plus size={14} />
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-gray-400 uppercase">Departure</span>
                            <span className="text-sm font-bold text-gray-800">{formatDate(itemEndDate)}</span>
                        </div>
                        <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1">
                            <button
                                onClick={() => updateDurationEndDraft(-1)}
                                disabled={!canEdit}
                                className={`p-1.5 rounded-md transition-all text-gray-500 ${canEdit ? 'hover:bg-white hover:shadow-sm hover:text-accent-600' : 'opacity-50 cursor-not-allowed'}`}
                            >
                                <Minus size={14} />
                            </button>
                            <span className="text-[10px] font-bold text-gray-400 px-1 select-none">END</span>
                            <button
                                onClick={() => updateDurationEndDraft(1)}
                                disabled={!canEdit}
                                className={`p-1.5 rounded-md transition-all text-gray-500 ${canEdit ? 'hover:bg-white hover:shadow-sm hover:text-accent-600' : 'opacity-50 cursor-not-allowed'}`}
                            >
                                <Plus size={14} />
                            </button>
                        </div>
                    </div>
                    <div className="pt-2 border-t border-gray-50 flex items-center justify-end gap-2">
                        <button
                            onClick={closeDurationEditor}
                            className={`px-3 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-md ${canEdit ? 'hover:bg-gray-50' : 'opacity-50 cursor-not-allowed'}`}
                            disabled={!canEdit}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleApplyDurationEdit}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                                canEdit && hasDurationDraftChanges
                                    ? 'text-white bg-accent-600 hover:bg-accent-700'
                                    : 'text-gray-400 bg-gray-100 cursor-not-allowed'
                            }`}
                            disabled={!canEdit || !hasDurationDraftChanges}
                        >
                            Apply
                        </button>
                    </div>
                </div>
             )}

             {isCity && isCityEditorOpen && (
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
                    <div className="flex justify-between items-center pb-2 border-b border-gray-50">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">City</h3>
                        <div className="text-xs text-gray-500">Search with Google Places</div>
                    </div>
                    {citySearchError && (
                        <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-700 flex items-start gap-2">
                            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                            <div>{citySearchError}</div>
                        </div>
                    )}
                    <div className="relative">
                        <input
                            ref={cityInputRef}
                            type="text"
                            value={cityInputValue}
                            onChange={canEdit ? ((e) => handleCityInputChange(e.target.value)) : undefined}
                            placeholder="e.g. Kyoto, Japan"
                            disabled={!canEdit}
                            className={`w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 outline-none ${canEdit ? 'focus:ring-1 focus:ring-accent-500' : 'opacity-60 cursor-not-allowed'}`}
                        />
                        <Search size={14} className="absolute left-3 top-3.5 text-gray-400" />
                    </div>
                    <p className="text-xs text-gray-500">
                        Start typing and pick a city from the autocomplete list, then apply.
                    </p>
                    <div className="pt-2 border-t border-gray-50 flex items-center justify-end gap-2">
                        <button
                            onClick={closeCityEditor}
                            className={`px-3 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-md ${canEdit ? 'hover:bg-gray-50' : 'opacity-50 cursor-not-allowed'}`}
                            disabled={!canEdit}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleApplyCityEdit}
                            className={`px-3 py-1.5 text-xs font-semibold text-white bg-accent-600 rounded-md ${canEdit ? 'hover:bg-accent-700' : 'opacity-50 cursor-not-allowed'}`}
                            disabled={!canEdit || !(cityInputValue.trim() || cityDraft?.location || '').trim() || !hasCityDraftChanges}
                        >
                            Apply
                        </button>
                    </div>
                </div>
             )}
             
             {isCity && (
                 <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                     <div className="flex justify-between items-center mb-4">
                         <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5"><Hotel size={14} /> Accomodation</h3>
                         <button
                             onClick={addHotel}
                             disabled={!canEdit}
                             className={`text-accent-600 p-1 rounded transition-colors text-xs font-medium ${canEdit ? 'hover:text-accent-800 hover:bg-accent-50' : 'opacity-50 cursor-not-allowed'}`}
                         >
                             + Manual
                         </button>
                     </div>
                     <div className="mb-4 relative">
                        {/* Hidden Places Service Container */}
                        <div ref={placesServiceDivRef} className="hidden"></div>

                        {apiKeyError ? <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600 flex items-start gap-2"><AlertTriangle size={14} className="mt-0.5 flex-shrink-0" /><div><strong>Maps Search Unavailable</strong><br/>No valid API Key.</div></div> : (
                            <>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            type="text"
                                            value={hotelQuery}
                                            onChange={canEdit ? ((e) => setHotelQuery(e.target.value)) : undefined}
                                            onKeyDown={canEdit ? ((e) => e.key === 'Enter' && handleHotelSearch()) : undefined}
                                            placeholder="Search hotels..."
                                            disabled={!canEdit}
                                            className={`w-full pl-8 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 outline-none ${canEdit ? 'focus:ring-1 focus:ring-accent-500' : 'opacity-60 cursor-not-allowed'}`}
                                        />
                                        <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
                                    </div>
                                    <button
                                        onClick={handleHotelSearch}
                                        disabled={!canEdit || isSearchingHotels || !hotelQuery || !placesService}
                                        className={`px-3 py-2 bg-accent-600 text-white rounded-lg text-xs font-bold ${canEdit ? 'hover:bg-accent-700' : 'opacity-50 cursor-not-allowed'} disabled:opacity-50`}
                                    >
                                        {isSearchingHotels ? '...' : 'Find'}
                                    </button>
                                </div>
                                {hotelResults.length > 0 && (
                                    <div className="mt-2 space-y-2">
                                        {hotelResults.map((result) => (
                                            <button
                                                key={result.id}
                                                type="button"
                                                onClick={() => selectHotelResult(result)}
                                                disabled={!canEdit}
                                                className={`w-full text-left bg-gray-50 border border-gray-200 rounded-lg p-2 transition-all ${canEdit ? 'hover:bg-accent-50 hover:border-accent-200 cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                                            >
                                                <div className="font-bold text-sm text-gray-800">{result.name}</div>
                                                <div className="text-xs text-gray-500 truncate">{result.address}</div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                     </div>
                     <div className="space-y-6">
                        {displayItem.hotels?.map((hotel) => (
                            <div key={hotel.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200 group">
                                <div className="flex justify-between items-start mb-2">
                                    <input
                                        type="text"
                                        value={hotel.name}
                                        onChange={canEdit ? ((e) => updateHotel(hotel.id, { name: e.target.value })) : undefined}
                                        placeholder="Hotel Name"
                                        readOnly={!canEdit}
                                        disabled={!canEdit}
                                        className={`font-bold text-gray-800 bg-transparent border-none p-0 focus:ring-0 w-full placeholder-gray-400 text-sm ${canEdit ? '' : 'cursor-not-allowed opacity-70'}`}
                                    />
                                    <button
                                        onClick={() => removeHotel(hotel.id)}
                                        disabled={!canEdit}
                                        className={`text-gray-400 opacity-0 group-hover:opacity-100 ${canEdit ? 'hover:text-red-500' : 'opacity-50 cursor-not-allowed'}`}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                                <div className="flex items-start gap-2 mb-3">
                                    <MapPin size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                                    <input
                                        type="text"
                                        value={hotel.address}
                                        onChange={canEdit ? ((e) => updateHotel(hotel.id, { address: e.target.value })) : undefined}
                                        placeholder="Address"
                                        readOnly={!canEdit}
                                        disabled={!canEdit}
                                        className={`text-xs text-gray-600 bg-transparent border-none p-0 focus:ring-0 w-full placeholder-gray-400 ${canEdit ? '' : 'cursor-not-allowed opacity-70'}`}
                                    />
                                </div>
                                {hotel.address && (
                                    <div className="rounded-lg overflow-hidden h-32 w-full bg-gray-200 border border-gray-300 relative">
                                        <iframe width="100%" height="100%" frameBorder="0" style={{ border: 0 }} src={`https://maps.google.com/maps?q=${encodeURIComponent(hotel.address)}&t=&z=13&ie=UTF8&iwloc=&output=embed&hl=${encodeURIComponent(mapLanguage)}`} title="Hotel"></iframe>
                                    </div>
                                )}
                            </div>
                        ))}
                        {(!displayItem.hotels || displayItem.hotels.length === 0) && (
                            <div className="text-xs text-center text-gray-400 py-2 border-2 border-dashed border-gray-100 rounded-lg">No accomodation</div>
                        )}
                     </div>
                 </div>
             )}

             {isTransport && (
                 <div className={`bg-white p-5 rounded-2xl shadow-sm border ${normalizedTransportMode === 'na' ? 'border-gray-200 bg-gray-50/40' : 'border-gray-100'}`}>
                     <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Transportation Mode</h3>
                     <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))' }}>
                         {(TRANSPORT_MODE_UI_ORDER as TransportMode[]).map(mode => (
                             <button 
                                 key={mode} 
                                 onClick={() => handleTransportConvert(mode)} 
                                 disabled={!canEdit}
                                 className={`flex flex-col items-center justify-center w-full h-20 rounded-xl border-2 transition-all ${
                                    normalizedTransportMode === mode
                                        ? (mode === 'na' ? 'bg-gray-50 border-gray-300 text-gray-500' : 'bg-accent-50 border-accent-500 text-accent-700')
                                        : (mode === 'na' ? 'bg-gray-50 border-gray-200 text-gray-400' : 'bg-gray-50 border-gray-100 text-gray-400')
                                 } ${canEdit ? 'hover:border-gray-200' : 'opacity-60 cursor-not-allowed'}`}
                             >
                                 <TransportModeIcon mode={mode} size={24} />
                                 <span className="text-[10px] font-bold mt-2 uppercase">{mode === 'na' ? 'N/A' : mode}</span>
                             </button>
                         ))}
                     </div>
                 </div>
             )}

             {isActivity && (
                 <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                     <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Activity Types</h3>
                     <div className="flex flex-wrap gap-2 mb-6">
                        {ALL_ACTIVITY_TYPES.map(type => {
                            const isSelectedType = selectedActivityTypes.includes(type);
                            return (
                                <button
                                    key={type}
                                    onClick={() => toggleActivityType(type)}
                                    disabled={!canEdit}
                                    className={`flex items-center px-3 py-2 rounded-lg border transition-all text-xs font-bold uppercase tracking-wide ${getActivityTypeButtonClass(type, isSelectedType)} ${canEdit ? '' : 'opacity-60 cursor-not-allowed'}`}
                                >
                                    <ActivityTypeIcon type={type} size={13} className="mr-1.5" />
                                    <span>{formatActivityTypeLabel(type)}</span>
                                </button>
                            );
                        })}
                     </div>
                     <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Check Availability</h3>
                     <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}><button onClick={() => openExternalLink('gyg')} className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-[#ff5533]/5 text-[#ff5533] border border-[#ff5533]/20 hover:bg-[#ff5533]/10 font-medium text-xs">GYG <ExternalLink size={12} /></button><button onClick={() => openExternalLink('tripadvisor')} className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-[#34e0a1]/10 text-[#00aa6c] border border-[#34e0a1]/20 hover:bg-[#34e0a1]/20 font-medium text-xs">TripAdvisor <ExternalLink size={12} /></button></div>
                 </div>
             )}

             <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex-1">
                <div className="flex justify-between items-center mb-2"><h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Notes</h3></div>
                <Suspense
                    fallback={<div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">Loading notes editor...</div>}
                >
                    <LazyMarkdownEditor
                        key={displayItem.id}
                        value={displayItem.description || ''}
                        onChange={canEdit ? ((val) => handleUpdate(displayItem.id, { description: val })) : undefined}
                        aiActions={isCity && canEdit ? CITY_NOTES_AI_ACTIONS : undefined}
                        onAiActionSelect={isCity && canEdit ? ((actionId) => {
                            if (actionId === 'expand-checklists' || actionId === 'local-tips' || actionId === 'day-plan') {
                                handleEnhanceNotes(actionId);
                            }
                        }) : undefined}
                        isGenerating={isEnhancing}
                        aiStatus={isCity ? aiStatus : null}
                        readOnly={!canEdit}
                    />
                </Suspense>
                {aiError && (
                    <div className="mt-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                        {aiError}
                    </div>
                )}
                {isCity && pendingNotesProposal && (
                    <div className="mt-4 border border-accent-100 rounded-xl bg-accent-50/40 overflow-hidden">
                        <div className="px-4 py-3 border-b border-accent-100 bg-white/80">
                            <div className="text-xs font-semibold text-accent-700">AI Draft Preview</div>
                            <div className="text-[11px] text-accent-600 mt-1">
                                Action: {pendingNotesProposal.actionLabel}
                            </div>
                        </div>
                        <div className="p-4 bg-white">
                            <Suspense
                                fallback={<div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">Loading preview...</div>}
                            >
                                <LazyMarkdownEditor value={proposedNotesPreview} readOnly />
                            </Suspense>
                        </div>
                        <div className="px-4 py-3 bg-accent-50 border-t border-accent-100 flex items-center justify-end gap-2">
                            <button
                                onClick={handleDeclineNotesProposal}
                                disabled={!canEdit}
                                className={`px-3 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-md ${canEdit ? 'hover:bg-gray-50' : 'opacity-50 cursor-not-allowed'}`}
                            >
                                Decline
                            </button>
                            <button
                                onClick={handleAcceptNotesProposal}
                                disabled={!canEdit}
                                className={`px-3 py-1.5 text-xs font-semibold text-white bg-accent-600 rounded-md ${canEdit ? 'hover:bg-accent-700' : 'opacity-50 cursor-not-allowed'}`}
                            >
                                Accept and Apply
                            </button>
                        </div>
                    </div>
                )}
                {(aiDetails || loading) && isActivity && (
                    <div className="bg-gradient-to-br from-accent-50 to-accent-100 border border-accent-100 rounded-xl p-4 mt-6">
                        <div className="flex items-center mb-3 justify-between">
                            <div className="flex items-center gap-2">
                                <Sparkles size={16} className="text-accent-500 animate-pulse" />
                                <h3 className="text-sm font-semibold text-accent-900">AI Insights</h3>
                            </div>
                            <button
                                onClick={fetchDetails}
                                disabled={!canEdit}
                                className={`p-1.5 rounded-full text-accent-500 ${loading ? 'animate-spin' : ''} ${canEdit ? 'hover:bg-white' : 'opacity-50 cursor-not-allowed'}`}
                            >
                                <RefreshCw size={16} />
                            </button>
                        </div>
                        {loading && !aiDetails ? (
                            <div className="text-sm text-accent-600/70 py-2">Loading...</div>
                        ) : (
                            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                                <div className="bg-white p-3 rounded-lg border border-accent-100 shadow-sm">
                                    <span className="text-[10px] font-bold text-accent-400 uppercase">Cost</span>
                                    <span className="text-sm font-medium">{aiDetails?.cost || 'N/A'}</span>
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-accent-100 shadow-sm">
                                    <span className="text-[10px] font-bold text-accent-400 uppercase">Best Time</span>
                                    <span className="text-sm font-medium">{aiDetails?.bestTime || 'N/A'}</span>
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-accent-100 shadow-sm" style={{ gridColumn: '1 / -1' }}>
                                    <span className="text-[10px] font-bold text-accent-400 uppercase">Tip</span>
                                    <span className="text-sm font-medium">{aiDetails?.tips || 'N/A'}</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}
             </div>
          </div>
      </div>
  );

  // If sidebar mode, return directly (no portal)
  if (variant === 'sidebar') {
      return Content;
  }

  // Else Overlay mode (Portal)
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex justify-end pointer-events-none">
        <button
            type="button"
            aria-label="Close details panel"
            className={`absolute inset-0 border-0 p-0 bg-black/30 backdrop-blur-[2px] transition-opacity duration-300 pointer-events-auto ${isVisible ? 'opacity-100' : 'opacity-0'}`}
            onClick={handleClosePanel}
        />
        <div 
            className={`bg-gray-100 shadow-2xl flex flex-col pointer-events-auto will-change-transform absolute w-full h-[85vh] bottom-0 rounded-t-[20px] left-0 right-0 sm:top-2 sm:bottom-2 sm:right-2 sm:w-[450px] sm:h-auto sm:rounded-2xl sm:left-auto`}
            style={{ transform: window.innerWidth < 640 ? `translateY(${!isVisible ? '100%' : `${dragOffset}px`})` : `translateX(${!isVisible ? '110%' : '0%'})`, transition: isDragging ? 'none' : 'transform 300ms cubic-bezier(0.32, 0.72, 0, 1)' }}
        >
          {Content}
        </div>
    </div>,
    document.body
  );
};
