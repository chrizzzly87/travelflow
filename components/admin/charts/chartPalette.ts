/**
 * Named series colours for the admin charts. Each name maps to a token in
 * `styles/admin-charts.css`; keep the two lists in step.
 */
export const ADMIN_CHART_COLORS = [
    'blue',
    'cyan',
    'sky',
    'indigo',
    'violet',
    'purple',
    'fuchsia',
    'slate',
    'gray',
    'red',
    'orange',
    'amber',
    'yellow',
    'lime',
    'green',
    'emerald',
    'teal',
    'pink',
    'rose',
] as const;

export type AdminChartColor = (typeof ADMIN_CHART_COLORS)[number];

/** Series order used when a chart does not name its colours. */
export const DEFAULT_ADMIN_CHART_COLORS: readonly AdminChartColor[] = ADMIN_CHART_COLORS;

const KNOWN_COLORS = new Set<string>(ADMIN_CHART_COLORS);

export const isAdminChartColor = (value: unknown): value is AdminChartColor => (
    typeof value === 'string' && KNOWN_COLORS.has(value)
);

export const adminChartColorVar = (color: AdminChartColor): string => `var(--admin-chart-${color})`;

/** Colour for the series at `index`, cycling through the given (or default) palette. */
export const resolveAdminChartColor = (
    index: number,
    colors?: readonly AdminChartColor[],
): AdminChartColor => {
    const palette = colors && colors.length > 0 ? colors : DEFAULT_ADMIN_CHART_COLORS;
    return palette[index % palette.length];
};

export type AdminChartValueFormatter = (value: number) => string;

export const defaultAdminChartValueFormatter: AdminChartValueFormatter = (value) => String(value);

export const toChartNumber = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};
