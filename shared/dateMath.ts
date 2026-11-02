import type { AppLanguage, ITrip } from '../types';
import { formatLocalIsoDate } from './tripSpan';
import { DEFAULT_APP_LANGUAGE, getIntlLocaleForAppLanguage } from './appLanguage';

export const formatDate = (date: Date, language: AppLanguage = DEFAULT_APP_LANGUAGE): string => {
  return date.toLocaleDateString(getIntlLocaleForAppLanguage(language), { month: 'short', day: 'numeric', weekday: 'short' });
};

export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const getDaysDifference = (start: string, end: string): number => {
    const d1 = new Date(start);
    const d2 = new Date(end);
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 
};

export const getTripDuration = (items: any[]): number => {
  if (items.length === 0) return 14; // Default view
  let maxEnd = 0;
  items.forEach(item => {
    const end = item.startDateOffset + item.duration;
    if (end > maxEnd) maxEnd = end;
  });
  return Math.max(maxEnd + 2, 10); // Add some buffer
};

export const getDefaultTripDates = (now: Date = new Date()) => {
    // 3 months in future
    const target = new Date(now.getFullYear(), now.getMonth() + 3, 1);

    // Find next Friday (0=Sun, 5=Fri)
    const day = target.getDay();
    const diff = (5 - day + 7) % 7;
    target.setDate(target.getDate() + diff);

    const start = target;
    const end = new Date(start);
    // "Two weeks long, Friday until Saturday" implies ~15/16 days (3 weekends)
    end.setDate(start.getDate() + 15);

    // Format with local calendar components; toISOString() would convert to UTC
    // and shift local midnight to the previous day in UTC+ timezones.
    return {
        startDate: formatLocalIsoDate(start),
        endDate: formatLocalIsoDate(end)
    };
};

// --- Dynamic Title Generation ---
export const generateTripTitle = (trip: ITrip): string => {
    const cities = trip.items.filter(i => i.type === 'city');
    if (cities.length === 0) return "New Trip";

    const baseTitle = trip.title.split('(')[0].trim();
    
    const start = new Date(trip.startDate);
    const end = addDays(start, getTripDuration(trip.items)); // Approx duration
    
    const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
    
    const monthStr = startMonth === endMonth ? startMonth : `${startMonth}-${endMonth}`;
    const totalDays = Math.ceil(getTripDuration(trip.items));

    // Avoid duplicate suffix
    if (trip.title.includes(`(${monthStr}`)) return trip.title;

    return `${baseTitle} (${monthStr}, ${totalDays} Days)`;
};
