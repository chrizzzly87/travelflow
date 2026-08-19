/**
 * Generates the two static datasets behind the countries explorer map:
 *
 *  - `data/countryMapGeometry.generated.json` — one pre-projected SVG path per country, so the
 *    map renders as plain inline SVG with **no map library and no runtime projection maths**.
 *  - `data/countryAnchors.generated.json` — one representative coordinate per country, used for
 *    the "nearest to me" sort and for island nations too small to have 110m geometry.
 *
 * Run manually (`pnpm countries:map:generate`) when the upstream sources change. The outputs are
 * committed so neither the build nor the runtime ever touches the network.
 *
 * Anchor precedence is deliberate: the climate normals anchor wins whenever it exists, so the
 * distance sort and `docs/COUNTRY_CLIMATE_DATA.md` always agree about "where a country is".
 * Countries outside the climate dataset fall back to the medoid of their commercial airports,
 * which is the same derivation the climate generator uses.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();

const WORLD_ATLAS_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';
const ISO_CODES_URL = 'https://raw.githubusercontent.com/lukes/ISO-3166-Countries-with-Regional-Codes/master/all/all.json';

/**
 * Plate carrée, cropped to the inhabited latitude band. Antarctica is dropped rather than
 * squeezed in: it carries no travel guides and doubling the map height for it would push the
 * grid below the fold on mobile.
 */
const VIEW_WIDTH = 1000;
const MAX_LATITUDE = 84;
const MIN_LATITUDE = -56;
const VIEW_HEIGHT = Math.round((VIEW_WIDTH * (MAX_LATITUDE - MIN_LATITUDE)) / 360);

/** Douglas–Peucker tolerance and minimum ring extent, both in projected view units. */
const SIMPLIFY_TOLERANCE = 0.35;
const MIN_RING_EXTENT = 0.7;
const COORDINATE_PRECISION = 1;

const EXCLUDED_NUMERIC_IDS = new Set(['010']); // Antarctica

interface TopoTransform { scale: [number, number]; translate: [number, number] }
interface TopoGeometry {
  type: string;
  id?: string;
  arcs?: unknown;
  properties?: { name?: string };
}
interface Topology {
  transform: TopoTransform;
  arcs: number[][][];
  objects: Record<string, { geometries: TopoGeometry[] }>;
}

interface IsoRecord { 'alpha-2': string; 'country-code': string; name: string }

interface AirportRecord {
  countryCode?: string;
  latitude?: number;
  longitude?: number;
  name?: string;
  municipality?: string;
  iataCode?: string | null;
  commercialServiceTier?: string;
  isMajorCommercial?: boolean;
}

type Point = [number, number];

const fetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return (await response.json()) as T;
};

const readJson = async <T>(relativePath: string): Promise<T> => (
  JSON.parse(await fs.readFile(path.join(ROOT, relativePath), 'utf8')) as T
);

// --- topojson decode ---------------------------------------------------------------------------

/** Minimal topojson arc decoder — delta decode, then apply the quantization transform. */
const decodeArcs = (topology: Topology): Point[][] => {
  const { scale, translate } = topology.transform;
  return topology.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map((delta) => {
      x += delta[0];
      y += delta[1];
      return [(x * scale[0]) + translate[0], (y * scale[1]) + translate[1]] as Point;
    });
  });
};

const resolveArc = (arcs: Point[][], index: number): Point[] => (
  index >= 0 ? arcs[index] : arcs[~index].slice().reverse()
);

const ringToPoints = (arcs: Point[][], ring: number[]): Point[] => {
  const points: Point[] = [];
  ring.forEach((index) => {
    const segment = resolveArc(arcs, index);
    // Consecutive arcs share their join point; skip the duplicate.
    for (let i = points.length > 0 ? 1 : 0; i < segment.length; i += 1) points.push(segment[i]);
  });
  return points;
};

