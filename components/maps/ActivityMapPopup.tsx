import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, MapPin, X } from 'lucide-react';

import type { ITimelineItem } from '../../types';
import { pickPrimaryActivityType } from '../../utils';
import { ActivityTypeIcon } from '../ActivityTypeVisuals';
import { formatActivityTypeLabel, getActivityTypePaletteClass } from '../ActivityTypeVisualsUtils';
import { MapAppLinks } from './MapAppLinks';
import type { MapMarkerAnchor } from './useMapMarkerAnchor';

/**
 * The card that opens when a traveller taps an activity pin.
 *
 * This is a non-modal popover, not a dialog: the map behind it stays usable on
 * purpose, so it carries `role="dialog"` with a label, Escape, outside-click
 * dismissal and focus restored to the pin, but deliberately no focus trap —
 * trapping keyboard focus inside a pin callout would strand anyone trying to
 * pan away from it.
 */

const POPUP_WIDTH = 268;
/** Clearance above the pin so the callout never covers the marker it belongs to. */
const POPUP_GAP = 16;

export interface ActivityMapPopupProps {
  item: ITimelineItem;
  /** Pin position in map-container pixels. */
  anchor: MapMarkerAnchor;
  containerSize: { width: number; height: number };
  /** Position actually drawn on the map, which may be the owner city fallback. */
  markerCoordinatesSource: 'activity' | 'city';
  onClose: () => void;
  onOpenDetails: (activityId: string) => void;
}

export const ActivityMapPopup: React.FC<ActivityMapPopupProps> = ({
  item,
  anchor,
  containerSize,
  markerCoordinatesSource,
  onClose,
  onOpenDetails,
}) => {
  const { t } = useTranslation('common');
  const popupRef = useRef<HTMLDivElement | null>(null);
  const primaryType = useMemo(() => pickPrimaryActivityType(item.activityType), [item.activityType]);

  useEffect(() => {
    // Moving focus into the callout is what makes it reachable by keyboard at
    // all; the pin itself is a plain overlay div.
    popupRef.current?.focus();
  }, [item.id]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    onClose();
  }, [onClose]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && popupRef.current?.contains(target)) return;
      onClose();
    };
    // Capture phase: the map swallows pointer events on its own overlays.
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [onClose]);

  // Keep the callout inside the map viewport, and flip it below the pin when
  // there is no room above.
  const left = Math.min(
    Math.max(anchor.x, POPUP_WIDTH / 2 + 8),
    Math.max(containerSize.width - POPUP_WIDTH / 2 - 8, POPUP_WIDTH / 2 + 8),
  );
  const shouldFlipBelow = anchor.top < 200;
  const top = shouldFlipBelow ? anchor.bottom + POPUP_GAP : anchor.top - POPUP_GAP;

  return (
    <div
      ref={popupRef}
      role="dialog"
      aria-label={t('tripView.mapLinks.popupLabel')}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="pointer-events-auto absolute z-30 rounded-xl border border-gray-200 bg-white p-3 shadow-2xl outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
      style={{
        insetInlineStart: `${left}px`,
        top: `${top}px`,
        width: `${POPUP_WIDTH}px`,
        transform: shouldFlipBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
      }}
      data-testid="activity-map-popup"
    >
      <div className="flex items-start gap-2">
        <span
          className={`flex size-7 shrink-0 items-center justify-center rounded-lg border ${getActivityTypePaletteClass(primaryType)}`}
          aria-hidden="true"
        >
          <ActivityTypeIcon type={primaryType} size={14} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900" title={item.title}>{item.title}</p>
          <p className="text-[11px] font-medium text-gray-500">{formatActivityTypeLabel(primaryType)}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="-me-1 -mt-1 rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          aria-label={t('tripView.mapLinks.close')}
        >
          <X size={14} />
        </button>
      </div>

      {item.location && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-gray-600">
          <MapPin size={13} className="mt-0.5 shrink-0 text-accent-500" aria-hidden="true" />
          <span className="min-w-0 break-words">{item.location}</span>
        </p>
      )}

      {markerCoordinatesSource === 'city' && (
        <p className="mt-1.5 text-[11px] text-amber-600">{t('tripView.mapLinks.approximate')}</p>
      )}

      <MapAppLinks
        title={item.title}
        location={item.location}
        coordinates={item.coordinates}
        placeId={item.placeId}
        source="map_popup"
        size="sm"
        className="mt-3"
      />

      <button
        type="button"
        onClick={() => onOpenDetails(item.id)}
        className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-accent-600 transition-colors hover:text-accent-700"
      >
        {t('tripView.mapLinks.openDetails')}
        <ArrowRight size={12} aria-hidden="true" />
      </button>
    </div>
  );
};
