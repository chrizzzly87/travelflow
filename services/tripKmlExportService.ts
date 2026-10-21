import type { ICoordinates, ITimelineItem, ITrip } from '../types';
import { buildApprovedCityRoute } from '../utils';
import { isDayTrip, resolveActivityStay } from '../shared/activityStay';
import { hasIdeaCoordinates, TRAVELFLOW_STOPS_FOLDER_ID } from '../shared/googleMyMaps';
import type { SavedRecommendation } from '../shared/recommendations';
import { sanitizeCalendarFileName } from './calendarIcsService';

/**
 * Writes a trip as a KML file that Google My Maps (and Google Earth) can
 * import. My Maps turns each folder into a layer, so the file is laid out in
 * the layers a traveller would want to toggle: the route, the stops, the
 * planned activities, day trips and the ideas not yet planned.
 *
 * Only places with a known position are written. My Maps would otherwise try
 * to geocode a bare name, and a wrong guess on someone's map is worse than a
 * missing pin.
 */

export interface TripKmlLabels {
    route: string;
    stops: string;
    activities: string;
    dayTrips: string;
    ideas: string;
}

export interface BuildTripKmlInput {
    trip: ITrip;
    labels: TripKmlLabels;
    /** Kept ideas, which live outside `trip.items`. */
    ideas?: SavedRecommendation[];
    locale?: string;
}

export interface TripKmlBundle {
    kml: string;
    fileName: string;
    placeCount: number;
    /** Places left out because they have no position. */
    skippedCount: number;
}

const escapeXml = (value: string): string => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const hasCoordinates = (coordinates: ICoordinates | undefined): coordinates is ICoordinates => (
    Boolean(coordinates) && Number.isFinite(coordinates!.lat) && Number.isFinite(coordinates!.lng)
);

/** KML is `lng,lat`, and six decimals is ten centimetres. */
const formatCoordinate = ({ lat, lng }: ICoordinates): string => `${lng.toFixed(6)},${lat.toFixed(6)},0`;

/** KML colours are `aabbggrr`. */
const STYLES = {
    route: { id: 'tf-route', color: 'ff8f4f4f' },
    stop: { id: 'tf-stop', color: 'ffe54f4f' },
    activity: { id: 'tf-activity', color: 'ff2f9ae5' },
    dayTrip: { id: 'tf-day-trip', color: 'ff5aa31a' },
    idea: { id: 'tf-idea', color: 'ff9e9e9e' },
} as const;

/** My Maps' own stock marker, which it recolours from the style's `color`. */
const MARKER_ICON = 'https://www.gstatic.com/mapspro/images/stock/503-wht-blank_maps.png';

const buildStyles = (): string => [
    `<Style id="${STYLES.route.id}"><LineStyle><color>${STYLES.route.color}</color><width>4</width></LineStyle></Style>`,
    ...[STYLES.stop, STYLES.activity, STYLES.dayTrip, STYLES.idea].map((style) => (
        `<Style id="${style.id}"><IconStyle><color>${style.color}</color><scale>1</scale>`
        + `<Icon><href>${MARKER_ICON}</href></Icon></IconStyle></Style>`
    )),
].join('\n    ');

interface PlacemarkInput {
    name: string;
    styleId: string;
    coordinates: ICoordinates;
    descriptionLines: Array<string | null | undefined>;
    address?: string | null;
}

const buildPlacemark = ({ name, styleId, coordinates, descriptionLines, address }: PlacemarkInput): string => {
    const description = descriptionLines
        .map((line) => (line ?? '').trim())
        .filter(Boolean)
        .join('\n');
    return [
        '<Placemark>',
        `<name>${escapeXml(name)}</name>`,
        address ? `<address>${escapeXml(address)}</address>` : '',
        description ? `<description>${escapeXml(description)}</description>` : '',
        `<styleUrl>#${styleId}</styleUrl>`,
        `<Point><coordinates>${formatCoordinate(coordinates)}</coordinates></Point>`,
        '</Placemark>',
    ].filter(Boolean).join('');
};

const buildFolder = (id: string, name: string, placemarks: string[]): string => (
    placemarks.length === 0
        ? ''
        : `<Folder id="${id}"><name>${escapeXml(name)}</name>\n      ${placemarks.join('\n      ')}\n    </Folder>`
);

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const createDateFormatter = (trip: ITrip, locale: string | undefined) => {
    const start = Date.parse(`${trip.startDate}T00:00:00Z`);
    const formatter = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' });
    return (offset: number): string | null => {
        if (!Number.isFinite(start)) return null;
        return formatter.format(new Date(start + Math.floor(offset + 0.00001) * MS_PER_DAY));
    };
};