const collectPolygons = (geometry: TopoGeometry, arcs: Point[][]): Point[][][] => {
  if (geometry.type === 'Polygon') return [(geometry.arcs as number[][]).map((ring) => ringToPoints(arcs, ring))];
  if (geometry.type === 'MultiPolygon') {
    return (geometry.arcs as number[][][]).map((polygon) => polygon.map((ring) => ringToPoints(arcs, ring)));
  }
  return [];
};

// --- projection + simplification ---------------------------------------------------------------

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const projectEquirectangular = ([longitude, latitude]: Point): Point => ([
  ((longitude + 180) / 360) * VIEW_WIDTH,
  ((MAX_LATITUDE - latitude) / (MAX_LATITUDE - MIN_LATITUDE)) * VIEW_HEIGHT,
]);

/**
 * Longitudes in a topojson ring are absolute, so a ring straddling the antimeridian jumps from
 * +179 to -179 and, projected naively, draws a stripe across the whole map (this is exactly what
 * Fiji and Russia used to do). Unwrapping makes the ring continuous; the caller then clips one
 * copy per 360° shift so both halves survive.
 */
const unwrapLongitudes = (ring: Point[]): Point[] => {
  let offset = 0;
  return ring.map((point, index) => {
    if (index > 0) {
      const delta = point[0] + offset - (ring[index - 1][0] + offset);
      if (delta > 180) offset -= 360;
      else if (delta < -180) offset += 360;
    }
    return [point[0] + offset, point[1]] as Point;
  });
};

type Edge = 'west' | 'east' | 'north' | 'south';

const isInside = (point: Point, edge: Edge): boolean => {
  if (edge === 'west') return point[0] >= -180;
  if (edge === 'east') return point[0] <= 180;
  if (edge === 'north') return point[1] <= MAX_LATITUDE;
  return point[1] >= MIN_LATITUDE;
};

const intersect = (a: Point, b: Point, edge: Edge): Point => {
  if (edge === 'west' || edge === 'east') {
    const x = edge === 'west' ? -180 : 180;
    const t = (x - a[0]) / (b[0] - a[0]);
    return [x, a[1] + (t * (b[1] - a[1]))];
  }
  const y = edge === 'north' ? MAX_LATITUDE : MIN_LATITUDE;
  const t = (y - a[1]) / (b[1] - a[1]);
  return [a[0] + (t * (b[0] - a[0])), y];
};

/**
 * Sutherland–Hodgman clip to the rendered lon/lat window. Clipping (rather than clamping the
 * stray coordinates) is what keeps the Arctic from collapsing into a horizontal bar along the
 * top edge of the map.
 */
const clipRing = (ring: Point[]): Point[] => {
  const edges: Edge[] = ['west', 'east', 'north', 'south'];
  return edges.reduce<Point[]>((input, edge) => {
    if (input.length === 0) return input;
    const output: Point[] = [];
    input.forEach((current, index) => {
      const previous = input[(index + input.length - 1) % input.length];
      const currentInside = isInside(current, edge);
      const previousInside = isInside(previous, edge);
      if (currentInside) {
        if (!previousInside) output.push(intersect(previous, current, edge));
        output.push(current);
      } else if (previousInside) {
        output.push(intersect(previous, current, edge));
      }
    });
    return output;
  }, ring);
};

const perpendicularDistance = (point: Point, start: Point, end: Point): number => {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  if (dx === 0 && dy === 0) return Math.hypot(point[0] - start[0], point[1] - start[1]);
  const t = clamp((((point[0] - start[0]) * dx) + ((point[1] - start[1]) * dy)) / ((dx * dx) + (dy * dy)), 0, 1);
  return Math.hypot(point[0] - (start[0] + (t * dx)), point[1] - (start[1] + (t * dy)));
};

