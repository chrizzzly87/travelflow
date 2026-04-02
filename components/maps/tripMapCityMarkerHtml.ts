import type { MapImplementation } from '../../shared/mapRuntime';
import { getTripMapProviderPresentation } from './tripMapProviderPresentation';

export interface TripMapCityMarkerVisualProfile {
  shape: 'pin' | 'circle';
  size: number;
  selectedSize: number;
  fontSize: number;
  selectedFontSize: number;
  showInnerDot: boolean;
  numberColor: string;
}

interface BuildTripMapCityMarkerHtmlOptions {
  provider: MapImplementation;
  index: number;
  color: string;
  isSelected: boolean;
  profile: TripMapCityMarkerVisualProfile;
  selectedOutlineColor: string;
  selectedRingColor: string;
  imageUrl?: string | null;
}

const buildTripMapCityMarkerSvgDataUrl = (
  color: string,
  isSelected: boolean,
  profile: TripMapCityMarkerVisualProfile,
  selectedOutlineColor: string,
  selectedRingColor: string,
): { url: string; size: number } => {
  const size = isSelected ? profile.selectedSize : profile.size;
  const pinStroke = isSelected ? selectedOutlineColor : '#ffffff';
  const ringStroke = isSelected ? selectedRingColor : '#dbe3ee';
  const halo = isSelected ? 0.24 : 0.1;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
      <g transform="translate(4 2)">
        <ellipse cx="12" cy="26.2" rx="6.4" ry="2.8" fill="#0f172a" opacity="0.16" />
        <path d="M12 0.9c-5.9 0-10.7 4.8-10.7 10.7 0 7.9 10.7 17.8 10.7 17.8s10.7-9.9 10.7-17.8C22.7 5.7 17.9 0.9 12 0.9z" fill="${color}" stroke="${pinStroke}" stroke-width="${isSelected ? 1.9 : 1.5}" />
        <circle cx="12" cy="11.6" r="${isSelected ? '8.5' : '7.8'}" fill="${color}" opacity="${halo}" />
        <circle cx="12" cy="11.6" r="${isSelected ? '6.3' : '5.8'}" fill="#ffffff" stroke="${ringStroke}" stroke-width="${isSelected ? '1.55' : '1.25'}" />
      </g>
    </svg>
  `;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    size,
  };
};

const buildTripMapCityCircleMarkerHtml = (
  index: number,
  color: string,
  isSelected: boolean,
  profile: TripMapCityMarkerVisualProfile,
  selectedOutlineColor: string,
): string => {
  const size = isSelected ? profile.selectedSize : profile.size;
  const fontSize = isSelected ? profile.selectedFontSize : profile.fontSize;
  const ringColor = '#ffffff';
  const shadow = isSelected
    ? `0 0 0 2px ${selectedOutlineColor}, 0 6px 16px rgba(15,23,42,0.24)`
    : '0 3px 10px rgba(15,23,42,0.15)';
  const innerDotSize = Math.max(11, Math.round(size * 0.54));
  const numberMarkup = `<span style="color:${profile.numberColor};font-weight:800;font-size:${fontSize}px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;pointer-events:none;">${index + 1}</span>`;
  const centerMarkup = profile.showInnerDot
    ? `<div style="width:${innerDotSize}px;height:${innerDotSize}px;border-radius:9999px;background:#ffffff;display:flex;align-items:center;justify-content:center;">${numberMarkup}</div>`
    : numberMarkup;

  return `
    <div style="position:relative;width:${size}px;height:${size}px;line-height:1;user-select:none;">
      <div style="width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:2px solid ${ringColor};box-shadow:${shadow};display:flex;align-items:center;justify-content:center;">
        ${centerMarkup}
      </div>
    </div>
  `;
};

const buildTripMapCityImageMarkerHtml = (
  options: BuildTripMapCityMarkerHtmlOptions,
): string => {
  const {
    provider,
    index,
    color,
    imageUrl,
    isSelected,
    profile,
    selectedOutlineColor,
  } = options;
  const imagePresentation = getTripMapProviderPresentation(provider).markers.city.imageBadge;
  const size = isSelected ? profile.selectedSize : profile.size;
  const imageSize = Math.max(14, Math.round(size * imagePresentation.sizeRatio));
  const numberSize = Math.max(16, Math.round(size * 0.36));
  const borderWidth = imagePresentation.ringWidthPx + (isSelected ? 1 : 0);
  const shadow = isSelected
    ? `0 0 0 2px ${selectedOutlineColor}, 0 10px 22px rgba(15,23,42,0.26)`
    : '0 6px 16px rgba(15,23,42,0.18)';

  return `
    <div style="position:relative;width:${size}px;height:${size}px;line-height:1;user-select:none;">
      <div style="width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:${borderWidth}px solid #ffffff;box-shadow:${shadow};display:flex;align-items:center;justify-content:center;">
        <div style="width:${imageSize}px;height:${imageSize}px;border-radius:9999px;overflow:hidden;background:#ffffff;display:flex;align-items:center;justify-content:center;">
          <img src="${imageUrl}" alt="" draggable="false" style="display:block;width:${imageSize}px;height:${imageSize}px;object-fit:cover;pointer-events:none;" />
        </div>
      </div>
      <div style="position:absolute;right:-1px;bottom:-1px;width:${numberSize}px;height:${numberSize}px;border-radius:9999px;background:#ffffff;border:2px solid ${color};display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(15,23,42,0.18);">
        <span style="color:#0f172a;font-weight:800;font-size:${Math.max(9, Math.round(numberSize * 0.44))}px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;pointer-events:none;">${index + 1}</span>
      </div>
    </div>
  `;
};

export const buildTripMapCityMarkerHtml = (
  options: BuildTripMapCityMarkerHtmlOptions,
): string => {
  const {
    provider,
    index,
    color,
    imageUrl,
    isSelected,
    profile,
    selectedOutlineColor,
    selectedRingColor,
  } = options;

  if (imageUrl && getTripMapProviderPresentation(provider).markers.city.imageBadge.supported) {
    return buildTripMapCityImageMarkerHtml(options);
  }

  if (profile.shape === 'circle') {
    return buildTripMapCityCircleMarkerHtml(
      index,
      color,
      isSelected,
      profile,
      selectedOutlineColor,
    );
  }

  const { url, size } = buildTripMapCityMarkerSvgDataUrl(
    color,
    isSelected,
    profile,
    selectedOutlineColor,
    selectedRingColor,
  );
  const fontSize = isSelected ? profile.selectedFontSize : profile.fontSize;
  const numberTopPercent = isSelected ? 45 : 45.3;
  return `
    <div style="position:relative;width:${size}px;height:${size}px;line-height:1;user-select:none;">
      <img src="${url}" alt="" draggable="false" style="display:block;width:${size}px;height:${size}px;pointer-events:none;" />
      <span style="position:absolute;left:50%;top:${numberTopPercent}%;transform:translate(-50%,-50%);color:#0f172a;font-weight:800;font-size:${fontSize}px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;pointer-events:none;">${index + 1}</span>
    </div>
  `;
};
