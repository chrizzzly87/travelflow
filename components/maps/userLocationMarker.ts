import type { ITimelineItem } from '../../types';
import type { MapCoordinates, RuntimeMarkerHandle } from './mapboxOverlayRuntime';

/**
 * Whether the trip map should offer the traveller's own position at all.
 *
 * The dot is only useful to someone who is on the trip, so it is offered while the trip is
 * running (`todayDayOffset` is set only between the first and last day) or while the visitor's
 * approximate country — from the IP lookup, which is often wrong behind a VPN — is one the trip
 * visits. Everyone else never sees the control and is never asked for their location.
 */
export const shouldOfferUserLocation = ({
  todayDayOffset,
  items,
  visitorCountryCode,
}: {
  todayDayOffset: number | null | undefined;
  items: ITimelineItem[];
  visitorCountryCode: string | null | undefined;
}): boolean => {
  if (typeof todayDayOffset === 'number' && Number.isFinite(todayDayOffset)) return true;
  const visitor = visitorCountryCode?.trim().toUpperCase();
  if (!visitor) return false;
  return items.some((item) => (
    item.type === 'city'
    && typeof item.countryCode === 'string'
    && item.countryCode.trim().toUpperCase() === visitor
  ));
};

/** Zoom the recenter control goes to at least, so the dot lands among streets rather than a country. */
export const USER_LOCATION_RECENTER_MIN_ZOOM = 14;

export const USER_LOCATION_MARKER_Z_INDEX = 360;

/**
 * The "you are here" dot. A live fix pulses in the accent blue; a remembered one is grey and
 * still, so an old position never reads as current.
 */
export const buildUserLocationMarkerHtml = ({ isLive }: { isLive: boolean }): string => {
  const core = isLive ? '#2563eb' : '#94a3b8';
  const halo = isLive ? 'rgba(37, 99, 235, 0.22)' : 'rgba(148, 163, 184, 0.24)';
  const pulse = isLive
    ? '<span data-role="user-location-pulse" style="position:absolute;inset:0;border-radius:9999px;background:rgba(37,99,235,0.35);animation:tf-user-location-pulse 2s ease-out infinite;"></span>'
    : '';
  return [
    '<div data-role="user-location-marker" data-live="', isLive ? 'true' : 'false', '" ',
    'style="position:relative;width:34px;height:34px;display:flex;align-items:center;justify-content:center;pointer-events:none;">',
    '<style>@keyframes tf-user-location-pulse{0%{transform:scale(0.45);opacity:0.9}100%{transform:scale(1.25);opacity:0}}',
    '@media (prefers-reduced-motion: reduce){[data-role="user-location-pulse"]{animation:none!important;opacity:0!important}}</style>',
    pulse,
    `<span style="position:absolute;inset:6px;border-radius:9999px;background:${halo};"></span>`,
    `<span style="position:relative;width:16px;height:16px;border-radius:9999px;background:${core};border:3px solid #ffffff;box-shadow:0 1px 4px rgba(15,23,42,0.35);box-sizing:border-box;"></span>`,
    '</div>',
  ].join('');
};

/**
 * The dot as a Google overlay. Kept apart from the itinerary markers, which are torn down and
 * rebuilt with the route; this one only ever moves.
 */
export const createGoogleUserLocationOverlay = ({
  map,
  position,
  html,
}: {
  map: google.maps.Map;
  position: MapCoordinates;
  html: string;
}): RuntimeMarkerHandle => {
  const overlay = new window.google.maps.OverlayView();
  let element: HTMLDivElement | null = null;
  let currentPosition = position;
  let currentHtml = html;

  overlay.onAdd = function onAdd() {
    element = document.createElement('div');
    element.style.cssText = `position:absolute;transform:translate(-50%,-50%);pointer-events:none;z-index:${USER_LOCATION_MARKER_Z_INDEX};`;
    element.innerHTML = currentHtml;
    this.getPanes()?.overlayLayer.appendChild(element);
  };
  overlay.draw = function draw() {
    if (!element) return;
    const point = this.getProjection()?.fromLatLngToDivPixel(
      new window.google.maps.LatLng(currentPosition.lat, currentPosition.lng),
    );
    if (!point) return;
    element.style.left = `${point.x}px`;
    element.style.top = `${point.y}px`;
  };
  overlay.onRemove = function onRemove() {
    element?.remove();
    element = null;
  };
  overlay.setMap(map);

  return {
    setMap: (next) => overlay.setMap((next as google.maps.Map | null) ?? null),
    update: (updates) => {
      if (updates.position) currentPosition = updates.position;
      if (updates.html !== undefined) {
        currentHtml = updates.html;
        if (element) element.innerHTML = currentHtml;
      }
      overlay.draw();
    },
  };
};
