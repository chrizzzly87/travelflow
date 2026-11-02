import type { ActivityType } from '../../types';

/**
 * Activity marker icons as plain SVG strings.
 *
 * Map markers are HTML strings, and they used to be produced by rendering
 * `<ActivityTypeIcon>` through `renderToStaticMarkup`. That is a nested Preact
 * render: it drives the same global `options` hooks as the live renderer. The
 * marker effects run inside a live render whenever `preact/hooks` flushes a
 * component's pending effects before its body, and the string render then
 * leaves `preact/debug` believing no render is in progress — the dev server
 * crashed ItineraryMap with "Hook can only be invoked from render methods".
 *
 * These icon nodes are lucide's own (`lucide-react` `__iconNode`, keys dropped)
 * for the icons `ActivityTypeIcon` picks. A parity test compares them with the
 * rendered component, so a lucide upgrade that redraws a glyph fails CI.
 */
type IconNode = ReadonlyArray<readonly [tag: 'path' | 'circle', attrs: Readonly<Record<string, string>>]>;

export const ACTIVITY_ICON_NODES: Readonly<Record<ActivityType, IconNode>> = {
    food: [['path', { d: 'M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2' }], ['path', { d: 'M7 2v20' }], ['path', { d: 'M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7' }]],
    sightseeing: [['path', { d: 'M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z' }], ['circle', { cx: '12', cy: '13', r: '3' }]],
    relaxation: [['path', { d: 'M10 2v2' }], ['path', { d: 'M14 2v2' }], ['path', { d: 'M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1' }], ['path', { d: 'M6 2v2' }]],
    culture: [['path', { d: 'M10 18v-7' }], ['path', { d: 'M11.12 2.198a2 2 0 0 1 1.76.006l7.866 3.847c.476.233.31.949-.22.949H3.474c-.53 0-.695-.716-.22-.949z' }], ['path', { d: 'M14 18v-7' }], ['path', { d: 'M18 18v-7' }], ['path', { d: 'M3 22h18' }], ['path', { d: 'M6 18v-7' }]],
    nightlife: [['path', { d: 'M9 18V5l12-2v13' }], ['circle', { cx: '6', cy: '18', r: '3' }], ['circle', { cx: '18', cy: '16', r: '3' }]],
    sports: [['path', { d: 'M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z' }], ['path', { d: 'm2.5 21.5 1.4-1.4' }], ['path', { d: 'm20.1 3.9 1.4-1.4' }], ['path', { d: 'M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z' }], ['path', { d: 'm9.6 14.4 4.8-4.8' }]],
    hiking: [['path', { d: 'm8 3 4 8 5-5 5 15H2L8 3z' }]],
    wildlife: [['circle', { cx: '11', cy: '4', r: '2' }], ['circle', { cx: '18', cy: '8', r: '2' }], ['circle', { cx: '20', cy: '16', r: '2' }], ['path', { d: 'M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z' }]],
    shopping: [['path', { d: 'M16 10a4 4 0 0 1-8 0' }], ['path', { d: 'M3.103 6.034h17.794' }], ['path', { d: 'M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z' }]],
    adventure: [['circle', { cx: '12', cy: '12', r: '10' }], ['path', { d: 'm16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z' }]],
    beach: [['path', { d: 'M13 8c0-2.76-2.46-5-5.5-5S2 5.24 2 8h2l1-1 1 1h4' }], ['path', { d: 'M13 7.14A5.82 5.82 0 0 1 16.5 6c3.04 0 5.5 2.24 5.5 5h-3l-1-1-1 1h-3' }], ['path', { d: 'M5.89 9.71c-2.15 2.15-2.3 5.47-.35 7.43l4.24-4.25.7-.7.71-.71 2.12-2.12c-1.95-1.96-5.27-1.8-7.42.35' }], ['path', { d: 'M11 15.5c.5 2.5-.17 4.5-1 6.5h4c2-5.5-.5-12-1-14' }]],
    nature: [['path', { d: 'M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z' }], ['path', { d: 'M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12' }]],
    general: [['path', { d: 'M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z' }], ['path', { d: 'M15 5.764v15' }], ['path', { d: 'M9 3.236v15' }]],
};

const ACTIVITY_ICON_MARKUP_CACHE = new Map<string, string>();

export const buildActivityIconInnerMarkup = (type: ActivityType): string => (
    (ACTIVITY_ICON_NODES[type] ?? ACTIVITY_ICON_NODES.general)
        .map(([tag, attrs]) => {
            const attributes = Object.entries(attrs).map(([name, value]) => ` ${name}="${value}"`).join('');
            return `<${tag}${attributes}></${tag}>`;
        })
        .join('')
);

export const buildActivityIconMarkup = (type: ActivityType, iconSize: number): string => {
    const cacheKey = `${type}:${iconSize}`;
    const cached = ACTIVITY_ICON_MARKUP_CACHE.get(cacheKey);
    if (cached) return cached;
    const markup = `<svg style="width:${iconSize}px;height:${iconSize}px;display:block;stroke:currentColor;stroke-width:2.3;color:currentColor;fill:none;" xmlns="http://www.w3.org/2000/svg" width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${buildActivityIconInnerMarkup(type)}</svg>`;
    ACTIVITY_ICON_MARKUP_CACHE.set(cacheKey, markup);
    return markup;
};