export const buildTripKml = ({ trip, labels, ideas = [], locale }: BuildTripKmlInput): TripKmlBundle => {
    const formatDay = createDateFormatter(trip, locale);
    const cities = trip.items.filter((item) => item.type === 'city');
    const route = buildApprovedCityRoute(cities);
    const routeIds = new Set(route.map((city) => city.id));
    let skippedCount = 0;

    const stopPlacemarks: string[] = [];
    route.forEach((city) => {
        if (!hasCoordinates(city.coordinates)) {
            skippedCount += 1;
            return;
        }
        const firstDay = formatDay(city.startDateOffset);
        const lastDay = formatDay(city.startDateOffset + Math.max(city.duration, 0));
        stopPlacemarks.push(buildPlacemark({
            name: city.title,
            styleId: STYLES.stop.id,
            coordinates: city.coordinates,
            address: city.location || null,
            descriptionLines: [
                firstDay && lastDay && firstDay !== lastDay ? `${firstDay} – ${lastDay}` : firstDay,
                ...(city.hotels ?? []).map((hotel) => `🛏 ${hotel.name}`),
                city.description,
            ],
        }));
    });

    const routeCoordinates = route
        .map((city) => city.coordinates)
        .filter(hasCoordinates)
        .map(formatCoordinate);
    const routePlacemark = routeCoordinates.length >= 2
        ? `<Placemark><name>${escapeXml(trip.title)}</name><styleUrl>#${STYLES.route.id}</styleUrl>`
            + `<LineString><tessellate>1</tessellate><coordinates>${routeCoordinates.join(' ')}</coordinates></LineString></Placemark>`
        : null;

    const activityPlacemarks: string[] = [];
    const dayTripPlacemarks: string[] = [];
    const routeCities = cities.filter((city) => routeIds.has(city.id));
    trip.items
        .filter((item): item is ITimelineItem => item.type === 'activity')
        .sort((a, b) => a.startDateOffset - b.startDateOffset)
        .forEach((activity) => {
            if (!hasCoordinates(activity.coordinates)) {
                skippedCount += 1;
                return;
            }
            const stay = resolveActivityStay(activity, routeCities.length > 0 ? routeCities : cities);
            const dayTrip = isDayTrip(activity);
            const placemark = buildPlacemark({
                name: activity.title,
                styleId: dayTrip ? STYLES.dayTrip.id : STYLES.activity.id,
                coordinates: activity.coordinates,
                address: activity.location || null,
                descriptionLines: [
                    [formatDay(activity.startDateOffset), stay?.title].filter(Boolean).join(' · '),
                    activity.description,
                    activity.link,
                ],
            });
            (dayTrip ? dayTripPlacemarks : activityPlacemarks).push(placemark);
        });

    const ideaPlacemarks: string[] = [];
    ideas.forEach((idea) => {
        if (!hasIdeaCoordinates(idea)) {
            skippedCount += 1;
            return;
        }
        ideaPlacemarks.push(buildPlacemark({
            name: idea.title,
            styleId: STYLES.idea.id,
            coordinates: { lat: idea.location.lat as number, lng: idea.location.lng as number },
            address: idea.location.address,
            descriptionLines: [
                idea.description || idea.summary,
                ...idea.sources
                    .filter((source) => source.kind !== 'google_maps' && source.url)
                    .map((source) => source.url),
            ],
        }));
    });

    const folders = [
        routePlacemark ? buildFolder('tf-route', labels.route, [routePlacemark]) : '',
        buildFolder(TRAVELFLOW_STOPS_FOLDER_ID, labels.stops, stopPlacemarks),
        buildFolder('tf-activities', labels.activities, activityPlacemarks),
        buildFolder('tf-day-trips', labels.dayTrips, dayTripPlacemarks),
        buildFolder('tf-ideas', labels.ideas, ideaPlacemarks),
    ].filter(Boolean);

    const kml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<kml xmlns="http://www.opengis.net/kml/2.2">',
        '  <Document>',
        `    <name>${escapeXml(trip.title)}</name>`,
        `    ${buildStyles()}`,
        ...folders.map((folder) => `    ${folder}`),
        '  </Document>',
        '</kml>',
        '',
    ].join('\n');

    return {
        kml,
        fileName: sanitizeCalendarFileName(`${trip.title || 'trip'}-map`),
        placeCount: stopPlacemarks.length + activityPlacemarks.length + dayTripPlacemarks.length + ideaPlacemarks.length,
        skippedCount,
    };
};

export const downloadTripKml = (bundle: TripKmlBundle): boolean => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return false;
    const blob = new Blob([bundle.kml], { type: 'application/vnd.google-earth.kml+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    try {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${bundle.fileName}.kml`;
        anchor.rel = 'noopener';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        return true;
    } finally {
        URL.revokeObjectURL(url);
    }
};
