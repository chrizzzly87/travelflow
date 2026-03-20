import type { MapImplementation } from '../../shared/mapRuntime';
import type { MapStyle } from '../../types';
import { getTripMapProviderPresentation, type TripMapCityLabelAnchor } from './tripMapProviderPresentation';

const resolveCssColorVar = (name: string, fallback: string): string => {
  if (typeof window === 'undefined') return fallback;
  const rawValue = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return rawValue || fallback;
};

export const resolveTripMapCityLabelPlacement = (
  anchor: TripMapCityLabelAnchor,
  offsetPx: number,
): { transform: string; textAlign: 'left' | 'right' | 'center' } => {
  if (anchor === 'left') {
    return {
      transform: `translate(calc(-100% - ${offsetPx}px), -50%)`,
      textAlign: 'right',
    };
  }
  if (anchor === 'below') {
    return {
      transform: `translate(-50%, ${offsetPx}px)`,
      textAlign: 'center',
    };
  }
  if (anchor === 'above') {
    return {
      transform: `translate(-50%, calc(-100% - ${offsetPx}px))`,
      textAlign: 'center',
    };
  }
  return {
    transform: `translate(${offsetPx}px, -50%)`,
    textAlign: 'left',
  };
};

export const resolveTripMapCityLabelTheme = (style: MapStyle): {
  textColor: string;
  subTextColor: string;
  textShadow: string;
  background: string;
  borderColor: string;
  boxShadow: string;
} => {
  if (style === 'cleanDark' || style === 'dark') {
    return {
      textColor: '#f8fafc',
      subTextColor: resolveCssColorVar('--tf-accent-200', '#c7d2fe'),
      textShadow: '0 1px 2px rgba(11,18,32,0.78)',
      background: 'rgba(11,18,32,0.72)',
      borderColor: 'rgba(199,210,254,0.22)',
      boxShadow: '0 10px 30px rgba(11,18,32,0.28)',
    };
  }

  return {
    textColor: '#0f172a',
    subTextColor: 'var(--tf-primary)',
    textShadow: '0 1px 2px rgba(255,255,255,0.68)',
    background: 'rgba(255,255,255,0.84)',
    borderColor: 'rgba(148,163,184,0.28)',
    boxShadow: '0 10px 30px rgba(148,163,184,0.18)',
  };
};

export const buildTripMapCityLabelHtml = ({
  provider,
  name,
  subLabel,
  anchor,
  style,
  offsetPx,
  compact = false,
}: {
  provider: MapImplementation;
  name: string;
  subLabel?: string;
  anchor: TripMapCityLabelAnchor;
  style: MapStyle;
  offsetPx: number;
  compact?: boolean;
}): string => {
  const theme = resolveTripMapCityLabelTheme(style);
  const placement = resolveTripMapCityLabelPlacement(anchor, offsetPx);
  const maxWidthPx = compact
    ? Math.max(124, Math.round(getTripMapProviderPresentation(provider).cityLabels.maxWidthPx * 0.84))
    : getTripMapProviderPresentation(provider).cityLabels.maxWidthPx;
  const labelGapPx = compact ? 2 : 3;
  const padding = compact ? '5px 10px' : '7px 11px';
  const nameFontSizePx = compact ? 13 : 14;
  const subLabelFontSizePx = compact ? 9 : 10;
  const subLabelMarkup = subLabel
    ? `<div style="font-size:${subLabelFontSizePx}px;font-weight:700;color:${theme.subTextColor};text-transform:uppercase;letter-spacing:0.08em;text-shadow:${theme.textShadow};">${subLabel}</div>`
    : '';

  return `
    <div style="position:relative;width:0;height:0;pointer-events:none;">
      <div style="position:absolute;left:0;top:0;display:flex;flex-direction:column;align-items:center;gap:${labelGapPx}px;max-width:${maxWidthPx}px;white-space:nowrap;transform:${placement.transform};text-align:${placement.textAlign};line-height:1.05;padding:${padding};border-radius:999px;background:${theme.background};border:1px solid ${theme.borderColor};box-shadow:${theme.boxShadow};backdrop-filter:blur(14px);">
        <div style="max-width:${maxWidthPx}px;overflow:hidden;text-overflow:ellipsis;font-size:${nameFontSizePx}px;font-weight:800;color:${theme.textColor};text-shadow:${theme.textShadow};">${name}</div>
        ${subLabelMarkup}
      </div>
    </div>
  `;
};
