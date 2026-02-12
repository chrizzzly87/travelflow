import { ITrip, MapColorMode, MapStyle, RouteMode } from '../../types';
import { CityColorPaletteId, applyCityPaletteToItems, getHexFromColorClass } from '../../utils';

// Re-export validation
export { validateTripSchema } from './_validation';

// Re-export all templates and factories
export { THAILAND_TEMPLATE, createThailandTrip } from './thailand';
export { JAPAN_TEMPLATE, createJapanTrip } from './japan';
export { ITALY_TEMPLATE, createItalyTrip } from './italy';
export { PORTUGAL_TEMPLATE, createPortugalTrip } from './portugal';
export { PERU_TEMPLATE, createPeruTrip } from './peru';
export { NEW_ZEALAND_TEMPLATE, createNewZealandTrip } from './newZealand';
export { MOROCCO_TEMPLATE, createMoroccoTrip } from './morocco';
export { ICELAND_TEMPLATE, createIcelandTrip } from './iceland';

// Import templates and factories for the maps
import { THAILAND_TEMPLATE, createThailandTrip } from './thailand';
import { JAPAN_TEMPLATE, createJapanTrip } from './japan';
import { ITALY_TEMPLATE, createItalyTrip } from './italy';
import { PORTUGAL_TEMPLATE, createPortugalTrip } from './portugal';
import { PERU_TEMPLATE, createPeruTrip } from './peru';
import { NEW_ZEALAND_TEMPLATE, createNewZealandTrip } from './newZealand';
import { MOROCCO_TEMPLATE, createMoroccoTrip } from './morocco';
import { ICELAND_TEMPLATE, createIcelandTrip } from './iceland';

interface ExampleTripTemplateConfig {
    paletteId: CityColorPaletteId;
    mapStyle: MapStyle;
    routeMode: RouteMode;
    mapColorMode: MapColorMode;
    roundTrip?: boolean;
}

const DEFAULT_EXAMPLE_TEMPLATE_CONFIG: ExampleTripTemplateConfig = {
    paletteId: 'classic',
    mapStyle: 'clean',
    routeMode: 'realistic',
    mapColorMode: 'trip',
};

export const EXAMPLE_TRIP_TEMPLATE_CONFIGS: Record<string, ExampleTripTemplateConfig> = {
    'japan-spring': {
        paletteId: 'pastel',
        mapStyle: 'clean',
        routeMode: 'realistic',
        mapColorMode: 'trip',
    },
    'italy-classic': {
        paletteId: 'sunset',
        mapStyle: 'standard',
        routeMode: 'realistic',
        mapColorMode: 'trip',
    },
    'thailand-islands': {
        paletteId: 'ocean',
        mapStyle: 'satellite',
        routeMode: 'simple',
        mapColorMode: 'trip',
        roundTrip: true,
    },
    'portugal-coast': {
        paletteId: 'ocean',
        mapStyle: 'minimal',
        routeMode: 'realistic',
        mapColorMode: 'trip',
    },
    'peru-adventure': {
        paletteId: 'earth',
        mapStyle: 'standard',
        routeMode: 'realistic',
        mapColorMode: 'trip',
        roundTrip: true,
    },
    'new-zealand-wild': {
        paletteId: 'vibrant',
        mapStyle: 'dark',
        routeMode: 'realistic',
        mapColorMode: 'trip',
    },
    'morocco-medina': {
        paletteId: 'sunset',
        mapStyle: 'standard',
        routeMode: 'simple',
        mapColorMode: 'trip',
    },
    'iceland-ring': {
        paletteId: 'nordic',
        mapStyle: 'dark',
        routeMode: 'realistic',
        mapColorMode: 'trip',
        roundTrip: true,
    },
};

export const getExampleTripTemplateConfig = (templateId: string): ExampleTripTemplateConfig => {
    return EXAMPLE_TRIP_TEMPLATE_CONFIGS[templateId] || DEFAULT_EXAMPLE_TEMPLATE_CONFIG;
};

const buildDefaultView = (config: ExampleTripTemplateConfig) => ({
    layoutMode: 'horizontal' as const,
    timelineView: 'horizontal' as const,
    mapStyle: config.mapStyle,
    routeMode: config.routeMode,
    showCityNames: true,
    zoomLevel: 1,
});

const applyTemplateConfigToPartial = (templateId: string, template: Partial<ITrip>): Partial<ITrip> => {
    const config = getExampleTripTemplateConfig(templateId);
    const nextItems = Array.isArray(template.items)
        ? applyCityPaletteToItems(template.items, config.paletteId)
        : template.items;

    return {
        ...template,
        items: nextItems,
        roundTrip: config.roundTrip ?? template.roundTrip,
        cityColorPaletteId: config.paletteId,
        mapColorMode: config.mapColorMode,
        defaultView: buildDefaultView(config),
    };
};

