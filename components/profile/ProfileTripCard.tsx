import React from 'react';
import { ArrowUpRight, CalendarBlank, Clock, MapPin, PushPin, Star } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import type { AppLanguage, ITrip } from '../../types';
import { trackEvent } from '../../services/analyticsService';
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
  makePublic?: string;
  makePrivate?: string;
  pinnedTag: string;
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
  analyticsAttrs?: (action: 'open' | 'favorite' | 'pin' | 'visibility' | 'creator') => Record<string, string>;
  creatorHandle?: string | null;
  creatorProfilePath?: string | null;
  showCreatorAttribution?: boolean;
  onCreatorClick?: () => void;
  showFavoriteAction?: boolean;
  showPinAction?: boolean;
}

export const ProfileTripCard: React.FC<ProfileTripCardProps> = ({
  trip,
  locale,
  sourceLabel,
  labels,
  onOpen,
  onToggleFavorite,
  onTogglePin,
  onToggleVisibility,
  analyticsAttrs,
  creatorHandle = null,
  creatorProfilePath = null,
  showCreatorAttribution = false,
  onCreatorClick,
  showFavoriteAction = true,
  showPinAction = true,
}) => {
  const [mapLoaded, setMapLoaded] = React.useState(false);
  const [mapError, setMapError] = React.useState(false);

  React.useEffect(() => {
    setMapLoaded(false);
    setMapError(false);
  }, [trip.id, locale]);

  const cityStops = React.useMemo(() => getTripCityStops(trip), [trip]);
  const cityItems = React.useMemo(() => getTripCityItems(trip), [trip]);
  const mapUrl = React.useMemo(() => buildMiniMapUrl(trip, locale), [trip, locale]);
  const summaryLine = React.useMemo(() => formatTripSummaryLine(trip, locale), [trip, locale]);
  const dateRange = React.useMemo(() => formatTripDateRange(trip, locale), [trip, locale]);
  const durationDays = React.useMemo(() => getTripDurationDays(trip), [trip]);
  const hasCreatorAttribution = showCreatorAttribution && Boolean(creatorHandle) && Boolean(creatorProfilePath);

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
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-lg">
      <div className="relative h-40 overflow-hidden bg-slate-100">
        {mapUrl && !mapError ? (
          <>
            {!mapLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-100 text-xs font-medium text-slate-500">
                {labels.mapLoading}
              </div>
            )}
            <img
              src={mapUrl}
              alt={`Map preview for ${trip.title}`}
              className="h-full w-full object-cover"
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

        <div className="pointer-events-none absolute inset-inline-0 top-0 h-16 bg-gradient-to-b from-slate-950/45 to-transparent" />

        <div className="absolute inset-x-3 top-3 flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-full bg-white/92 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 shadow-sm">
            {sourceLabel}
          </span>
          {trip.isPinned && (
            <span className="rounded-full bg-accent-600 px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-sm">
              {labels.pinnedTag}
            </span>
          )}
        </div>
      </div>

      <div className="p-4">
        <h3 className="line-clamp-2 text-2xl font-black leading-tight tracking-tight text-slate-900">{trip.title}</h3>

        <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <Clock size={15} weight="duotone" className="text-accent-500" />
            {durationDays}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin size={15} weight="duotone" className="text-accent-500" />
            {cityStops.length}
          </span>
        </div>

        <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-accent-700">
          <CalendarBlank size={14} />
          <span>{dateRange}</span>
        </p>

        <p className="mt-1 text-sm text-slate-500">{summaryLine}</p>

        {cityStops.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
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
                    className="example-city-lane-hitbox block"
                    data-tooltip={cityLane.title}
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

      <div className={`${cityLanes.length > 0 || hasCreatorAttribution ? '' : 'border-t border-slate-100'} flex flex-wrap items-center justify-between gap-2 px-4 py-3`}>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onOpen(trip)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-700"
            {...(analyticsAttrs ? analyticsAttrs('open') : {})}
          >
            <ArrowUpRight size={14} weight="bold" />
            {labels.open}
          </button>
          {showFavoriteAction && onToggleFavorite && (
            <button
              type="button"
              onClick={() => onToggleFavorite(trip)}
              className={[
                'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors',
                trip.isFavorite
                  ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                  : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50',
              ].join(' ')}
              {...(analyticsAttrs ? analyticsAttrs('favorite') : {})}
            >
              <Star size={14} weight={trip.isFavorite ? 'fill' : 'regular'} />
              {trip.isFavorite ? labels.unfavorite : labels.favorite}
            </button>
          )}
          {onToggleVisibility && (
            <button
              type="button"
              onClick={() => onToggleVisibility(trip)}
              className={[
                'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors',
                trip.showOnPublicProfile !== false
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50',
              ].join(' ')}
              {...(analyticsAttrs ? analyticsAttrs('visibility') : {})}
            >
              {trip.showOnPublicProfile !== false ? labels.makePrivate || 'Private' : labels.makePublic || 'Public'}
            </button>
          )}
        </div>

        {showPinAction && onTogglePin && (
          <button
            type="button"
            onClick={() => onTogglePin(trip)}
            className={[
              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors',
              trip.isPinned
                ? 'border-accent-200 bg-accent-50 text-accent-700 hover:bg-accent-100'
                : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50',
            ].join(' ')}
            {...(analyticsAttrs ? analyticsAttrs('pin') : {})}
          >
            <PushPin size={14} weight={trip.isPinned ? 'fill' : 'regular'} />
            {trip.isPinned ? labels.unpin : labels.pin}
          </button>
        )}
      </div>
    </article>
  );
};

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
  '#ec4899',
];

const HEX_COLOR_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const RGB_COLOR_PATTERN = /^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*[0-9.]+\s*)?\)$/i;

const parseHexColor = (color: string): [number, number, number] | null => {
  const normalized = color.trim();
  const match = normalized.match(HEX_COLOR_PATTERN);
  if (!match) return null;
  const raw = match[1];
  const expanded = raw.length === 3 ? raw.split('').map((part) => `${part}${part}`).join('') : raw;
  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);
  if ([red, green, blue].some((channel) => Number.isNaN(channel))) return null;
  return [red, green, blue];
};

const parseRgbColor = (color: string): [number, number, number] | null => {
  const match = color.trim().match(RGB_COLOR_PATTERN);
  if (!match) return null;
  const red = Number.parseFloat(match[1]);
  const green = Number.parseFloat(match[2]);
  const blue = Number.parseFloat(match[3]);
  if ([red, green, blue].some((channel) => !Number.isFinite(channel))) return null;
  return [Math.round(red), Math.round(green), Math.round(blue)];
};

const buildLaneOutlineColor = (color: string): string => {
  if (typeof CSS !== 'undefined' && CSS.supports?.('color', `color(from ${color} srgb r g b / 0.45)`)) {
    return `color(from ${color} srgb r g b / 0.45)`;
  }
  const rgb = parseHexColor(color) || parseRgbColor(color);
  if (!rgb) return 'rgb(15 23 42 / 0.2)';
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.45)`;
};
