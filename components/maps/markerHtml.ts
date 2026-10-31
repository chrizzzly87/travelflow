import type { ActivityType } from '../../types';
import { normalizeTransportMode } from '../../shared/transportModes';
import { getActivityTypePaletteParts } from '../ActivityTypeVisualsUtils';
import { buildActivityIconMarkup } from './activityIconMarkup';
import { MARKER_TOOLTIP_HIDDEN_TRANSFORM } from './markerTooltip';
import type { MarkerRenderProfile } from './markerRenderProfiles';

/**
 * HTML for the itinerary map's transport, activity and idea markers.
 * Titles are escaped before they reach the markup. Moved verbatim from
 * `ItineraryMap.tsx`.
 */

export const TRANSPORT_ICON_PATHS: Record<string, string> = {
    plane: 'M240,136v32a8,8,0,0,1-8,8,7.61,7.61,0,0,1-1.57-.16L156,161v23.73l17.66,17.65A8,8,0,0,1,176,208v24a8,8,0,0,1-11,7.43l-37-14.81L91,239.43A8,8,0,0,1,80,232V208a8,8,0,0,1,2.34-5.66L100,184.69V161L25.57,175.84A7.61,7.61,0,0,1,24,176a8,8,0,0,1-8-8V136a8,8,0,0,1,4.42-7.16L100,89.06V44a28,28,0,0,1,56,0V89.06l79.58,39.78A8,8,0,0,1,240,136Z',
    bus: 'M254.07,106.79,208.53,53.73A16,16,0,0,0,196.26,48H32A16,16,0,0,0,16,64V176a16,16,0,0,0,16,16H49a32,32,0,0,0,62,0h50a32,32,0,0,0,62,0h17a16,16,0,0,0,16-16V112A8,8,0,0,0,254.07,106.79ZM32,104V64H88v40Zm48,96a16,16,0,1,1,16-16A16,16,0,0,1,80,200Zm80-96H104V64h56Zm32,96a16,16,0,1,1,16-16A16,16,0,0,1,192,200Zm-16-96V64h20.26l34.33,40Z',
    car: 'M240,112H211.31L168,68.69A15.86,15.86,0,0,0,156.69,64H44.28A16,16,0,0,0,31,71.12L1.34,115.56A8.07,8.07,0,0,0,0,120v48a16,16,0,0,0,16,16H33a32,32,0,0,0,62,0h66a32,32,0,0,0,62,0h17a16,16,0,0,0,16-16V128A16,16,0,0,0,240,112ZM44.28,80H156.69l32,32H23ZM64,192a16,16,0,1,1,16-16A16,16,0,0,1,64,192Zm128,0a16,16,0,1,1,16-16A16,16,0,0,1,192,192Z',
    motorcycle: 'M216,120a41,41,0,0,0-6.6.55l-5.82-15.14A55.64,55.64,0,0,1,216,104a8,8,0,0,0,0-16H196.88L183.47,53.13A8,8,0,0,0,176,48H144a8,8,0,0,0,0,16h26.51l9.23,24H152c-18.5,0-33.5,4.31-43.37,12.46a16,16,0,0,1-16.76,2.07c-10.58-4.81-73.29-30.12-73.8-30.26a8,8,0,0,0-5,15.19S68.57,109.4,79.6,120.4A55.67,55.67,0,0,1,95.43,152H79.2a40,40,0,1,0,0,16h52.12a31.91,31.91,0,0,0,30.74-23.1,56,56,0,0,1,26.59-33.72l5.82,15.13A40,40,0,1,0,216,120ZM40,168H62.62a24,24,0,1,1,0-16H40a8,8,0,0,0,0,16Zm176,16a24,24,0,0,1-15.58-42.23l8.11,21.1a8,8,0,1,0,14.94-5.74L215.35,136l.65,0a24,24,0,0,1,0,48Z',
    train: 'M184,24H72A32,32,0,0,0,40,56V184a32,32,0,0,0,32,32h8L65.6,235.2a8,8,0,1,0,12.8,9.6L100,216h56l21.6,28.8a8,8,0,1,0,12.8-9.6L176,216h8a32,32,0,0,0,32-32V56A32,32,0,0,0,184,24ZM84,184a12,12,0,1,1,12-12A12,12,0,0,1,84,184Zm36-64H56V80h64Zm52,64a12,12,0,1,1,12-12A12,12,0,0,1,172,184Zm28-64H136V80h64Z',
    bicycle: 'M136,52a28,28,0,1,1,28,28A28,28,0,0,1,136,52ZM240,176a40,40,0,1,1-40-40A40,40,0,0,1,240,176Zm-16,0a24,24,0,1,0-24,24A24,24,0,0,0,224,176Zm-24-64a8,8,0,0,0-8-8H155.31L125.66,74.34a8,8,0,0,0-11.32,0l-32,32a8,8,0,0,0,0,11.32L120,155.31V200a8,8,0,0,0,16,0V152a8,8,0,0,0-2.34-5.66L99.31,112,120,91.31l26.34,26.35A8,8,0,0,0,152,120h40A8,8,0,0,0,200,112ZM96,176a40,40,0,1,1-40-40A40,40,0,0,1,96,176Zm-16,0a24,24,0,1,0-24,24A24,24,0,0,0,80,176Z',
    boat: 'M160,140V72.85a4,4,0,0,1,7-2.69l55,60.46a8,8,0,0,1,.43,10.26,8.24,8.24,0,0,1-6.58,3.12H164A4,4,0,0,1,160,140Zm87.21,32.53A8,8,0,0,0,240,168H144V8a8,8,0,0,0-14.21-5l-104,128A8,8,0,0,0,32,144h96v24H16a8,8,0,0,0-6.25,13l29.6,37a15.93,15.93,0,0,0,12.49,6H204.16a15.93,15.93,0,0,0,12.49-6l29.6-37A8,8,0,0,0,247.21,172.53Z',
    walk: 'M216.06,192v12A36,36,0,0,1,144,204V192a8,8,0,0,1,8-8h56A8,8,0,0,1,216.06,192ZM104,160h-56a8,8,0,0,0-8,8v12A36,36,0,0,0,112,180V168A8,8,0,0,0,104,160ZM76,16C64.36,16,53.07,26.31,44.2,45c-13.93,29.38-18.56,73,.29,96a8,8,0,0,0,6.2,2.93h50.55a8,8,0,0,0,6.2-2.93c18.85-23,14.22-66.65.29-96C98.85,26.31,87.57,16,76,16Zm78.8,152h50.55a8,8,0,0,0,6.2-2.93c18.85-23,14.22-66.65.29-96C202.93,50.31,191.64,40,180,40s-22.89,10.31-31.77,29c-13.93,29.38-18.56,73,.29,96A8,8,0,0,0,154.76,168Z',
};

