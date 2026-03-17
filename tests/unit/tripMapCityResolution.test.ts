import { describe, expect, it, vi } from 'vitest';

import type { ITimelineItem, ITrip } from '../../types';
import {
  buildCityGeocodeQueryCandidates,
  buildTripMapLocationContextQueries,
  mergeResolvedCityCoordinatesIntoItems,
  resolveMissingCityCoordinatesForItems,
} from '../../shared/tripMapCityResolution';

const makeCity = (input: Partial<ITimelineItem> & Pick<ITimelineItem, 'id'>): ITimelineItem => ({
  id: input.id,
  type: 'city',
  title: input.title || input.location || input.id,
  startDateOffset: input.startDateOffset ?? 0,
  duration: input.duration ?? 1,
  color: input.color || '#f43f5e',
  description: input.description || '',
  location: input.location || input.title || input.id,
  coordinates: input.coordinates,
});

describe('shared/tripMapCityResolution', () => {
  it('builds trip-level map focus queries from the input snapshot', () => {
    const trip = {
      id: 'trip-1',
      title: 'Mallorca trip',
      startDate: '2026-06-04',
      items: [],
      createdAt: 0,
      updatedAt: 0,
      aiMeta: {
        provider: 'openai',
        model: 'gpt-5.4',
        generatedAt: '2026-03-10T21:01:34.438Z',
        generation: {
          state: 'succeeded',
          inputSnapshot: {
            flow: 'wizard',
            destinationLabel: 'Mallorca',
            createdAt: '2026-03-10T21:00:48.665Z',
            payload: {
              options: {
                countries: ['Mallorca, Spain'],
                destinationOrder: ['Mallorca, Spain'],
                selectedIslandNames: ['Mallorca'],
                startDestination: 'Mallorca, Spain',
              },
            },
          },
        },
      },
    } satisfies ITrip;

    expect(buildTripMapLocationContextQueries(trip, 'Balearic Islands, Spain')).toEqual([
      'Balearic Islands, Spain',
      'Mallorca',
      'Mallorca, Spain',
    ]);
  });

  it('builds disambiguated geocode candidates for short city names', () => {
    const items = [
      makeCity({ id: 'palma', title: 'Palma', location: 'Palma' }),
      makeCity({
        id: 'soller',
        title: 'Port de Sóller',
        location: 'Port de Sóller, Balearic Islands, Spain',
        coordinates: { lat: 39.7951743, lng: 2.6974736 },
      }),
    ];

    expect(buildCityGeocodeQueryCandidates({
      city: items[0],
      items,
      focusLocationQuery: 'Mallorca, Spain || Mallorca',
    })).toEqual([
      'Palma, Mallorca, Spain',
      'Palma, Mallorca',
      'Palma, Balearic Islands, Spain',
      'Palma, Spain',
      'Palma',
    ]);
  });

  it('fills missing city coordinates from the first successful disambiguated query', async () => {
    const items = [
      makeCity({ id: 'palma', title: 'Palma', location: 'Palma' }),
      makeCity({
        id: 'alcudia',
        title: "Port d'Alcúdia",
        location: "Port d'Alcúdia",
      }),
      makeCity({
        id: 'soller',
        title: 'Port de Sóller',
        location: 'Port de Sóller, Balearic Islands, Spain',
        coordinates: { lat: 39.7951743, lng: 2.6974736 },
      }),
    ];
    const resolver = vi.fn(async (query: string) => {
      if (query === 'Palma, Mallorca, Spain') return { lat: 39.5696, lng: 2.6502 };
      if (query === "Port d'Alcúdia, Mallorca, Spain") return { lat: 39.8416, lng: 3.1324 };
      return null;
    });

    const resolved = await resolveMissingCityCoordinatesForItems({
      items,
      focusLocationQuery: 'Mallorca, Spain',
      resolver,
      cache: new Map(),
    });

    expect(resolved).toEqual({
      palma: { lat: 39.5696, lng: 2.6502 },
      alcudia: { lat: 39.8416, lng: 3.1324 },
    });
    expect(resolver).toHaveBeenCalledWith('Palma, Mallorca, Spain');
    expect(resolver).toHaveBeenCalledWith("Port d'Alcúdia, Mallorca, Spain");
  });

  it('merges resolved city coordinates without touching already-placed stops', () => {
    const items = [
      makeCity({ id: 'palma', title: 'Palma', location: 'Palma' }),
      makeCity({
        id: 'soller',
        title: 'Port de Sóller',
        location: 'Port de Sóller, Balearic Islands, Spain',
        coordinates: { lat: 39.7951743, lng: 2.6974736 },
      }),
    ];

    const merged = mergeResolvedCityCoordinatesIntoItems(items, {
      palma: { lat: 39.5696, lng: 2.6502 },
    });

    expect(merged[0].coordinates).toEqual({ lat: 39.5696, lng: 2.6502 });
    expect(merged[1].coordinates).toEqual({ lat: 39.7951743, lng: 2.6974736 });
  });
});
