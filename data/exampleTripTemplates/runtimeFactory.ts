import { ITrip, MapColorMode, MapStyle, RouteMode } from '../../types';
import { CityColorPaletteId, applyCityPaletteToItems } from '../../utils';

interface ExampleTripTemplateConfig {
    paletteId: CityColorPaletteId;
    mapStyle: MapStyle;
    routeMode: RouteMode;
    mapColorMode: MapColorMode;
    roundTrip?: boolean;
    layoutMode?: 'vertical' | 'horizontal';
    timelineView?: 'vertical' | 'horizontal';
    zoomLevel?: number;
    showCityNames?: boolean;
    sidebarWidth?: number;
    timelineHeight?: number;
    timelineHeightViewportRatio?: number;
}

export interface ExampleTripTemplateSummary {
    title: string;
    countries: { name: string }[];
}

export type ExampleTemplateFactory = (startDate: string) => ITrip;

const DEFAULT_EXAMPLE_TEMPLATE_CONFIG: ExampleTripTemplateConfig = {
    paletteId: 'classic',
    mapStyle: 'clean',
    routeMode: 'realistic',
    mapColorMode: 'trip',
};

const EXAMPLE_TRIP_TEMPLATE_CONFIGS: Record<string, ExampleTripTemplateConfig> = {
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
    'europe-flex-options': {
        paletteId: 'vibrant',
        mapStyle: 'standard',
        routeMode: 'simple',
        mapColorMode: 'trip',
    },
    'southeast-asia-backpacking': {
        paletteId: 'classic',
        mapStyle: 'minimal',
        routeMode: 'realistic',
        mapColorMode: 'trip',
        roundTrip: true,
        layoutMode: 'horizontal',
        timelineView: 'vertical',
        zoomLevel: 0.3,
        timelineHeight: 440,
        timelineHeightViewportRatio: 0.5,
    },
};

const EXAMPLE_TEMPLATE_SUMMARIES: Record<string, ExampleTripTemplateSummary> = {
    'thailand-islands': {
        title: 'Temples & Beaches',
        countries: [{ name: 'Thailand' }],
    },
    'japan-spring': {
        title: 'Cherry Blossom Trail',
        countries: [{ name: 'Japan' }],
    },
    'italy-classic': {
        title: 'Italian Grand Tour',
        countries: [{ name: 'Italy' }],
    },
    'portugal-coast': {
        title: 'Atlantic Coast Road Trip',
        countries: [{ name: 'Portugal' }],
    },
    'peru-adventure': {
        title: 'Andes & Amazon Explorer',
        countries: [{ name: 'Peru' }],
    },
    'new-zealand-wild': {
        title: 'South Island Wilderness',
        countries: [{ name: 'New Zealand' }],
    },
    'morocco-medina': {
        title: 'Medinas & Sahara Nights',
        countries: [{ name: 'Morocco' }],
    },
    'iceland-ring': {
        title: 'Ring Road Circuit',
        countries: [{ name: 'Iceland' }],
    },
    'europe-flex-options': {
        title: 'Mediterranean Forked Itinerary',
        countries: [
            { name: 'Spain' },
            { name: 'Italy' },
        ],
    },
    'southeast-asia-backpacking': {
        title: 'Backpacking South East Asia',
        countries: [
            { name: 'Thailand' },
            { name: 'Cambodia' },
            { name: 'Vietnam' },
            { name: 'Laos' },
        ],
    },
};

const getExampleTripTemplateConfig = (templateId: string): ExampleTripTemplateConfig => {
    return EXAMPLE_TRIP_TEMPLATE_CONFIGS[templateId] || DEFAULT_EXAMPLE_TEMPLATE_CONFIG;
};

const buildDefaultView = (config: ExampleTripTemplateConfig) => {
    const resolvedTimelineHeight = (() => {
        if (typeof window !== 'undefined' && typeof config.timelineHeightViewportRatio === 'number') {
            return Math.max(200, Math.round(window.innerHeight * config.timelineHeightViewportRatio));
        }
        return config.timelineHeight;
    })();

    return {
        layoutMode: config.layoutMode ?? 'horizontal',
        timelineView: config.timelineView ?? 'horizontal',
        mapStyle: config.mapStyle,
        routeMode: config.routeMode,
        showCityNames: config.showCityNames ?? true,
        zoomLevel: config.zoomLevel ?? 1,
        sidebarWidth: config.sidebarWidth,
        timelineHeight: resolvedTimelineHeight,
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

const wrapFactory = (templateId: string, factory: ExampleTemplateFactory): ExampleTemplateFactory => {
    return (startDate: string) => applyTemplateConfigToTrip(templateId, factory(startDate));
};

export const getExampleTemplateSummary = (templateId: string): ExampleTripTemplateSummary | undefined =>
    EXAMPLE_TEMPLATE_SUMMARIES[templateId];

export const loadExampleTemplateFactory = async (templateId: string): Promise<ExampleTemplateFactory | null> => {
    switch (templateId) {
        case 'thailand-islands': {
            const module = await import('./thailand');
            return wrapFactory(templateId, module.createThailandTrip);
        }
        case 'japan-spring': {
            const module = await import('./japan');
            return wrapFactory(templateId, module.createJapanTrip);
        }
        case 'italy-classic': {
            const module = await import('./italy');
            return wrapFactory(templateId, module.createItalyTrip);
        }
        case 'portugal-coast': {
            const module = await import('./portugal');
            return wrapFactory(templateId, module.createPortugalTrip);
        }
        case 'peru-adventure': {
            const module = await import('./peru');
            return wrapFactory(templateId, module.createPeruTrip);
        }
        case 'new-zealand-wild': {
            const module = await import('./newZealand');
            return wrapFactory(templateId, module.createNewZealandTrip);
        }
        case 'morocco-medina': {
            const module = await import('./morocco');
            return wrapFactory(templateId, module.createMoroccoTrip);
        }
        case 'iceland-ring': {
            const module = await import('./iceland');
            return wrapFactory(templateId, module.createIcelandTrip);
        }
        case 'europe-flex-options': {
            const module = await import('./europeFlexible');
            return wrapFactory(templateId, module.createEuropeFlexibleTrip);
        }
        case 'southeast-asia-backpacking': {
            const module = await import('./southeastAsiaBackpacking');
            return wrapFactory(templateId, module.createSoutheastAsiaBackpackingTrip);
        }
        default:
            return null;
    }
};