export const resolveTransportIconPath = (mode?: string): string => {
    const normalized = normalizeTransportMode(mode);
    if (normalized === 'na' || !normalized) return TRANSPORT_ICON_PATHS.walk;
    if (normalized === 'motorcycle') return TRANSPORT_ICON_PATHS.motorcycle;
    if (normalized in TRANSPORT_ICON_PATHS) {
        return TRANSPORT_ICON_PATHS[normalized as keyof typeof TRANSPORT_ICON_PATHS];
    }
    return TRANSPORT_ICON_PATHS.walk;
};

export const CITY_PIN_SELECTED_OUTLINE_FALLBACK = '#3b82f6';
export const CITY_PIN_SELECTED_RING_FALLBACK = '#bfdbfe';
export const TRANSPORT_MARKER_VIEWBOX_SIZE = 256;

export const resolveCssColorVar = (name: string, fallback: string): string => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return fallback;
    const value = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
};

export const normalizeRotationDegrees = (value?: number): number => {
    if (!Number.isFinite(value)) return 0;
    const normalized = (value as number) % 360;
    return normalized < 0 ? normalized + 360 : normalized;
};

export const buildTransportMarkerHtml = (
    mode: string | undefined,
    color: string | undefined,
    rotationDegrees: number | undefined,
    profile: MarkerRenderProfile,
): string => {
    const size = profile.transport.size;
    const badgeColor = color || '#1f2937';
    const iconPath = resolveTransportIconPath(mode);
    const rotation = mode === 'plane' ? normalizeRotationDegrees(rotationDegrees) : 0;
    const iconInset = (TRANSPORT_MARKER_VIEWBOX_SIZE * (1 - profile.transport.iconScale)) / 2;
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${TRANSPORT_MARKER_VIEWBOX_SIZE} ${TRANSPORT_MARKER_VIEWBOX_SIZE}">
            <circle cx="128" cy="128" r="112" fill="${badgeColor}" />
            <g transform="rotate(${rotation} 128 128)">
                <g transform="translate(${iconInset} ${iconInset}) scale(${profile.transport.iconScale})">
                    <path d="${iconPath}" fill="#ffffff" />
                </g>
            </g>
        </svg>
    `;
    const url = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    return `
        <div style="width:${size}px;height:${size}px;line-height:1;user-select:none;">
            <img src="${url}" alt="" draggable="false" style="display:block;width:${size}px;height:${size}px;pointer-events:none;" />
        </div>
    `;
};

export const escapeHtml = (value: string): string => (
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
);

export const buildActivityMarkerHtml = (
    type: ActivityType,
    isSelected: boolean,
    title: string | undefined,
    profile: MarkerRenderProfile,
): string => {
    const size = isSelected
        ? profile.activity.size + profile.activity.selectedBoost
        : profile.activity.size;
    const palette = getActivityTypePaletteParts(type);
    const selectedOutlineColor = resolveCssColorVar('--tf-accent-500', '#2563eb');
    const iconMarkup = buildActivityIconMarkup(type, profile.activity.iconSize);
    const tooltipLabel = typeof title === 'string' && title.trim().length > 0
        ? escapeHtml(title.trim())
        : '';
    const tooltipMarkup = tooltipLabel
        ? `<div data-role="activity-marker-tooltip" style="position:absolute;inset:auto auto 100% 50%;transform:${MARKER_TOOLTIP_HIDDEN_TRANSFORM};pointer-events:none;opacity:0;transition:opacity 140ms ease, transform 140ms ease;z-index:30;white-space:nowrap;background:rgba(15,23,42,0.95);color:#f8fafc;border-radius:9999px;padding:${profile.activity.tooltipPaddingY}px ${profile.activity.tooltipPaddingX}px;font-size:${profile.activity.tooltipFontSize}px;font-weight:600;letter-spacing:0.01em;box-shadow:0 8px 24px rgba(15,23,42,0.24);backdrop-filter:blur(6px);">${tooltipLabel}</div>`
        : '';

    return `
        <div style="position:relative;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;line-height:1;user-select:none;">
            <div class="${palette.bg} ${palette.border}" style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;border-radius:9999px;border-width:2px;border-style:solid;box-shadow:${isSelected ? `0 0 0 2px ${selectedOutlineColor}` : 'none'};">
                <div class="${palette.text}" style="position:relative;z-index:1;display:flex;align-items:center;justify-content:center;">${iconMarkup}</div>
            </div>
            ${tooltipMarkup}
        </div>
    `;
};

/**
 * An idea pin: the activity pin's shape with a dashed ring, so it never reads
 * as something already planned. An idea still to review is faded further.
 */
export const buildIdeaMarkerHtml = (
    type: ActivityType,
    pending: boolean,
    title: string,
    profile: MarkerRenderProfile,
): string => {
    const size = Math.max(profile.activity.size - 2, 16);
    const palette = getActivityTypePaletteParts(type);
    const iconMarkup = buildActivityIconMarkup(type, profile.activity.iconSize);
    const tooltip = title.trim()
        ? `<div data-role="activity-marker-tooltip" style="position:absolute;inset:auto auto 100% 50%;transform:${MARKER_TOOLTIP_HIDDEN_TRANSFORM};pointer-events:none;opacity:0;transition:opacity 140ms ease, transform 140ms ease;z-index:30;white-space:nowrap;background:rgba(15,23,42,0.95);color:#f8fafc;border-radius:9999px;padding:${profile.activity.tooltipPaddingY}px ${profile.activity.tooltipPaddingX}px;font-size:${profile.activity.tooltipFontSize}px;font-weight:600;letter-spacing:0.01em;box-shadow:0 8px 24px rgba(15,23,42,0.24);">${escapeHtml(title.trim())}</div>`
        : '';
    const fade = pending ? 'opacity:0.5;filter:saturate(0.45);' : '';
    return `
        <div data-idea-state="${pending ? 'pending' : 'kept'}" style="position:relative;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;line-height:1;user-select:none;">
            <div class="${palette.bg} ${palette.border}" style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;border-radius:9999px;border-width:2px;border-style:dashed;${fade}">
                <div class="${palette.text}" style="display:flex;align-items:center;justify-content:center;">${iconMarkup}</div>
            </div>
            ${tooltip}
        </div>
    `;
};
