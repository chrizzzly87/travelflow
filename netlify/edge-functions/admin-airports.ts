import {
  deriveAirportCommercialFlags,
  normalizeAirportReference,
  type AirportReference,
  type AirportReferenceMetadata,
} from "../../shared/airportReference.ts";
import { generateAirportReferenceArtifacts } from "../../shared/airportReferenceCatalog.ts";
import {
  loadAirportReferenceMetadataFromStaticAsset,
  loadCommercialAirportReferencesFromStaticAsset,
} from "../edge-lib/airport-reference-static.ts";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

const AUTH_HEADER = "authorization";
const AIRPORTS_SELECT = [
  "ident",
  "iata_code",
  "icao_code",
  "name",
  "municipality",
  "subdivision_name",
  "region_code",
  "country_code",
  "country_name",
  "latitude",
  "longitude",
  "timezone",
  "airport_type",
  "scheduled_service",
  "is_commercial",
  "commercial_service_tier",
  "is_major_commercial",
].join(",");
const METADATA_SELECT = [
  "id",
  "data_version",
  "generated_at",
  "commercial_airport_count",
  "source_airport_count",
  "sources",
  "synced_at",
  "synced_by",
].join(",");

type AdminAirportsAction = "sync" | "create" | "update" | "bulkUpdate" | "delete";

interface AdminAirportCatalogMetadata extends AirportReferenceMetadata {
  syncedAt: string | null;
  syncedBy: string | null;
}

interface AdminAirportsRequestBody {
  action?: AdminAirportsAction;
  airport?: unknown;
  idents?: unknown;
  patch?: unknown;
}

interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
}

const readEnv = (name: string): string => {
  try {
    return (globalThis as { Deno?: { env?: { get: (key: string) => string | undefined } } }).Deno?.env?.get(name) || "";
  } catch {
    return "";
  }
};

const json = (status: number, payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  });

const safeJsonParse = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const extractServiceError = (payload: unknown, fallback: string): string => {
  if (payload && typeof payload === "object") {
    const typed = payload as Record<string, unknown>;
    if (typeof typed.message === "string" && typed.message.trim()) return typed.message.trim();
    if (typeof typed.error === "string" && typed.error.trim()) return typed.error.trim();
    if (typed.error && typeof typed.error === "object" && typeof (typed.error as Record<string, unknown>).message === "string") {
      return String((typed.error as Record<string, unknown>).message).trim();
    }
  }
  return fallback;
};

const getAuthToken = (request: Request): string | null => {
  const raw = request.headers.get(AUTH_HEADER) || "";
  const match = raw.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  return token || null;
};

const getSupabaseConfig = (): SupabaseConfig | null => {
  const url = readEnv("VITE_SUPABASE_URL").replace(/\/+$/, "");
  const anonKey = readEnv("VITE_SUPABASE_ANON_KEY").trim();
  const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY").trim();
  if (!url || !anonKey || !serviceRoleKey) return null;
  return { url, anonKey, serviceRoleKey };
};

const buildAnonHeaders = (authToken: string, anonKey: string) => ({
  "Content-Type": "application/json",
  apikey: anonKey,
  Authorization: `Bearer ${authToken}`,
});

const buildServiceHeaders = (serviceRoleKey: string, extra?: Record<string, string>) => ({
  "Content-Type": "application/json",
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  ...extra,
});

const supabaseFetch = async (
  config: { url: string; anonKey: string },
  authToken: string,
  path: string,
  init: RequestInit,
): Promise<Response> => {
  return fetch(`${config.url}${path}`, {
    ...init,
    headers: {
      ...buildAnonHeaders(authToken, config.anonKey),
      ...(init.headers || {}),
    },
  });
};

const authorizeAdminRequest = async (
  config: { url: string; anonKey: string },
  authToken: string,
): Promise<{ ok: true; actorUserId: string } | { ok: false; response: Response }> => {
  const accessResponse = await supabaseFetch(config, authToken, "/rest/v1/rpc/get_current_user_access", {
    method: "POST",
    headers: {
      Prefer: "params=single-object",
    },
    body: "{}",
  });

  if (!accessResponse.ok) {
    const payload = await safeJsonParse(accessResponse);
    return {
      ok: false,
      response: json(403, {
        ok: false,
        error: extractServiceError(payload, "Admin role verification failed."),
      }),
    };
  }

  const accessPayload = await safeJsonParse(accessResponse);
  const accessRow = Array.isArray(accessPayload) ? accessPayload[0] : accessPayload;
  if (!accessRow || typeof accessRow !== "object" || (accessRow as Record<string, unknown>).system_role !== "admin") {
    return {
      ok: false,
      response: json(403, {
        ok: false,
        error: "Admin role required.",
      }),
    };
  }

  const actorUserId = String((accessRow as Record<string, unknown>).user_id || "").trim();
  if (!actorUserId) {
    return {
      ok: false,
      response: json(403, {
        ok: false,
        error: "Admin actor id is missing.",
      }),
    };
  }

  return {
    ok: true,
    actorUserId,
  };
};

