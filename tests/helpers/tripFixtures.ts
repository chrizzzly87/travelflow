import type { ICoordinates, ITimelineItem, ITrip } from '../../types';

interface CityItemInput {
  id: string;
  title: string;
  startDateOffset: number;
  duration: number;
  coordinates?: ICoordinates;
  location?: string;
  color?: string;
}

export const makeCityItem = (input: CityItemInput): ITimelineItem => ({
  id: input.id,
  type: 'city',
  title: input.title,
  location: input.location || input.title,
  startDateOffset: input.startDateOffset,
  duration: input.duration,
  coordinates: input.coordinates || { lat: 0, lng: 0 },
  color: input.color || '#4f46e5',
  description: '',
  activities: [],
  notes: '',
  hotels: [],
  transportMode: 'na',
});

export const makeTravelItem = (id: string, startDateOffset: number, title: string): ITimelineItem => ({
  id,
  type: 'travel',
  title,
  startDateOffset,
  duration: 0.2,
  color: 'bg-stone-800 border-stone-600 text-stone-100',
  description: '',
  transportMode: 'train',
  location: '',
  activities: [],
  notes: '',
  hotels: [],
});

export const makeActivityItem = (id: string, city: string, startDateOffset: number): ITimelineItem => ({
  id,
  type: 'activity',
  title: `Activity in ${city}`,
  location: city,
  startDateOffset,
  duration: 0.5,
  color: 'bg-slate-100 border-slate-300 text-slate-800',
  description: '',
  transportMode: 'na',
  activities: [],
  notes: '',
  hotels: [],
});

export const makeTrip = (overrides: Partial<ITrip> = {}): ITrip => {
  const now = Date.now();
  return {
    id: overrides.id || 'trip-1',
    title: overrides.title || 'Test Trip',
    startDate: overrides.startDate || '2026-05-01',
    endDate: overrides.endDate || '2026-05-10',
    items: overrides.items || [],
    createdAt: typeof overrides.createdAt === 'number' ? overrides.createdAt : now,
    updatedAt: typeof overrides.updatedAt === 'number' ? overrides.updatedAt : now,
    status: overrides.status || 'active',
    isFavorite: overrides.isFavorite || false,
    tripExpiresAt: overrides.tripExpiresAt ?? null,
    sourceKind: overrides.sourceKind || 'created',
    sourceTemplateId: overrides.sourceTemplateId,
    ...overrides,
  };
};
