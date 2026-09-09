import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Apple, MapPin } from 'lucide-react';

import { buildMapDeepLinks, type MapDeepLinkTarget } from '../../services/mapDeepLinkService';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';

/**
 * "Open in Google Maps / Apple Maps" for one place.
 *
 * Rendered as plain anchors rather than buttons so the links keep their native
 * affordances — long-press, open in a new tab, share. Both apps are always
 * offered: an iPhone that prefers Google Maps is common enough that picking one
 * for the traveller would be wrong as often as it is right.
 */

export interface MapAppLinksProps extends MapDeepLinkTarget {
  /** Where the links are rendered, sent as an analytics payload property. */
  source: 'map_popup' | 'details_panel' | 'stay';
  size?: 'sm' | 'md';
  className?: string;
}

const BASE_LINK_CLASS = 'inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium '
  + 'transition-colors border-gray-200 bg-white text-gray-700 hover:border-accent-300 hover:bg-accent-50 '
  + 'hover:text-accent-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400';

const SIZE_CLASS: Record<'sm' | 'md', string> = {
  sm: 'px-2.5 py-1 text-[11px]',
  md: 'px-3 py-1.5 text-xs',
};

export const MapAppLinks: React.FC<MapAppLinksProps> = ({
  title,
  location,
  coordinates,
  placeId,
  source,
  size = 'md',
  className = '',
}) => {
  const { t } = useTranslation('common');
  const links = useMemo(
    () => buildMapDeepLinks({ title, location, coordinates, placeId }),
    [title, location, coordinates, placeId],
  );

  const handleClick = useCallback((provider: 'google' | 'apple') => {
    trackEvent(
      provider === 'google' ? 'trip_view__map_link--google' : 'trip_view__map_link--apple',
      { source, precise: links?.isPrecise ?? false },
    );
  }, [links?.isPrecise, source]);

  if (!links) return null;

  const linkClass = `${BASE_LINK_CLASS} ${SIZE_CLASS[size]}`;
  const iconSize = size === 'sm' ? 12 : 14;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`.trim()}>
      <a
        href={links.google}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
        onClick={() => handleClick('google')}
        {...getAnalyticsDebugAttributes('trip_view__map_link--google', { source })}
      >
        <MapPin size={iconSize} aria-hidden="true" />
        {t('tripView.mapLinks.google')}
      </a>
      <a
        href={links.apple}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
        onClick={() => handleClick('apple')}
        {...getAnalyticsDebugAttributes('trip_view__map_link--apple', { source })}
      >
        <Apple size={iconSize} aria-hidden="true" />
        {t('tripView.mapLinks.apple')}
      </a>
    </div>
  );
};