const mapAirportRow = (row: unknown): AirportReference | null => {
  if (!row || typeof row !== "object") return null;
  const typed = row as Record<string, unknown>;
  return normalizeAirportReference({
    ident: typed.ident,
    iataCode: typed.iata_code,
    icaoCode: typed.icao_code,
    name: typed.name,
    municipality: typed.municipality,
    subdivisionName: typed.subdivision_name,
    regionCode: typed.region_code,
    countryCode: typed.country_code,
    countryName: typed.country_name,
    latitude: typed.latitude,
    longitude: typed.longitude,
    timezone: typed.timezone,
    airportType: typed.airport_type,
    scheduledService: typed.scheduled_service,
    isCommercial: typed.is_commercial,
    commercialServiceTier: typed.commercial_service_tier,
    isMajorCommercial: typed.is_major_commercial,
  });
};

const mapMetadataRow = (row: unknown): AdminAirportCatalogMetadata | null => {
  if (!row || typeof row !== "object") return null;
  const typed = row as Record<string, unknown>;
  const metadata = {
    dataVersion: typed.data_version,
    generatedAt: typed.generated_at,
    commercialAirportCount: typed.commercial_airport_count,
    sourceAirportCount: typed.source_airport_count,
    sources: typed.sources,
  };
  const normalized = normalizeAirportReferenceMetadataCompat(metadata);
  if (!normalized) return null;

  return {
    ...normalized,
    syncedAt: typeof typed.synced_at === "string" ? typed.synced_at : null,
    syncedBy: typeof typed.synced_by === "string" ? typed.synced_by : null,
  };
};

const normalizeAirportReferenceMetadataCompat = (value: unknown): AirportReferenceMetadata | null => {
  if (!value || typeof value !== "object") return null;
  const typed = value as Record<string, unknown>;
  const sources = typed.sources && typeof typed.sources === "object" ? typed.sources as Record<string, unknown> : null;
  if (
    typeof typed.dataVersion !== "string"
    || typeof typed.generatedAt !== "string"
    || typeof typed.commercialAirportCount !== "number"
    || typeof typed.sourceAirportCount !== "number"
    || typeof sources?.primary !== "string"
    || typeof sources?.mirror !== "string"
    || typeof sources?.enrichment !== "string"
  ) {
    return null;
  }

  return {
    dataVersion: typed.dataVersion,
    generatedAt: typed.generatedAt,
    commercialAirportCount: typed.commercialAirportCount,
    sourceAirportCount: typed.sourceAirportCount,
    sources: {
      primary: sources.primary,
      mirror: sources.mirror,
      enrichment: sources.enrichment,
    },
  };
};

const fetchAirportCatalogFromDatabase = async (config: SupabaseConfig): Promise<{
  airports: AirportReference[];
  metadata: AdminAirportCatalogMetadata | null;
}> => {
  const [airportsResponse, metadataResponse] = await Promise.all([
    fetch(`${config.url}/rest/v1/airports_reference?select=${encodeURIComponent(AIRPORTS_SELECT)}&order=country_code.asc,name.asc,ident.asc&limit=5000`, {
      method: "GET",
      headers: buildServiceHeaders(config.serviceRoleKey, {
        Prefer: "count=exact",
      }),
    }),
    fetch(`${config.url}/rest/v1/airports_reference_metadata?id=eq.global&select=${encodeURIComponent(METADATA_SELECT)}`, {
      method: "GET",
      headers: buildServiceHeaders(config.serviceRoleKey),
    }),
  ]);

  const airportsPayload = await safeJsonParse(airportsResponse);
  const airports = Array.isArray(airportsPayload)
    ? airportsPayload.map((row) => mapAirportRow(row)).filter((row): row is AirportReference => Boolean(row))
    : [];

  const metadataPayload = await safeJsonParse(metadataResponse);
  const metadataRow = Array.isArray(metadataPayload) ? metadataPayload[0] : metadataPayload;
  const metadata = mapMetadataRow(metadataRow);

  return { airports, metadata };
};

