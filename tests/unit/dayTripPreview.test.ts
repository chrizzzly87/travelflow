import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ITimelineItem } from '../../types';
import { makeCityItem, makeTrip } from '../helpers/tripFixtures';
import {
  buildDashedSegments,
  buildGoogleDayTripParams,
  buildMapboxDayTripOverlays,
  buildMapPreviewDayTrips,
  buildTripLaneDayTripMarks,
  MAX_MAP_PREVIEW_DAY_TRIPS,
  parseMapPreviewDayTrips,
  serializeMapPreviewDayTrips,
} from '../../shared/dayTripPreview';
import { buildMiniMapUrl } from '../../components/profile/tripPreviewUtils';
import { resolvePreviewUpstreamUrl } from '../../netlify/edge-functions/trip-map-preview.ts';
import { PREVIEW_CACHE_QUERY_PARAMS } from '../../netlify/edge-lib/trip-map-preview-guard.ts';
import { buildTripOgSummary, formatDayTripsLabel } from '../../netlify/edge-lib/trip-og-data.ts';
import { buildExampleTemplateMapPreviewUrl, getExampleTemplateMiniCalendar, TRIP_TEMPLATES } from '../../data/exampleTripTemplates';
import { exampleTripCards } from '../../data/exampleTripCards';

const makeDayTrip = (input: Partial<ITimelineItem> & Pick<ITimelineItem, 'id' | 'startDateOffset'>): ITimelineItem => ({
  type: 'activity',
  title: 'Day trip',
  duration: 0.4,
  color: 'bg-sky-100',
  activityKind: 'day-trip',
  ...input,
});

const osakaTripItems = (): ITimelineItem[] => [
  makeCityItem({
    id: 'kyoto',
    title: 'Kyoto',
    startDateOffset: 0,
    duration: 3,
    color: '#dc2626',
    coordinates: { lat: 35.0116, lng: 135.7681 },
  }),
  makeCityItem({
    id: 'osaka',
    title: 'Osaka',
    startDateOffset: 3,
    duration: 4,
    color: '#16a34a',
    coordinates: { lat: 34.6937, lng: 135.5023 },
  }),
  makeDayTrip({
    id: 'nara',
    title: 'Nara Day Trip',
    location: 'Nara, Japan',
    startDateOffset: 4.3,
    stayCityId: 'osaka',
    coordinates: { lat: 34.6851, lng: 135.843 },
  }),
  makeDayTrip({
    id: 'kobe',
    title: 'Kobe Day Trip',
    location: 'Kobe, Hyogo, Japan',
    startDateOffset: 5.3,
    stayCityId: 'osaka',
    coordinates: { lat: 34.6901, lng: 135.1955 },
  }),
];