const simplify = (points: Point[], tolerance: number): Point[] => {
  if (points.length <= 3) return points;
  let maxDistance = 0;
  let maxIndex = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const distance = perpendicularDistance(points[i], points[0], points[points.length - 1]);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }
  if (maxDistance <= tolerance) return [points[0], points[points.length - 1]];
  return [
    ...simplify(points.slice(0, maxIndex + 1), tolerance).slice(0, -1),
    ...simplify(points.slice(maxIndex), tolerance),
  ];
};

const ringExtent = (points: Point[]): number => {
  let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
  points.forEach(([x, y]) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  });
  return Math.max(maxX - minX, maxY - minY);
};

const round = (value: number): string => {
  const rounded = Number(value.toFixed(COORDINATE_PRECISION));
  return String(Number.isInteger(rounded) ? rounded : rounded);
};

const ringToPath = (points: Point[]): string => {
  const commands: string[] = [];
  let previous: string | null = null;
  points.forEach((point, index) => {
    const encoded = `${round(point[0])},${round(point[1])}`;
    if (encoded === previous) return;
    previous = encoded;
    commands.push(`${index === 0 ? 'M' : 'L'}${encoded}`);
  });
  if (commands.length < 3) return '';
  return `${commands.join('')}Z`;
};

const LONGITUDE_SHIFTS = [-360, 0, 360];

const buildCountryPath = (polygons: Point[][][]): string => {
  const parts: string[] = [];
  polygons.forEach((polygon) => {
    polygon.forEach((ring) => {
      const unwrapped = unwrapLongitudes(ring);
      LONGITUDE_SHIFTS.forEach((shift) => {
        const shifted = unwrapped.map(([lon, lat]) => [lon + shift, lat] as Point);
        const clipped = clipRing(shifted);
        if (clipped.length < 3) return;
        const projected = clipped.map(projectEquirectangular);
        if (ringExtent(projected) < MIN_RING_EXTENT) return;
        const path = ringToPath(simplify(projected, SIMPLIFY_TOLERANCE));
        if (path) parts.push(path);
      });
    });
  });
  return parts.join('');
};

// --- anchors ------------------------------------------------------------------------------------

const EARTH_RADIUS_KM = 6371;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const greatCircleKm = (a: Point, b: Point): number => {
  const dLat = toRadians(b[1] - a[1]);
  const dLon = toRadians(b[0] - a[0]);
  const h = (Math.sin(dLat / 2) ** 2)
    + (Math.cos(toRadians(a[1])) * Math.cos(toRadians(b[1])) * (Math.sin(dLon / 2) ** 2));
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
};

interface AnchorEntry {
  countryCode: string;
  label: string;
  latitude: number;
  longitude: number;
  derivation: 'climate-normals' | 'airport-medoid';
}

const buildAirportMedoid = (airports: AirportRecord[]): { label: string; latitude: number; longitude: number } | null => {
  const usable = airports.filter((airport) => (
    typeof airport.latitude === 'number' && typeof airport.longitude === 'number'
  ));
  if (usable.length === 0) return null;

  // Prefer the country's major commercial airports; regional fields only decide tiny states.
  const major = usable.filter((airport) => airport.isMajorCommercial);
  const pool = major.length > 0 ? major : usable;

  let best = pool[0];
  let bestCost = Infinity;
  pool.forEach((candidate) => {
    const from: Point = [candidate.longitude as number, candidate.latitude as number];
    const cost = pool.reduce((total, other) => (
      total + greatCircleKm(from, [other.longitude as number, other.latitude as number])
    ), 0);
    if (cost < bestCost) {
      bestCost = cost;
      best = candidate;
    }
  });

  const label = best.iataCode
    ? `${best.municipality || best.name || best.countryCode} (${best.iataCode})`
    : (best.municipality || best.name || String(best.countryCode));

  return {
    label,
    latitude: Number((best.latitude as number).toFixed(4)),
    longitude: Number((best.longitude as number).toFixed(4)),
  };
};

// --- main ---------------------------------------------------------------------------------------

