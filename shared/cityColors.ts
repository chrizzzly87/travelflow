import type { ITimelineItem, MapColorMode } from '../types';
import { ACTIVITY_TYPE_COLORS as ACTIVITY_TYPE_COLOR_MAP } from './activityTypes';

// --- COLOR PALETTE DEFINITION ---

export interface ColorDefinition {
    name: string;
    class: string; // Tailwind string
    hex: string;   // Hex code for Map/Canvas
}

export const PRESET_COLORS: ColorDefinition[] = [
    { name: 'Rose', class: 'bg-rose-200 border-rose-300 text-rose-900', hex: '#f43f5e' },
    { name: 'Orange', class: 'bg-orange-200 border-orange-300 text-orange-900', hex: '#f97316' },
    { name: 'Amber', class: 'bg-amber-200 border-amber-300 text-amber-900', hex: '#d97706' },
    { name: 'Emerald', class: 'bg-emerald-200 border-emerald-300 text-emerald-900', hex: '#059669' },
    { name: 'Teal', class: 'bg-teal-200 border-teal-300 text-teal-900', hex: '#0d9488' },
    { name: 'Cyan', class: 'bg-cyan-200 border-cyan-300 text-cyan-900', hex: '#0891b2' },
    { name: 'Sky', class: 'bg-sky-200 border-sky-300 text-sky-900', hex: '#0284c7' },
    { name: 'Indigo', class: 'bg-indigo-200 border-indigo-300 text-indigo-900', hex: '#4f46e5' },
    { name: 'Violet', class: 'bg-violet-200 border-violet-300 text-violet-900', hex: '#7c3aed' },
    { name: 'Fuchsia', class: 'bg-fuchsia-200 border-fuchsia-300 text-fuchsia-900', hex: '#c026d3' },
    { name: 'Slate', class: 'bg-slate-200 border-slate-300 text-slate-900', hex: '#475569' },
    { name: 'Lime', class: 'bg-lime-200 border-lime-300 text-lime-900', hex: '#65a30d' },
];

export const CITY_COLORS = PRESET_COLORS.map(c => c.class);

export type CityColorPaletteId =
    | 'classic'
    | 'pastel'
    | 'vibrant'
    | 'sunset'
    | 'ocean'
    | 'earth'
    | 'nordic'
    | 'blossom';

export interface CityColorPalette {
    id: CityColorPaletteId;
    name: string;
    colors: string[];
}

export const DEFAULT_CITY_COLOR_PALETTE_ID: CityColorPaletteId = 'classic';
export const DEFAULT_MAP_COLOR_MODE: MapColorMode = 'trip';

export const CITY_COLOR_PALETTES: CityColorPalette[] = [
    {
        id: 'classic',
        name: 'Classic',
        colors: PRESET_COLORS.map(color => color.hex),
    },
    {
        id: 'pastel',
        name: 'Pastel',
        colors: ['#f9a8d4', '#fbcfe8', '#fecdd3', '#fde68a', '#a7f3d0', '#bae6fd', '#c7d2fe', '#ddd6fe'],
    },
    {
        id: 'vibrant',
        name: 'Vibrant',
        colors: ['#ef4444', '#f97316', '#f59e0b', '#22c55e', '#14b8a6', '#0ea5e9', '#6366f1', '#d946ef'],
    },
    {
        id: 'sunset',
        name: 'Sunset',
        colors: ['#fb7185', '#f97316', '#f59e0b', '#facc15', '#fb7185', '#c084fc', '#818cf8', '#38bdf8'],
    },
    {
        id: 'ocean',
        name: 'Ocean',
        colors: ['#0f766e', '#0d9488', '#0891b2', '#0284c7', '#2563eb', '#4f46e5', '#38bdf8', '#22d3ee'],
    },
    {
        id: 'earth',
        name: 'Earth',
        colors: ['#92400e', '#b45309', '#ca8a04', '#4d7c0f', '#166534', '#0f766e', '#57534e', '#7c2d12'],
    },
    {
        id: 'nordic',
        name: 'Aurora',
        colors: ['#22d3ee', '#06b6d4', '#0ea5e9', '#38bdf8', '#60a5fa', '#34d399', '#10b981', '#84cc16'],
    },
    {
        id: 'blossom',
        name: 'Blossom',
        colors: ['#f43f5e', '#ec4899', '#f472b6', '#fb7185', '#fda4af', '#e879f9', '#c084fc', '#a78bfa'],
    },
];