describe('shared/dayTripPreview encoding', () => {
  it('round-trips day trips through the preview URL parameter', () => {
    const encoded = serializeMapPreviewDayTrips([
      { stayIndex: 1, destination: { lat: 34.6851, lng: 135.843 }, color: '16a34a' },
      { stayIndex: 0, destination: { lat: -12.5, lng: -77.25 }, color: 'dc2626', returnIndex: 2 },
    ]);
    expect(encoded).toBe('1,34.68510,135.84300,16a34a|0,-12.50000,-77.25000,dc2626,2');
    expect(parseMapPreviewDayTrips(encoded, 3)).toEqual([
      { stayIndex: 1, destination: { lat: 34.6851, lng: 135.843 }, color: '16a34a' },
      { stayIndex: 0, destination: { lat: -12.5, lng: -77.25 }, color: 'dc2626', returnIndex: 2 },
    ]);
  });

  it('drops malformed entries and indexes the preview does not have, without failing the rest', () => {
    const parsed = parseMapPreviewDayTrips('5,34.6,135.8,16a34a|x,1,2,ffffff|0,95,10,ffffff|0,34.6,135.8,nothex,9|0,34.6,135.8,16a34a', 2);
    expect(parsed).toEqual([
      { stayIndex: 0, destination: { lat: 34.6, lng: 135.8 }, color: '' },
      { stayIndex: 0, destination: { lat: 34.6, lng: 135.8 }, color: '16a34a' },
    ]);
    expect(parseMapPreviewDayTrips('0,1,1,ffffff|'.repeat(80), 2)).toEqual([]);
  });

  it('caps a preview at the day-trip limit', () => {
    const items: ITimelineItem[] = [
      makeCityItem({ id: 'base', title: 'Base', startDateOffset: 0, duration: 30, coordinates: { lat: 10, lng: 10 } }),
      ...Array.from({ length: MAX_MAP_PREVIEW_DAY_TRIPS + 3 }, (_, index) => makeDayTrip({
        id: `trip-${index}`,
        startDateOffset: index + 0.3,
        stayCityId: 'base',
        coordinates: { lat: 10 + index / 100, lng: 10.5 },
      })),
    ];
    expect(buildMapPreviewDayTrips(items, [items[0]], () => '#aabbcc')).toHaveLength(MAX_MAP_PREVIEW_DAY_TRIPS);
  });

  it('cuts a spoke into equal dashes that start at the stay and end at the destination', () => {
    const dashes = buildDashedSegments({ lat: 0, lng: 0 }, { lat: 0, lng: 7 }, 4);
    expect(dashes).toHaveLength(4);
    expect(dashes[0][0]).toEqual({ lat: 0, lng: 0 });
    expect(dashes[3][1].lng).toBeCloseTo(7);
    expect(dashes[1][0].lng).toBeCloseTo(2);
  });

  it('draws only the outbound spoke for a round trip, and a second one when the day ends at another stay', () => {
    const coords = [{ lat: 0, lng: 0 }, { lat: 0, lng: 10 }];
    const roundTrip = buildGoogleDayTripParams([{ stayIndex: 0, destination: { lat: 1, lng: 1 }, color: 'aabbcc' }], coords, '000000');
    const onward = buildGoogleDayTripParams([{ stayIndex: 0, destination: { lat: 1, lng: 1 }, color: 'aabbcc', returnIndex: 1 }], coords, '000000');
    expect(onward.paths.length).toBe(roundTrip.paths.length * 2);
    expect(roundTrip.markers).toEqual(['size:tiny|color:0x7a8b9c|1.00000,1.00000']);

    const mapbox = buildMapboxDayTripOverlays([{ stayIndex: 0, destination: { lat: 1, lng: 1 }, color: '' }], coords, '123456');
    expect(mapbox.pins).toEqual(['pin-s-attraction+123456(1.00000,1.00000)']);
    expect(mapbox.paths.every((path) => path.startsWith('path-3+123456-0.9('))).toBe(true);
  });
});

describe('trip card preview URLs', () => {
  it('sends day trips in their stay colour, pointing at the stay on the route', () => {
    const url = buildMiniMapUrl(makeTrip({ items: osakaTripItems() }), 'en');
    const params = new URL(url!, 'https://travelflow.local').searchParams;
    expect(params.get('dayTrips')).toBe('1,34.68510,135.84300,16a34a|1,34.69010,135.19550,16a34a');
  });

  it('leaves the URL of a trip without day trips untouched, so its cached picture stays valid', () => {
    const items = osakaTripItems().filter((item) => item.type === 'city');
    const url = buildMiniMapUrl(makeTrip({ items }), 'en');
    expect(new URL(url!, 'https://travelflow.local').searchParams.has('dayTrips')).toBe(false);
  });

  it('keys the CDN cache on the day-trip parameter', () => {
    expect(PREVIEW_CACHE_QUERY_PARAMS).toContain('dayTrips');
  });
});