const normalizeAdminAirportInput = (value: unknown): AirportReference | null => {
  const normalized = normalizeAirportReference(value);
  if (!normalized) return null;
  const commercialFlags = deriveAirportCommercialFlags({
    airportType: normalized.airportType,
    scheduledService: normalized.scheduledService,
    iataCode: normalized.iataCode,
    icaoCode: normalized.icaoCode,
  });

  return {
    ...normalized,
    ...commercialFlags,
  };
};

interface NormalizedAdminAirportBulkPatch {
  airportType?: AirportReference["airportType"];
  scheduledService?: boolean;
  timezone?: string | null;
}

const normalizeBulkAirportIdentList = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) return null;
  const idents = value
    .map((entry) => typeof entry === "string" ? entry.trim().toUpperCase() : "")
    .filter((entry) => entry.length > 0);
  const deduped = Array.from(new Set(idents));
  if (deduped.length === 0 || deduped.length > 500) return null;
  return deduped;
};

const normalizeAdminAirportBulkPatch = (value: unknown): NormalizedAdminAirportBulkPatch | null => {
  if (!value || typeof value !== "object") return null;
  const typed = value as Record<string, unknown>;
  const nextPatch: NormalizedAdminAirportBulkPatch = {};

  if (Object.prototype.hasOwnProperty.call(typed, "airportType")) {
    if (
      typed.airportType !== "large_airport"
      && typed.airportType !== "medium_airport"
      && typed.airportType !== "small_airport"
    ) {
      return null;
    }
    nextPatch.airportType = typed.airportType;
  }

  if (Object.prototype.hasOwnProperty.call(typed, "scheduledService")) {
    if (typeof typed.scheduledService !== "boolean") return null;
    nextPatch.scheduledService = typed.scheduledService;
  }

  if (Object.prototype.hasOwnProperty.call(typed, "timezone")) {
    if (typed.timezone === null) {
      nextPatch.timezone = null;
    } else if (typeof typed.timezone === "string") {
      const trimmed = typed.timezone.trim();
      nextPatch.timezone = trimmed.length > 0 ? trimmed : null;
    } else {
      return null;
    }
  }

  return Object.keys(nextPatch).length > 0 ? nextPatch : null;
};

const applyBulkAirportPatch = (
  airport: AirportReference,
  patch: NormalizedAdminAirportBulkPatch,
): AirportReference => {
  const nextAirport = normalizeAirportReference({
    ...airport,
    airportType: patch.airportType ?? airport.airportType,
    scheduledService: patch.scheduledService ?? airport.scheduledService,
    timezone: Object.prototype.hasOwnProperty.call(patch, "timezone")
      ? patch.timezone
      : airport.timezone,
  });

  if (!nextAirport) {
    throw new Error(`Bulk update produced an invalid airport row for ${airport.ident}.`);
  }

  const commercialFlags = deriveAirportCommercialFlags({
    airportType: nextAirport.airportType,
    scheduledService: nextAirport.scheduledService,
    iataCode: nextAirport.iataCode,
    icaoCode: nextAirport.icaoCode,
  });

  return {
    ...nextAirport,
    ...commercialFlags,
  };
};

const airportToDatabaseRecord = (airport: AirportReference) => ({
  ident: airport.ident,
  iata_code: airport.iataCode,
  icao_code: airport.icaoCode,
  name: airport.name,
  municipality: airport.municipality,
  subdivision_name: airport.subdivisionName,
  region_code: airport.regionCode,
  country_code: airport.countryCode,
  country_name: airport.countryName,
  latitude: airport.latitude,
  longitude: airport.longitude,
  timezone: airport.timezone,
  airport_type: airport.airportType,
  scheduled_service: airport.scheduledService,
  is_commercial: airport.isCommercial,
  commercial_service_tier: airport.commercialServiceTier,
  is_major_commercial: airport.isMajorCommercial,
});