const CITY_COLOR_PALETTES_BY_ID = new Map(CITY_COLOR_PALETTES.map((palette) => [palette.id, palette]));

const TAILWIND_BG_HEX_LOOKUP: Record<string, string> = {
    'bg-rose-100': '#ffe4e6',
    'bg-rose-200': '#fecdd3',
    'bg-rose-300': '#fda4af',
    'bg-rose-400': '#fb7185',
    'bg-rose-500': '#f43f5e',
    'bg-pink-100': '#fce7f3',
    'bg-pink-200': '#fbcfe8',
    'bg-pink-300': '#f9a8d4',
    'bg-pink-400': '#f472b6',
    'bg-red-100': '#fee2e2',
    'bg-red-200': '#fecaca',
    'bg-red-300': '#fca5a5',
    'bg-orange-100': '#ffedd5',
    'bg-orange-200': '#fed7aa',
    'bg-orange-300': '#fdba74',
    'bg-amber-100': '#fef3c7',
    'bg-amber-200': '#fde68a',
    'bg-amber-300': '#fcd34d',
    'bg-yellow-100': '#fef9c3',
    'bg-yellow-200': '#fef08a',
    'bg-yellow-300': '#fde047',
    'bg-lime-100': '#ecfccb',
    'bg-lime-200': '#d9f99d',
    'bg-emerald-100': '#d1fae5',
    'bg-emerald-200': '#a7f3d0',
    'bg-green-100': '#dcfce7',
    'bg-green-200': '#bbf7d0',
    'bg-teal-100': '#ccfbf1',
    'bg-teal-200': '#99f6e4',
    'bg-cyan-100': '#cffafe',
    'bg-cyan-200': '#a5f3fc',
    'bg-sky-100': '#e0f2fe',
    'bg-sky-200': '#bae6fd',
    'bg-blue-100': '#dbeafe',
    'bg-blue-200': '#bfdbfe',
    'bg-indigo-100': '#e0e7ff',
    'bg-indigo-200': '#c7d2fe',
    'bg-violet-100': '#ede9fe',
    'bg-violet-200': '#ddd6fe',
    'bg-fuchsia-200': '#f5d0fe',
    'bg-slate-100': '#f1f5f9',
    'bg-slate-200': '#e2e8f0',
    'bg-stone-200': '#e7e5e4',
    'bg-white': '#ffffff',
};

const HEX_COLOR_REGEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const RGB_COLOR_REGEX = /^rgb\(\s*([01]?\d?\d|2[0-4]\d|25[0-5])\s*,\s*([01]?\d?\d|2[0-4]\d|25[0-5])\s*,\s*([01]?\d?\d|2[0-4]\d|25[0-5])\s*\)$/i;
const RGB_CSV_REGEX = /^([01]?\d?\d|2[0-4]\d|25[0-5])\s*,\s*([01]?\d?\d|2[0-4]\d|25[0-5])\s*,\s*([01]?\d?\d|2[0-4]\d|25[0-5])$/;

export const normalizeMapColorMode = (value?: string | null): MapColorMode =>
    value === 'brand' || value === 'trip' ? value : DEFAULT_MAP_COLOR_MODE;

export const normalizeHexColor = (value?: string | null): string | null => {
    if (!value) return null;
    const trimmed = value.trim();
    const match = trimmed.match(HEX_COLOR_REGEX);
    if (!match) return null;

    const raw = match[1].toLowerCase();
    if (raw.length === 3) {
        return `#${raw.split('').map(char => `${char}${char}`).join('')}`;
    }
    return `#${raw}`;
};

