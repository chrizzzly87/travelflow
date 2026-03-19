import {
  buildRuntimeLocationPayload,
  createEmptyRuntimeLocation,
  type RuntimeLocation,
  type RuntimeLocationPayload,
} from '../../shared/runtimeLocation.ts';

interface RuntimeLocationGeoContext {
  city?: unknown;
  country?: {
    code?: unknown;
    name?: unknown;
  } | null;
  latitude?: unknown;
  longitude?: unknown;
  subdivision?: {
    code?: unknown;
    name?: unknown;
  } | null;
  timezone?: unknown;
  postalCode?: unknown;
}

interface RuntimeLocationContext {
  geo?: RuntimeLocationGeoContext | null;
}

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

const asNullableString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asNullableNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const json = (status: number, payload: RuntimeLocationPayload) => new Response(JSON.stringify(payload), {
  status,
  headers: JSON_HEADERS,
});

const getNormalizedRuntimeLocation = (context: RuntimeLocationContext): RuntimeLocation => {
  const location = createEmptyRuntimeLocation();
  const geo = context.geo;

  if (!geo) return location;

  return {
    city: asNullableString(geo.city),
    countryCode: asNullableString(geo.country?.code),
    countryName: asNullableString(geo.country?.name),
    subdivisionCode: asNullableString(geo.subdivision?.code),
    subdivisionName: asNullableString(geo.subdivision?.name),
    latitude: asNullableNumber(geo.latitude),
    longitude: asNullableNumber(geo.longitude),
    timezone: asNullableString(geo.timezone),
    postalCode: asNullableString(geo.postalCode),
  };
};

export default async (request: Request, context: RuntimeLocationContext): Promise<Response> => {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({
      ok: false,
      error: 'Method not allowed',
    }), {
      status: 405,
      headers: {
        ...JSON_HEADERS,
        allow: 'GET',
      },
    });
  }

  try {
    const payload = buildRuntimeLocationPayload({
      source: 'netlify-context',
      fetchedAt: new Date().toISOString(),
      location: getNormalizedRuntimeLocation(context),
    });
    return json(200, payload);
  } catch {
    return json(200, buildRuntimeLocationPayload({
      source: 'error',
      fetchedAt: new Date().toISOString(),
      location: createEmptyRuntimeLocation(),
    }));
  }
};
