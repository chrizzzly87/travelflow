/**
 * Month labels, on their own so a component that renders a month strip does not
 * import 678 KB of country travel data for a 12-string array.
 */
export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
