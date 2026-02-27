import React from 'react';
import {
  ArrowUpRight,
  CalendarBlank,
  Clock,
  Eye,
  EyeSlash,
  MapPin,
  PushPin,
  Star,
  Trash,
} from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { isTripExpiredByTimestamp } from '../../config/productLimits';
import type { AppLanguage, ITrip } from '../../types';
import { trackEvent } from '../../services/analyticsService';
import { Checkbox } from '../ui/checkbox';
import {
  buildMiniMapUrl,
  formatTripDateRange,
  formatTripSummaryLine,
  getTripDurationDays,
  getTripCityItems,
  getTripCityStops,
} from './tripPreviewUtils';

interface ProfileTripCardLabels {
  open: string;
  favorite: string;
  unfavorite: string;
  pin: string;
  unpin: string;
  archive?: string;
  selectTrip?: string;
  makePublic?: string;
  makePrivate?: string;
  pinnedTag: string;
  expiredTag?: string;
  expiredFallbackTitle?: string;
  mapUnavailable: string;
  mapLoading: string;
  creatorPrefix?: string;
}

interface ProfileTripCardProps {
  trip: ITrip;
  locale: AppLanguage;
  sourceLabel: string;
  labels: ProfileTripCardLabels;
  onOpen: (trip: ITrip) => void;
  onToggleFavorite?: (trip: ITrip) => void;
  onTogglePin?: (trip: ITrip) => void;
  onToggleVisibility?: (trip: ITrip) => void;
  onArchive?: (trip: ITrip) => void;
  onSelectionChange?: (trip: ITrip, selected: boolean) => void;
  analyticsAttrs?: (action: 'open' | 'favorite' | 'pin' | 'visibility' | 'creator' | 'archive' | 'select') => Record<string, string>;
  creatorHandle?: string | null;
  creatorProfilePath?: string | null;
  showCreatorAttribution?: boolean;
  onCreatorClick?: () => void;
  showFavoriteAction?: boolean;
  showPinAction?: boolean;
  isSelectable?: boolean;
  isSelected?: boolean;
}

const DEFAULT_ROUTE_COLOR = '#64748b';
const DEFAULT_LANE_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#0ea5e9',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
];

const GENERATION_ERROR_ITEM_PREFIX = 'loading-error-';

const buildLaneOutlineColor = (hexColor: string): string => {
  const sanitized = hexColor.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(sanitized)) return 'rgba(15, 23, 42, 0.14)';

  const r = Number.parseInt(sanitized.slice(0, 2), 16);
  const g = Number.parseInt(sanitized.slice(2, 4), 16);
  const b = Number.parseInt(sanitized.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.58 ? 'rgba(15, 23, 42, 0.16)' : 'rgba(255, 255, 255, 0.22)';
};