const rgbToHex = (r: number, g: number, b: number): string =>
    `#${[r, g, b].map(channel => channel.toString(16).padStart(2, '0')).join('')}`;

export const normalizeRgbColor = (value?: string | null): string | null => {
    if (!value) return null;
    const trimmed = value.trim();

    const rgbMatch = trimmed.match(RGB_COLOR_REGEX);
    if (rgbMatch) {
        const [r, g, b] = rgbMatch.slice(1, 4).map(Number);
        return rgbToHex(r, g, b);
    }

    const csvMatch = trimmed.match(RGB_CSV_REGEX);
    if (csvMatch) {
        const [r, g, b] = csvMatch.slice(1, 4).map(Number);
        return rgbToHex(r, g, b);
    }

    return null;
};

export const normalizeCityColorInput = (value?: string | null): string | null => {
    return normalizeHexColor(value) || normalizeRgbColor(value);
};

const getTailwindBgHex = (value?: string | null): string | null => {
    if (!value) return null;
    const tokens = value.split(/\s+/).filter(Boolean);
    const bgToken = tokens.find(token => token.startsWith('bg-'));
    if (!bgToken) return null;
    return TAILWIND_BG_HEX_LOOKUP[bgToken] || null;
};

export const getCityColorPalette = (paletteId?: string | null): CityColorPalette => {
    if (!paletteId) return CITY_COLOR_PALETTES_BY_ID.get(DEFAULT_CITY_COLOR_PALETTE_ID)!;
    return CITY_COLOR_PALETTES_BY_ID.get(paletteId as CityColorPaletteId) || CITY_COLOR_PALETTES_BY_ID.get(DEFAULT_CITY_COLOR_PALETTE_ID)!;
};

export const getPaletteColorAtIndex = (paletteId: string | null | undefined, index: number): string => {
    const palette = getCityColorPalette(paletteId);
    if (palette.colors.length === 0) return '#4f46e5';
    return palette.colors[Math.max(0, index) % palette.colors.length];
};

export const shiftHexColor = (hex: string, amount: number): string => {
    const normalized = normalizeHexColor(hex) || '#4f46e5';
    const raw = normalized.slice(1);
    const next = [0, 2, 4].map((idx) => {
        const channel = Number.parseInt(raw.slice(idx, idx + 2), 16);
        const shifted = Math.max(0, Math.min(255, channel + amount));
        return shifted.toString(16).padStart(2, '0');
    }).join('');
    return `#${next}`;
};

export const getContrastTextColor = (hex: string): '#000000' | '#ffffff' => {
    const normalized = normalizeHexColor(hex) || '#4f46e5';
    const raw = normalized.slice(1);
    const [r, g, b] = [0, 2, 4].map((idx) => Number.parseInt(raw.slice(idx, idx + 2), 16));

    const toLinear = (channel: number): number => {
        const srgb = channel / 255;
        return srgb <= 0.03928 ? (srgb / 12.92) : (((srgb + 0.055) / 1.055) ** 2.4);
    };

    const getRelativeLuminance = (red: number, green: number, blue: number): number =>
        (0.2126 * toLinear(red)) + (0.7152 * toLinear(green)) + (0.0722 * toLinear(blue));

    const backgroundLuminance = getRelativeLuminance(r, g, b);

    const darkText = '#000000';
    const lightText = '#ffffff';

    const parseHexChannels = (value: string): [number, number, number] => {
        const compact = value.replace('#', '');
        return [
            Number.parseInt(compact.slice(0, 2), 16),
            Number.parseInt(compact.slice(2, 4), 16),
            Number.parseInt(compact.slice(4, 6), 16),
        ];
    };

    const [darkR, darkG, darkB] = parseHexChannels(darkText);
    const [lightR, lightG, lightB] = parseHexChannels(lightText);
    const darkLuminance = getRelativeLuminance(darkR, darkG, darkB);
    const lightLuminance = getRelativeLuminance(lightR, lightG, lightB);

    const getContrastRatio = (a: number, b: number): number => {
        const lighter = Math.max(a, b);
        const darker = Math.min(a, b);
        return (lighter + 0.05) / (darker + 0.05);
    };

    const contrastWithDark = getContrastRatio(backgroundLuminance, darkLuminance);
    const contrastWithLight = getContrastRatio(backgroundLuminance, lightLuminance);
    return contrastWithDark >= contrastWithLight ? darkText : lightText;
};

