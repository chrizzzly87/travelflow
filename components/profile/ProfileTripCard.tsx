import React from 'react';
import { ArrowUpRight, CalendarBlank, MapPin, PushPin, Star } from '@phosphor-icons/react';
import type { AppLanguage, ITrip } from '../../types';
import {
  buildMiniMapUrl,
  formatTripDateRange,
  formatTripSummaryLine,
  getTripCityStops,
} from './tripPreviewUtils';

interface ProfileTripCardLabels {
  open: string;
  favorite: string;
  unfavorite: string;
  pin: string;
  unpin: string;
  pinnedTag: string;
  mapUnavailable: string;
  mapLoading: string;
}

interface ProfileTripCardProps {
  trip: ITrip;
  locale: AppLanguage;
  sourceLabel: string;
  labels: ProfileTripCardLabels;
  onOpen: (trip: ITrip) => void;
  onToggleFavorite: (trip: ITrip) => void;
  onTogglePin: (trip: ITrip) => void;
  analyticsAttrs?: (action: 'open' | 'favorite' | 'pin') => Record<string, string>;
}

export const ProfileTripCard: React.FC<ProfileTripCardProps> = ({
  trip,
  locale,
  sourceLabel,
  labels,
  onOpen,
  onToggleFavorite,
  onTogglePin,
  analyticsAttrs,
}) => {
  const [mapLoaded, setMapLoaded] = React.useState(false);
  const [mapError, setMapError] = React.useState(false);

  React.useEffect(() => {
    setMapLoaded(false);
    setMapError(false);
  }, [trip.id, locale]);

  const cityStops = React.useMemo(() => getTripCityStops(trip), [trip]);
  const mapUrl = React.useMemo(() => buildMiniMapUrl(trip, locale), [trip, locale]);
  const summaryLine = React.useMemo(() => formatTripSummaryLine(trip, locale), [trip, locale]);
  const dateRange = React.useMemo(() => formatTripDateRange(trip, locale), [trip, locale]);

  return (
    <article
      className={[
        'overflow-hidden rounded-2xl border bg-white shadow-sm transition-all',
        trip.isPinned ? 'border-accent-300 ring-1 ring-accent-200' : 'border-slate-200 hover:border-slate-300',
      ].join(' ')}
    >
      <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="p-4 md:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-lg font-black tracking-tight text-slate-900">{trip.title}</h3>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-semibold text-slate-700">
                  {sourceLabel}
                </span>
                {trip.isPinned && (
                  <span className="rounded-full border border-accent-200 bg-accent-50 px-2 py-0.5 font-semibold text-accent-700">
                    {labels.pinnedTag}
                  </span>
                )}
              </div>
            </div>
          </div>

          <p className="mt-2 text-sm text-slate-600">{summaryLine}</p>
          <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-accent-700">
            <CalendarBlank size={14} />
            <span>{dateRange}</span>
          </p>

          {cityStops.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {cityStops.slice(0, 4).map((stop) => (
                <span
                  key={`${trip.id}-stop-${stop.id}`}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600"
                >
                  <MapPin size={11} />
                  {stop.title}
                </span>
              ))}
              {cityStops.length > 4 && (
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-500">
                  +{cityStops.length - 4}
                </span>
              )}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onOpen(trip)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-700"
              {...(analyticsAttrs ? analyticsAttrs('open') : {})}
            >
              <ArrowUpRight size={14} weight="bold" />
              {labels.open}
            </button>
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
          </div>
        </div>

        <div className="border-t border-slate-100 bg-slate-50 p-2 md:border-l md:border-t-0">
          <div className="relative h-36 overflow-hidden rounded-xl border border-slate-200 bg-white md:h-full md:min-h-[190px]">
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
          </div>
        </div>
      </div>
    </article>
  );
};