export const ProfileTripCard: React.FC<ProfileTripCardProps> = ({
  trip,
  locale,
  sourceLabel,
  labels,
  onOpen,
  onToggleFavorite,
  onTogglePin,
  onToggleVisibility,
  onArchive,
  onSelectionChange,
  analyticsAttrs,
  creatorHandle = null,
  creatorProfilePath = null,
  showCreatorAttribution = false,
  onCreatorClick,
  showFavoriteAction = true,
  showPinAction = true,
  isSelectable = false,
  isSelected = false,
}) => {
  const [mapLoaded, setMapLoaded] = React.useState(false);
  const [mapError, setMapError] = React.useState(false);
  const [isNearViewport, setIsNearViewport] = React.useState(false);
  const cardRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    setMapLoaded(false);
    setMapError(false);
  }, [trip.id, locale]);

  React.useEffect(() => {
    const node = cardRef.current;
    if (!node) return;
    if (typeof window === 'undefined' || typeof window.IntersectionObserver !== 'function') {
      setIsNearViewport(true);
      return;
    }
    const observer = new window.IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setIsNearViewport(true);
        observer.disconnect();
      },
      { rootMargin: '520px 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [trip.id]);

  const cityStops = React.useMemo(() => getTripCityStops(trip), [trip]);
  const cityItems = React.useMemo(() => getTripCityItems(trip), [trip]);
  const mapUrl = React.useMemo(
    () => (isNearViewport ? buildMiniMapUrl(trip, locale) : null),
    [isNearViewport, trip, locale]
  );
  const summaryLine = React.useMemo(() => formatTripSummaryLine(trip, locale), [trip, locale]);
  const dateRange = React.useMemo(() => formatTripDateRange(trip, locale), [trip, locale]);
  const durationDays = React.useMemo(() => getTripDurationDays(trip), [trip]);
  const hasCreatorAttribution = showCreatorAttribution && Boolean(creatorHandle) && Boolean(creatorProfilePath);
  const isPublic = trip.showOnPublicProfile !== false;
  const isExpired = trip.status === 'expired' || isTripExpiredByTimestamp(trip.tripExpiresAt);
  const hasGenerationErrorItem = React.useMemo(
    () => trip.items.some((item) => item.id.startsWith(GENERATION_ERROR_ITEM_PREFIX)),
    [trip.items]
  );
  const displayTitle = isExpired && hasGenerationErrorItem
    ? (labels.expiredFallbackTitle || 'Expired trip')
    : trip.title;

  const cityLanes = React.useMemo(() => (
    cityItems.map((item, index) => ({
      id: item.id,
      title: item.title || item.location || 'City stop',
      color: item.color || DEFAULT_LANE_COLORS[index % DEFAULT_LANE_COLORS.length],
      nights: Math.max(1, Math.ceil(Number.isFinite(item.duration) ? item.duration : 1)),
    }))
  ), [cityItems]);

  const routeLanes = React.useMemo(() => (
    cityItems
      .slice(0, -1)
      .map((item, index) => {
        const nextItem = cityItems[index + 1];
        if (!nextItem) return null;
        const gapDays = nextItem.startDateOffset - (item.startDateOffset + item.duration);
        const durationDaysEstimate = Number.isFinite(gapDays)
          ? Math.max(0.35, Math.min(4, gapDays))
          : 0.35;
        return {
          id: `${item.id}-${nextItem.id}`,
          durationDays: durationDaysEstimate,
          color: nextItem.color || DEFAULT_ROUTE_COLOR,
        };
      })
      .filter((lane): lane is { id: string; durationDays: number; color: string } => Boolean(lane))
  ), [cityItems]);

  return (
    <article
      ref={cardRef}
      className={[
        'group relative overflow-hidden rounded-xl border bg-white transition-colors hover:border-slate-300',
        isExpired ? 'border-amber-200' : 'border-slate-200',
      ].join(' ')}
      style={{ contentVisibility: 'auto', containIntrinsicSize: '420px' }}
    >
      <div className={`relative h-40 overflow-hidden ${isExpired ? 'bg-amber-50' : 'bg-slate-100'}`}>
        {isSelectable && onSelectionChange && (
          <div
            className="absolute end-3 top-3 z-20"
            title={labels.selectTrip || 'Select trip'}
          >
            <Checkbox
              checked={isSelected}
              onCheckedChange={(value) => onSelectionChange(trip, value === true)}
              aria-label={`${labels.selectTrip || 'Select trip'}: ${trip.title}`}
              className="h-5 w-5 rounded-md border border-white/90 bg-white/95 shadow-sm"
              {...(analyticsAttrs ? analyticsAttrs('select') : {})}
            />
          </div>
        )}

        {!isNearViewport ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100 text-xs font-medium text-slate-500">
            {labels.mapLoading}
          </div>
        ) : mapUrl && !mapError ? (
          <>
            {!mapLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-100 text-xs font-medium text-slate-500">
                {labels.mapLoading}
              </div>
            )}
            <img
              src={mapUrl}
              alt={`Map preview for ${trip.title}`}
              className={`h-full w-full object-cover ${isExpired ? 'opacity-70 grayscale-[0.28]' : ''}`}
              loading="lazy"
              onLoad={() => setMapLoaded(true)}
              onError={() => setMapError(true)}
            />
          </>
        ) : (
          <div className="flex h-full items-center justify-center px-3 text-center text-xs font-medium text-slate-500">
            {labels.mapUnavailable}
          </div>
        )}

        <div className="absolute inset-x-3 top-3 flex flex-wrap items-center justify-between gap-2 pe-10">
          <span className="rounded-full border border-slate-200 bg-white/95 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
            {sourceLabel}
          </span>
          <div className="flex items-center gap-2">
            {isExpired && (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                {labels.expiredTag || 'Expired'}
              </span>
            )}
            {trip.isPinned && (
              <span className="rounded-full bg-accent-600 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                {labels.pinnedTag}
              </span>
            )}
          </div>
        </div>
      </div>
      {isSelectable && isSelected && (
        <div className="pointer-events-none absolute inset-0 z-10 bg-accent-500/25" aria-hidden="true" />
      )}

      <div className="space-y-3 p-4">
        <h3 className="line-clamp-2 text-2xl font-black leading-tight tracking-tight text-slate-900">{displayTitle}</h3>

        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <Clock size={15} weight="duotone" className="text-accent-500" />
            {durationDays}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin size={15} weight="duotone" className="text-accent-500" />
            {cityStops.length}
          </span>
          <span className="inline-flex items-center gap-1.5 text-accent-700">
            <CalendarBlank size={14} weight="duotone" />
            {dateRange}
          </span>
        </div>

        <p className="text-sm text-slate-500">{summaryLine}</p>

        {cityStops.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {cityStops.slice(0, 3).map((stop) => (
              <span
                key={`${trip.id}-stop-${stop.id}`}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600"
              >
                {stop.title}
              </span>
            ))}
            {cityStops.length > 3 && (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500">
                +{cityStops.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {cityLanes.length > 0 && (
        <div className="border-t border-slate-100 px-4 py-2.5">
          <div className="flex items-center gap-[2px]">
            {cityLanes.map((cityLane, index) => {
              const routeLane = routeLanes[index];
              return (
                <React.Fragment key={cityLane.id}>
                  <span
                    className="example-city-lane-hitbox block cursor-pointer"
                    data-tooltip={cityLane.title}
                    title={cityLane.title}
                    style={{ flexGrow: cityLane.nights, flexBasis: 0 }}
                  >
                    <span
                      className="example-city-lane block rounded-[1px]"
                      style={{
                        backgroundColor: cityLane.color,
                        color: buildLaneOutlineColor(cityLane.color),
                      }}
                    />
                  </span>
                  {routeLane && (
                    <span
                      className="block h-[3px] self-center rounded-[1px]"
                      style={{
                        flexGrow: routeLane.durationDays,
                        flexBasis: 0,
                        backgroundColor: routeLane.color,
                        opacity: 0.45,
                      }}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {hasCreatorAttribution && creatorHandle && creatorProfilePath && (
        <div className={`${cityLanes.length > 0 ? '' : 'border-t border-slate-100'} border-b border-slate-100 px-4 py-2.5`}>
          <p className="text-xs text-slate-500">
            {labels.creatorPrefix || 'By'}{' '}
            <Link
              to={creatorProfilePath}
              onClick={() => {
                onCreatorClick?.();
                trackEvent('trip_preview_card__creator_handle', {
                  creator_handle: creatorHandle,
                  trip_id: trip.id,
                });
              }}
              className="font-semibold text-slate-700 hover:text-accent-700 hover:underline"
              {...(analyticsAttrs ? analyticsAttrs('creator') : {})}
            >
              @{creatorHandle}
            </Link>
          </p>
        </div>
      )}

      <div className={`${cityLanes.length > 0 || hasCreatorAttribution ? '' : 'border-t border-slate-100'} flex items-center justify-between gap-2 px-4 py-3`}>
        <button
          type="button"
          onClick={() => onOpen(trip)}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-700"
          {...(analyticsAttrs ? analyticsAttrs('open') : {})}
        >
          <ArrowUpRight size={14} weight="bold" />
          {labels.open}
        </button>

        <div className="flex items-center gap-1.5">
          {onArchive && (
            <button
              type="button"
              onClick={() => onArchive(trip)}
              aria-label={labels.archive || 'Archive'}
              title={labels.archive || 'Archive'}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-700 transition-colors hover:bg-rose-100"
              {...(analyticsAttrs ? analyticsAttrs('archive') : {})}
            >
              <Trash size={16} weight="duotone" />
            </button>
          )}

          {onToggleVisibility && (
            <button
              type="button"
              onClick={() => onToggleVisibility(trip)}
              aria-label={isPublic ? labels.makePrivate || 'Private' : labels.makePublic || 'Public'}
              title={isPublic ? labels.makePrivate || 'Private' : labels.makePublic || 'Public'}
              className={[
                'inline-flex h-9 w-9 items-center justify-center rounded-md border transition-colors',
                isPublic
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50',
              ].join(' ')}
              {...(analyticsAttrs ? analyticsAttrs('visibility') : {})}
            >
              {isPublic ? <EyeSlash size={16} weight="duotone" /> : <Eye size={16} weight="duotone" />}
            </button>
          )}

          {showFavoriteAction && onToggleFavorite && (
            <button
              type="button"
              onClick={() => onToggleFavorite(trip)}
              aria-label={trip.isFavorite ? labels.unfavorite : labels.favorite}
              title={trip.isFavorite ? labels.unfavorite : labels.favorite}
              className={[
                'inline-flex h-9 w-9 items-center justify-center rounded-md border transition-colors',
                trip.isFavorite
                  ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                  : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50',
              ].join(' ')}
              {...(analyticsAttrs ? analyticsAttrs('favorite') : {})}
            >
              <Star size={16} weight={trip.isFavorite ? 'fill' : 'duotone'} />
            </button>
          )}

          {showPinAction && onTogglePin && (
            <button
              type="button"
              onClick={() => onTogglePin(trip)}
              aria-label={trip.isPinned ? labels.unpin : labels.pin}
              title={trip.isPinned ? labels.unpin : labels.pin}
              className={[
                'inline-flex h-9 w-9 items-center justify-center rounded-md border transition-colors',
                trip.isPinned
                  ? 'border-accent-200 bg-accent-50 text-accent-700 hover:bg-accent-100'
                  : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50',
              ].join(' ')}
              {...(analyticsAttrs ? analyticsAttrs('pin') : {})}
            >
              <PushPin size={16} weight={trip.isPinned ? 'fill' : 'duotone'} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
};