const main = async (): Promise<void> => {
  const [topology, isoRecords] = await Promise.all([
    fetchJson<Topology>(WORLD_ATLAS_URL),
    fetchJson<IsoRecord[]>(ISO_CODES_URL),
  ]);

  const numericToAlpha2 = new Map(isoRecords.map((record) => [record['country-code'], record['alpha-2']]));

  const arcs = decodeArcs(topology);
  const geometries = topology.objects.countries.geometries;

  const countries = geometries
    .filter((geometry) => geometry.id && !EXCLUDED_NUMERIC_IDS.has(geometry.id))
    .map((geometry) => {
      const countryCode = numericToAlpha2.get(String(geometry.id));
      if (!countryCode) return null;
      const d = buildCountryPath(collectPolygons(geometry, arcs));
      if (!d) return null;
      return { countryCode, name: geometry.properties?.name || countryCode, d };
    })
    .filter((entry): entry is { countryCode: string; name: string; d: string } => entry !== null)
    .sort((left, right) => left.countryCode.localeCompare(right.countryCode));

  const geometryDocument = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: {
      provider: 'Natural Earth via world-atlas',
      url: WORLD_ATLAS_URL,
      resolution: '1:110m',
      license: 'Public domain (Natural Earth)',
      codeMapping: ISO_CODES_URL,
    },
    projection: {
      kind: 'equirectangular',
      width: VIEW_WIDTH,
      height: VIEW_HEIGHT,
      minLatitude: MIN_LATITUDE,
      maxLatitude: MAX_LATITUDE,
      note: 'Plate carrée, cropped to the inhabited latitude band. Antarctica is excluded.',
    },
    countries,
  };

  // --- anchors ---
  const climate = await readJson<{ countries: { countryCode: string; anchor: { label: string; latitude: number; longitude: number } }[] }>(
    'data/countryClimateNormals.json',
  );
  const airports = await readJson<AirportRecord[]>('public/data/airports/commercialAirports.generated.json');

  const airportsByCountry = new Map<string, AirportRecord[]>();
  airports.forEach((airport) => {
    const code = typeof airport.countryCode === 'string' ? airport.countryCode.toUpperCase() : null;
    if (!code) return;
    const bucket = airportsByCountry.get(code);
    if (bucket) bucket.push(airport);
    else airportsByCountry.set(code, [airport]);
  });

  const anchorByCountry = new Map<string, AnchorEntry>();
  climate.countries.forEach((entry) => {
    if (!entry?.anchor) return;
    anchorByCountry.set(entry.countryCode, {
      countryCode: entry.countryCode,
      label: entry.anchor.label,
      latitude: entry.anchor.latitude,
      longitude: entry.anchor.longitude,
      derivation: 'climate-normals',
    });
  });

  airportsByCountry.forEach((records, code) => {
    if (anchorByCountry.has(code)) return;
    const medoid = buildAirportMedoid(records);
    if (!medoid) return;
    anchorByCountry.set(code, { countryCode: code, ...medoid, derivation: 'airport-medoid' });
  });

  const anchorDocument = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    note: 'Representative coordinate per country. Climate-normals anchors win so the distance sort and the climate dataset agree; the rest use the medoid of the country\'s commercial airports.',
    anchors: Array.from(anchorByCountry.values()).sort((left, right) => (
      left.countryCode.localeCompare(right.countryCode)
    )),
  };

  await fs.writeFile(
    path.join(ROOT, 'data/countryMapGeometry.generated.json'),
    `${JSON.stringify(geometryDocument, null, 0)}\n`,
    'utf8',
  );
  await fs.writeFile(
    path.join(ROOT, 'data/countryAnchors.generated.json'),
    `${JSON.stringify(anchorDocument)}\n`,
    'utf8',
  );

  const climateAnchorCount = anchorDocument.anchors.filter((a) => a.derivation === 'climate-normals').length;
  console.log(`countries with geometry: ${countries.length}`);
  console.log(`anchors: ${anchorDocument.anchors.length} (${climateAnchorCount} from climate normals)`);
};

void main();