describe('trip-map-preview edge rendering of day trips', () => {
  const useEnv = (edgeEnv: Record<string, string>) => {
    vi.stubGlobal('Deno', { env: { get: (name: string) => edgeEnv[name] } });
  };
  const upstreamUrlFor = async (query: string): Promise<string> => {
    const resolution = await resolvePreviewUpstreamUrl(new Request(`https://travelflow.example/api/trip-map-preview?${query}`));
    return resolution.ok ? resolution.url : '';
  };
  const query = 'coords=35.0116,135.7681|34.6937,135.5023&colorMode=trip&dayTrips=1,34.6851,135.843,16a34a';

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('adds dashed spokes and a destination marker on Google', async () => {
    useEnv({ VITE_GOOGLE_MAPS_API_KEY: 'test-google-key', VITE_MAPBOX_ACCESS_TOKEN: '', VITE_MAP_RUNTIME_PRESET: 'google_all' });
    const params = new URL(await upstreamUrlFor(query)).searchParams;
    expect(params.getAll('markers')).toContain('size:tiny|color:0x00731a|34.68510,135.84300');
    expect(params.getAll('path').filter((path) => path.startsWith('color:0x16a34ae6|weight:3|'))).toHaveLength(4);
  });

  it('adds dashed spokes and a destination pin on Mapbox, with no Directions calls', async () => {
    useEnv({ VITE_GOOGLE_MAPS_API_KEY: '', VITE_MAPBOX_ACCESS_TOKEN: 'test-mapbox-token', VITE_MAP_RUNTIME_PRESET: 'mapbox_all' });
    const fetchMock = vi.fn(async () => new Response('{}', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);
    const url = decodeURIComponent(await upstreamUrlFor(query));
    expect(url).toContain('pin-s-attraction+16a34a(135.84300,34.68510)');
    expect(url.match(/path-3\+16a34a-0\.9\(/g)).toHaveLength(4);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('trip OG data', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('names the day trips in the label and the share description', async () => {
    const trip = { title: 'Kansai', startDate: '2026-04-01', items: osakaTripItems() };
    expect(formatDayTripsLabel(trip)).toBe('2 day trips · Nara, Kobe');
    expect(formatDayTripsLabel({ items: osakaTripItems().slice(0, 2) })).toBeNull();

    const summary = await buildTripOgSummary(trip, { includeMapImage: false });
    expect(summary.dayTripsLabel).toBe('2 day trips · Nara, Kobe');
    expect(summary.description).toMatch(/• 2 day trips · Nara, Kobe$/);
  });

  it('draws day trips on the OG map', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })));
    const summary = await buildTripOgSummary(
      { title: 'Kansai', startDate: '2026-04-01', items: osakaTripItems() },
      { mapsApiKey: 'test-google-key', mapColorMode: 'trip' },
    );
    const params = new URL(summary.mapImageUrl!).searchParams;
    expect(params.getAll('markers')).toContain('size:tiny|color:0x00731a|34.69010,135.19550');
  });
});

describe('trip card lane day-trip marks', () => {
  it('places each day trip on its stay lane at the middle of its day', () => {
    const marks = buildTripLaneDayTripMarks(osakaTripItems());
    expect(marks.has('kyoto')).toBe(false);
    expect(marks.get('osaka')).toEqual([
      { id: 'nara', label: 'Nara', position: 0.375 },
      { id: 'kobe', label: 'Kobe', position: 0.625 },
    ]);
  });
});

describe('Japan example trip', () => {
  const japan = TRIP_TEMPLATES['japan-spring'];
  const items = japan.items || [];

  it('stays five days in Osaka with day trips to Nara and Kobe', () => {
    const osaka = items.find((item) => item.type === 'city' && item.title === 'Osaka');
    expect(osaka?.duration).toBe(5);
    const osakaDayTrips = items
      .filter((item) => item.activityKind === 'day-trip' && item.stayCityId === osaka?.id)
      .map((item) => item.title);
    expect(osakaDayTrips).toEqual(['Nara Day Trip', 'Kobe Day Trip']);
  });

  it('keeps the card duration in step with the template', () => {
    const lastStayEnd = Math.max(...items
      .filter((item) => item.type === 'city')
      .map((item) => item.startDateOffset + item.duration));
    const card = exampleTripCards.find((entry) => entry.templateId === 'japan-spring');
    expect(card?.durationDays).toBe(lastStayEnd);
  });

  it('shows the day trips on the card lane and in the card map preview', () => {
    const miniCalendar = getExampleTemplateMiniCalendar('japan-spring');
    const osakaLane = miniCalendar?.cityLanes.find((lane) => lane.title === 'Osaka');
    expect(osakaLane?.dayTrips?.map((mark) => mark.label)).toEqual(['Nara', 'Kobe']);

    const previewUrl = buildExampleTemplateMapPreviewUrl('japan-spring');
    const dayTrips = new URL(previewUrl!, 'https://travelflow.local').searchParams.get('dayTrips');
    expect(dayTrips?.split('|')).toHaveLength(3);
  });
});

describe('day-trip lane copy', () => {
  it('has the "Day trip" tooltip label in every locale', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const localesDir = resolve(__dirname, '../../locales');
    const locales = readdirSync(localesDir);
    expect(locales.length).toBeGreaterThanOrEqual(9);
    locales.forEach((locale) => {
      const common = JSON.parse(readFileSync(resolve(localesDir, locale, 'common.json'), 'utf8'));
      const label = common?.tripView?.activityPlan?.kindDayTrip;
      expect(typeof label === 'string' && label.trim().length > 0, locale).toBe(true);
    });
  });
});
