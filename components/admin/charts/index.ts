// Admin-only chart foundation on recharts. Import it only from admin route modules
// so the chart library stays out of marketing, auth and planner chunks.
export { AdminBarChart, type AdminBarChartProps } from './AdminBarChart';
export { AdminAreaChart, type AdminAreaChartProps } from './AdminAreaChart';
export { AdminDonutChart, type AdminDonutChartProps } from './AdminDonutChart';
export { AdminBarList, type AdminBarListItem, type AdminBarListProps } from './AdminBarList';
export { type AdminChartTooltipProps, type AdminChartTooltipEntry, type AdminChartRow } from './chartPrimitives';
export { type AdminChartColor, ADMIN_CHART_COLORS } from './chartPalette';