const touchAirportMetadata = async (
  config: SupabaseConfig,
  actorUserId: string,
): Promise<void> => {
  await fetch(`${config.url}/rest/v1/airports_reference_metadata?id=eq.global`, {
    method: "PATCH",
    headers: buildServiceHeaders(config.serviceRoleKey, {
      Prefer: "return=minimal",
    }),
    body: JSON.stringify({
      synced_at: new Date().toISOString(),
      synced_by: actorUserId,
    }),
  }).catch(() => undefined);
};

const syncAirportCatalog = async (
  config: SupabaseConfig,
  actorUserId: string,
): Promise<{
  airports: AirportReference[];
  metadata: AdminAirportCatalogMetadata;
}> => {
  const { airports, metadata } = await generateAirportReferenceArtifacts(fetch);
  const syncResponse = await fetch(`${config.url}/rest/v1/rpc/admin_replace_airports_reference`, {
    method: "POST",
    headers: buildServiceHeaders(config.serviceRoleKey),
    body: JSON.stringify({
      p_rows: airports,
      p_metadata: metadata,
      p_synced_by: actorUserId,
    }),
  });

  if (!syncResponse.ok) {
    const payload = await safeJsonParse(syncResponse);
    throw new Error(extractServiceError(payload, "Airport sync failed."));
  }

  const syncedAt = new Date().toISOString();
  return {
    airports,
    metadata: {
      ...metadata,
      syncedAt,
      syncedBy: actorUserId,
    },
  };
};

const updateAirportRecord = async (
  config: SupabaseConfig,
  actorUserId: string,
  airport: AirportReference,
): Promise<AirportReference> => {
  const response = await fetch(`${config.url}/rest/v1/airports_reference?ident=eq.${encodeURIComponent(airport.ident)}`, {
    method: "PATCH",
    headers: buildServiceHeaders(config.serviceRoleKey, {
      Prefer: "return=representation",
    }),
    body: JSON.stringify(airportToDatabaseRecord(airport)),
  });

  if (!response.ok) {
    const payload = await safeJsonParse(response);
    throw new Error(extractServiceError(payload, "Airport update failed."));
  }

  const payload = await safeJsonParse(response);
  const updatedAirport = Array.isArray(payload) ? mapAirportRow(payload[0]) : null;
  if (!updatedAirport) {
    throw new Error("Airport update returned an invalid row.");
  }

  await touchAirportMetadata(config, actorUserId);
  return updatedAirport;
};

const createAirportRecord = async (
  config: SupabaseConfig,
  actorUserId: string,
  airport: AirportReference,
): Promise<AirportReference> => {
  const response = await fetch(`${config.url}/rest/v1/airports_reference`, {
    method: "POST",
    headers: buildServiceHeaders(config.serviceRoleKey, {
      Prefer: "return=representation",
    }),
    body: JSON.stringify(airportToDatabaseRecord(airport)),
  });

  if (!response.ok) {
    const payload = await safeJsonParse(response);
    throw new Error(extractServiceError(payload, "Airport create failed."));
  }

  const payload = await safeJsonParse(response);
  const createdAirport = Array.isArray(payload) ? mapAirportRow(payload[0]) : null;
  if (!createdAirport) {
    throw new Error("Airport create returned an invalid row.");
  }

  await touchAirportMetadata(config, actorUserId);
  return createdAirport;
};