const applyTemplateConfigToTrip = (templateId: string, trip: ITrip): ITrip => {
    const config = getExampleTripTemplateConfig(templateId);
    return {
        ...trip,
        items: applyCityPaletteToItems(trip.items, config.paletteId),
        roundTrip: config.roundTrip ?? trip.roundTrip,
        cityColorPaletteId: config.paletteId,
        mapColorMode: config.mapColorMode,
        defaultView: buildDefaultView(config),
    };
};

/** Map keyed by exampleTripCards id → template */
export const TRIP_TEMPLATES: Record<string, Partial<ITrip>> = {
    'thailand-islands': applyTemplateConfigToPartial('thailand-islands', THAILAND_TEMPLATE),
    'japan-spring': applyTemplateConfigToPartial('japan-spring', JAPAN_TEMPLATE),
    'italy-classic': applyTemplateConfigToPartial('italy-classic', ITALY_TEMPLATE),
    'portugal-coast': applyTemplateConfigToPartial('portugal-coast', PORTUGAL_TEMPLATE),
    'peru-adventure': applyTemplateConfigToPartial('peru-adventure', PERU_TEMPLATE),
    'new-zealand-wild': applyTemplateConfigToPartial('new-zealand-wild', NEW_ZEALAND_TEMPLATE),
    'morocco-medina': applyTemplateConfigToPartial('morocco-medina', MOROCCO_TEMPLATE),
    'iceland-ring': applyTemplateConfigToPartial('iceland-ring', ICELAND_TEMPLATE),
};

/** Map keyed by exampleTripCards id → factory function that creates a full ITrip */
export const TRIP_FACTORIES: Record<string, (startDate: string) => ITrip> = {
    'thailand-islands': (startDate) => applyTemplateConfigToTrip('thailand-islands', createThailandTrip(startDate)),
    'japan-spring': (startDate) => applyTemplateConfigToTrip('japan-spring', createJapanTrip(startDate)),
    'italy-classic': (startDate) => applyTemplateConfigToTrip('italy-classic', createItalyTrip(startDate)),
    'portugal-coast': (startDate) => applyTemplateConfigToTrip('portugal-coast', createPortugalTrip(startDate)),
    'peru-adventure': (startDate) => applyTemplateConfigToTrip('peru-adventure', createPeruTrip(startDate)),
    'new-zealand-wild': (startDate) => applyTemplateConfigToTrip('new-zealand-wild', createNewZealandTrip(startDate)),
    'morocco-medina': (startDate) => applyTemplateConfigToTrip('morocco-medina', createMoroccoTrip(startDate)),
    'iceland-ring': (startDate) => applyTemplateConfigToTrip('iceland-ring', createIcelandTrip(startDate)),
};

export const buildExampleTemplateMapPreviewUrl = (
    templateId: string,
    options?: { width?: number; height?: number; scale?: number }
): string | null => {
    const template = TRIP_TEMPLATES[templateId];
    const cityItems = (template?.items || [])
        .filter((item) => item.type === 'city' && item.coordinates)
        .sort((a, b) => a.startDateOffset - b.startDateOffset);

    if (cityItems.length < 2) return null;

    const config = getExampleTripTemplateConfig(templateId);
    const cityColors = cityItems.map((item) =>
        item.color ? getHexFromColorClass(item.color) : '#4f46e5'
    );
    const firstCityColor = cityColors[0] || '#4f46e5';
    const legColors = cityColors.slice(0, -1);
    const coords = cityItems
        .map((item) => `${item.coordinates!.lat},${item.coordinates!.lng}`)
        .join('|');
    const searchParams = new URLSearchParams();
    searchParams.set('coords', coords);
    searchParams.set('style', config.mapStyle);
    searchParams.set('routeMode', config.routeMode);
    searchParams.set('colorMode', config.mapColorMode);
    searchParams.set('pathColor', firstCityColor);
    if (legColors.length > 0) {
        searchParams.set('legColors', legColors.join('|'));
    }
    const requestedWidth = options?.width ?? 560;
    const requestedHeight = options?.height ?? Math.round((requestedWidth * 288) / 680);
    searchParams.set('w', String(Math.max(280, Math.round(requestedWidth))));
    searchParams.set('h', String(Math.max(180, Math.round(requestedHeight))));
    searchParams.set('scale', String(options?.scale === 2 ? 2 : 1));

    return `/api/trip-map-preview?${searchParams.toString()}`;
};