export const isTailwindCityColorValue = (value?: string | null): boolean => {
    if (!value) return false;
    return value.includes('bg-') && value.includes('border-');
};

export const applyCityPaletteToItems = (
    items: ITimelineItem[],
    paletteId?: string | null
): ITimelineItem[] => {
    const palette = getCityColorPalette(paletteId);
    if (palette.colors.length === 0) return items;

    const colorByCity = new Map<string, string>();
    let cityColorIndex = 0;

    return items.map((item) => {
        if (item.type !== 'city') return item;

        const cityKey = getNormalizedCityName(item.title || item.location) || `__city-${item.id}`;
        if (!colorByCity.has(cityKey)) {
            colorByCity.set(cityKey, palette.colors[cityColorIndex % palette.colors.length]);
            cityColorIndex += 1;
        }

        const paletteColor = colorByCity.get(cityKey) || palette.colors[cityColorIndex % palette.colors.length];
        return item.color === paletteColor ? item : { ...item, color: paletteColor };
    });
};

export const getTripPrimaryCityColorHex = (items: ITimelineItem[]): string => {
    const firstCity = items.reduce<ITimelineItem | null>((earliest, item) => {
        if (item.type !== 'city') return earliest;
        if (!earliest || item.startDateOffset < earliest.startDateOffset) return item;
        return earliest;
    }, null);
    if (!firstCity?.color) return '#4f46e5';
    return getHexFromColorClass(firstCity.color);
};

export const TRAVEL_COLOR = 'bg-stone-800 border-stone-600 text-stone-100';
export const TRAVEL_EMPTY_COLOR = 'bg-white border-dashed border-stone-300 text-stone-400';

export const getRandomCityColor = (index: number) => CITY_COLORS[index % CITY_COLORS.length];
export const getRandomActivityColor = () => ACTIVITY_TYPE_COLOR_MAP.general;

export const getNormalizedCityName = (value?: string): string => {
    if (!value) return '';
    return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
};

// Keep repeated city stops visually linked (e.g., roundtrip start/end).
export const normalizeCityColors = (items: ITimelineItem[]): ITimelineItem[] => {
    const colorByCity = new Map<string, string>();
    let fallbackColorIndex = 0;

    return items.map(item => {
        if (item.type !== 'city') return item;

        const cityKey = getNormalizedCityName(item.title || item.location);
        const fallbackColor = item.color || getRandomCityColor(fallbackColorIndex++);

        if (!cityKey) {
            return item.color === fallbackColor ? item : { ...item, color: fallbackColor };
        }

        if (!colorByCity.has(cityKey)) {
            colorByCity.set(cityKey, fallbackColor);
        }

        const canonicalColor = colorByCity.get(cityKey) || fallbackColor;
        return item.color === canonicalColor ? item : { ...item, color: canonicalColor };
    });
};

// Resolves city color tokens (Tailwind class, hex, rgb) to a solid hex color.
export const getHexFromColorClass = (colorValue: string): string => {
    const directHex = normalizeCityColorInput(colorValue);
    if (directHex) return directHex;

    const presetMatch = PRESET_COLORS.find(c => c.class === colorValue);
    if (presetMatch) return presetMatch.hex;

    const tailwindHex = getTailwindBgHex(colorValue);
    if (tailwindHex) return tailwindHex;

    return '#4f46e5';
};