const bulkUpdateAirportRecords = async (
  config: SupabaseConfig,
  actorUserId: string,
  idents: string[],
  patch: NormalizedAdminAirportBulkPatch,
): Promise<AirportReference[]> => {
  const encodedIdents = encodeURIComponent(`(${idents.join(",")})`);
  const response = await fetch(`${config.url}/rest/v1/airports_reference?ident=in.${encodedIdents}&select=${encodeURIComponent(AIRPORTS_SELECT)}&limit=${idents.length}`, {
    method: "GET",
    headers: buildServiceHeaders(config.serviceRoleKey),
  });

  if (!response.ok) {
    const payload = await safeJsonParse(response);
    throw new Error(extractServiceError(payload, "Could not load airports for bulk update."));
  }

  const payload = await safeJsonParse(response);
  const currentAirports = Array.isArray(payload)
    ? payload.map((row) => mapAirportRow(row)).filter((row): row is AirportReference => Boolean(row))
    : [];

  if (currentAirports.length === 0) {
    throw new Error("No airports matched the selected bulk update rows.");
  }

  const currentByIdent = new Map(currentAirports.map((airport) => [airport.ident, airport] as const));
  const missingIdents = idents.filter((ident) => !currentByIdent.has(ident));
  if (missingIdents.length > 0) {
    throw new Error(`Could not find ${missingIdents.length} selected airport row${missingIdents.length === 1 ? "" : "s"} in the database.`);
  }

  const updatedAirports = idents.map((ident) => applyBulkAirportPatch(currentByIdent.get(ident)!, patch));
  const upsertResponse = await fetch(`${config.url}/rest/v1/airports_reference?on_conflict=ident`, {
    method: "POST",
    headers: buildServiceHeaders(config.serviceRoleKey, {
      Prefer: "resolution=merge-duplicates,return=representation",
    }),
    body: JSON.stringify(updatedAirports.map((airport) => airportToDatabaseRecord(airport))),
  });

  if (!upsertResponse.ok) {
    const upsertPayload = await safeJsonParse(upsertResponse);
    throw new Error(extractServiceError(upsertPayload, "Bulk airport update failed."));
  }

  const upsertPayload = await safeJsonParse(upsertResponse);
  const normalizedAirports = Array.isArray(upsertPayload)
    ? upsertPayload.map((row) => mapAirportRow(row)).filter((row): row is AirportReference => Boolean(row))
    : [];

  await touchAirportMetadata(config, actorUserId);
  return normalizedAirports.length > 0 ? normalizedAirports : updatedAirports;
};

const deleteAirportRecords = async (
  config: SupabaseConfig,
  actorUserId: string,
  idents: string[],
): Promise<string[]> => {
  const encodedIdents = encodeURIComponent(`(${idents.join(",")})`);
  const response = await fetch(`${config.url}/rest/v1/airports_reference?ident=in.${encodedIdents}&select=ident`, {
    method: "DELETE",
    headers: buildServiceHeaders(config.serviceRoleKey, {
      Prefer: "return=representation",
    }),
  });

  if (!response.ok) {
    const payload = await safeJsonParse(response);
    throw new Error(extractServiceError(payload, "Airport delete failed."));
  }

  const payload = await safeJsonParse(response);
  const deletedIdents = Array.isArray(payload)
    ? payload
      .map((row) => row && typeof row === "object" && typeof (row as Record<string, unknown>).ident === "string"
        ? String((row as Record<string, unknown>).ident).trim().toUpperCase()
        : "")
      .filter((ident): ident is string => ident.length > 0)
    : [];

  if (deletedIdents.length === 0) {
    throw new Error("No airports matched the selected delete rows.");
  }

  const deletedIdentSet = new Set(deletedIdents);
  const missingIdents = idents.filter((ident) => !deletedIdentSet.has(ident));
  if (missingIdents.length > 0) {
    throw new Error(`Could not delete ${missingIdents.length} selected airport row${missingIdents.length === 1 ? "" : "s"} from the database.`);
  }

  await touchAirportMetadata(config, actorUserId);
  return deletedIdents;
};

const parseBody = async (request: Request): Promise<AdminAirportsRequestBody | null> => {
  try {
    const payload = await request.json();
    if (!payload || typeof payload !== "object") return null;
    return payload as AdminAirportsRequestBody;
  } catch {
    return null;
  }
};

export default async (request: Request): Promise<Response> => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: JSON_HEADERS });
  }

  if (request.method !== "GET" && request.method !== "POST") {
    return json(405, {
      ok: false,
      error: "Method not allowed. Use GET or POST.",
    });
  }

  const authToken = getAuthToken(request);
  if (!authToken) {
    return json(401, {
      ok: false,
      error: "Missing Authorization bearer token.",
      code: "AUTH_TOKEN_MISSING",
    });
  }

  const supabaseConfig = getSupabaseConfig();
  if (!supabaseConfig) {
    if (request.method === "GET") {
      const [airports, metadata] = await Promise.all([
        loadCommercialAirportReferencesFromStaticAsset(request.url),
        loadAirportReferenceMetadataFromStaticAsset(request.url),
      ]);
      return json(200, {
        ok: true,
        source: "snapshot",
        databaseAvailable: false,
        airports,
        metadata: metadata
          ? {
            ...metadata,
            syncedAt: metadata.generatedAt,
            syncedBy: "repo snapshot",
          }
          : null,
      });
    }

    return json(503, {
      ok: false,
      error: "Supabase config is missing for airport admin actions.",
    });
  }

  const authResult = await authorizeAdminRequest(supabaseConfig, authToken);
  if ('response' in authResult) return authResult.response;

  if (request.method === "GET") {
    try {
      const { airports, metadata } = await fetchAirportCatalogFromDatabase(supabaseConfig);
      if (airports.length > 0) {
        return json(200, {
          ok: true,
          source: "database",
          databaseAvailable: true,
          airports,
          metadata,
        });
      }
    } catch {
      // Fall through to the repo snapshot so the admin page remains usable.
    }

    const [airports, metadata] = await Promise.all([
      loadCommercialAirportReferencesFromStaticAsset(request.url),
      loadAirportReferenceMetadataFromStaticAsset(request.url),
    ]);
    return json(200, {
      ok: true,
      source: "snapshot",
      databaseAvailable: true,
      airports,
      metadata: metadata
        ? {
          ...metadata,
          syncedAt: metadata.generatedAt,
          syncedBy: "repo snapshot",
        }
        : null,
    });
  }

  const body = await parseBody(request);
  if (!body?.action) {
    return json(400, {
      ok: false,
      error: "Missing admin airports action.",
    });
  }

  if (body.action === "sync") {
    try {
      const result = await syncAirportCatalog(supabaseConfig, authResult.actorUserId);
      return json(200, {
        ok: true,
        action: "sync",
        source: "database",
        airports: result.airports,
        metadata: result.metadata,
      });
    } catch (error) {
      return json(500, {
        ok: false,
        error: error instanceof Error ? error.message : "Airport sync failed.",
      });
    }
  }

  if (body.action === "update") {
    const airport = normalizeAdminAirportInput(body.airport);
    if (!airport) {
      return json(400, {
        ok: false,
        error: "Airport update payload was invalid.",
      });
    }

    try {
      const updatedAirport = await updateAirportRecord(supabaseConfig, authResult.actorUserId, airport);
      return json(200, {
        ok: true,
        action: "update",
        airport: updatedAirport,
      });
    } catch (error) {
      return json(500, {
        ok: false,
        error: error instanceof Error ? error.message : "Airport update failed.",
      });
    }
  }

  if (body.action === "create") {
    const airport = normalizeAdminAirportInput(body.airport);
    if (!airport) {
      return json(400, {
        ok: false,
        error: "Airport create payload was invalid.",
      });
    }

    try {
      const createdAirport = await createAirportRecord(supabaseConfig, authResult.actorUserId, airport);
      return json(200, {
        ok: true,
        action: "create",
        airport: createdAirport,
      });
    } catch (error) {
      return json(500, {
        ok: false,
        error: error instanceof Error ? error.message : "Airport create failed.",
      });
    }
  }

  if (body.action === "bulkUpdate") {
    const idents = normalizeBulkAirportIdentList(body.idents);
    const patch = normalizeAdminAirportBulkPatch(body.patch);
    if (!idents || !patch) {
      return json(400, {
        ok: false,
        error: "Bulk airport update payload was invalid.",
      });
    }

    try {
      const airports = await bulkUpdateAirportRecords(supabaseConfig, authResult.actorUserId, idents, patch);
      return json(200, {
        ok: true,
        action: "bulkUpdate",
        airports,
      });
    } catch (error) {
      return json(500, {
        ok: false,
        error: error instanceof Error ? error.message : "Bulk airport update failed.",
      });
    }
  }

  if (body.action === "delete") {
    const idents = normalizeBulkAirportIdentList(body.idents);
    if (!idents) {
      return json(400, {
        ok: false,
        error: "Airport delete payload was invalid.",
      });
    }

    try {
      const deletedIdents = await deleteAirportRecords(supabaseConfig, authResult.actorUserId, idents);
      return json(200, {
        ok: true,
        action: "delete",
        deletedIdents,
      });
    } catch (error) {
      return json(500, {
        ok: false,
        error: error instanceof Error ? error.message : "Airport delete failed.",
      });
    }
  }

  return json(400, {
    ok: false,
    error: "Unsupported admin airports action.",
  });
};

export const __adminAirportsInternals = {
  applyBulkAirportPatch,
  authorizeAdminRequest,
  createAirportRecord,
  deleteAirportRecords,
  fetchAirportCatalogFromDatabase,
  normalizeBulkAirportIdentList,
  normalizeAdminAirportBulkPatch,
  normalizeAdminAirportInput,
  syncAirportCatalog,
  bulkUpdateAirportRecords,
  updateAirportRecord,
};
