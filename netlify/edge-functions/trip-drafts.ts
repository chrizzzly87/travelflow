/**
 * External trip drafts over HTTP (docs/EXTERNAL_TRIP_DRAFTS.md).
 *
 * GET  /api/trip-drafts/schema        JSON Schema, rules and an example
 * GET  /api/trip-drafts/openapi.json  OpenAPI 3.1 (ChatGPT GPT Actions etc.)
 * POST /api/trip-drafts/validate      dry run, stores nothing
 * POST /api/trip-drafts               validate, build and store a draft
 * GET  /api/trip-drafts/{draftId}     read a stored draft
 *
 * No model runs on this path: the caller plans the trip, we only check and
 * store it. CORS is open because nothing here uses cookies or credentials.
 */
import {
  buildTripDraftSchemaDocument,
  TRIP_DRAFT_LIMITS,
  TRIP_DRAFT_REQUEST_JSON_SCHEMA,
  TRIP_DRAFT_RULES,
} from "../../shared/tripDrafts.ts";
import {
  createTripDraft,
  readClientIp,
  readTripDraft,
  readTripDraftJsonBody,
  resolveTripDraftSource,
  validateTripDraftPayload,
  type TripDraftFailure,
} from "../edge-lib/trip-drafts.ts";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-TravelFlow-Draft-Source",
  "Access-Control-Max-Age": "86400",
};

const NO_STORE = { "Cache-Control": "no-store" };
const DOCUMENT_CACHE = {
  "Cache-Control": "public, max-age=300",
  "Netlify-CDN-Cache-Control": "public, durable, s-maxage=3600",
};

const json = (status: number, payload: unknown, headers: Record<string, string> = NO_STORE): Response => (
  new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Robots-Tag": "noindex",
      ...CORS_HEADERS,
      ...headers,
    },
  })
);

const failure = (result: TripDraftFailure): Response => json(result.status, {
  ok: false,
  code: result.code,
  message: result.message,
  ...(result.errors ? { errors: result.errors } : {}),
  ...(result.code === "validation_failed" ? { help: "GET /api/trip-drafts/schema for the full schema and a working example." } : {}),
});

const errorResponseSchema = {
  type: "object",
  properties: {
    ok: { type: "boolean", enum: [false] },
    code: { type: "string" },
    message: { type: "string" },
    errors: { type: "array", items: { type: "string" } },
  },
  required: ["ok", "code", "message"],
};

export const buildTripDraftOpenApiDocument = (origin: string): Record<string, unknown> => ({
  openapi: "3.1.0",
  info: {
    title: "TravelFlow trip drafts",
    version: "1.0.0",
    description: [
      "Plan a trip yourself and send it to TravelFlow. TravelFlow validates it, stores it as a draft and returns a link.",
      "The traveller opens the link to view the plan and saves it to their TravelFlow account to edit it.",
      "TravelFlow runs no AI for these requests.",
      "",
      ...TRIP_DRAFT_RULES.map((rule) => `- ${rule}`),
    ].join("\n"),
  },
  servers: [{ url: origin }],
  paths: {
    "/api/trip-drafts/schema": {
      get: {
        operationId: "getTripDraftSchema",
        summary: "Schema, rules and a worked example for a trip draft",
        responses: { "200": { description: "Schema document", content: { "application/json": { schema: { type: "object" } } } } },
      },
    },
    "/api/trip-drafts/validate": {
      post: {
        operationId: "validateTripDraft",
        summary: "Check a trip without storing it",
        "x-openai-isConsequential": false,
        requestBody: { required: true, content: { "application/json": { schema: TRIP_DRAFT_REQUEST_JSON_SCHEMA } } },
        responses: {
          "200": { description: "Valid", content: { "application/json": { schema: { type: "object" } } } },
          "422": { description: "Invalid; see errors", content: { "application/json": { schema: errorResponseSchema } } },
        },
      },
    },
    "/api/trip-drafts": {
      post: {
        operationId: "createTripDraft",
        summary: "Store a trip as a draft and get a link to it",
        "x-openai-isConsequential": false,
        requestBody: { required: true, content: { "application/json": { schema: TRIP_DRAFT_REQUEST_JSON_SCHEMA } } },
        responses: {
          "201": {
            description: "Created",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean" },
                    draftId: { type: "string" },
                    url: { type: "string", description: "Give this link to the traveller." },
                    expiresAt: { type: ["string", "null"] },
                    title: { type: "string" },
                    startDate: { type: "string" },
                  },
                },
              },
            },
          },
          "422": { description: "Invalid; see errors", content: { "application/json": { schema: errorResponseSchema } } },
          "429": { description: "Rate limited", content: { "application/json": { schema: errorResponseSchema } } },
        },
      },
    },
    "/api/trip-drafts/{draftId}": {
      get: {
        operationId: "getTripDraft",
        summary: "Read a stored draft and whether it was saved to an account",
        parameters: [{ name: "draftId", in: "path", required: true, schema: { type: "string", pattern: "^drf_[A-Za-z0-9]{24}$" } }],
        responses: {
          "200": { description: "The draft", content: { "application/json": { schema: { type: "object" } } } },
          "404": { description: "Missing or expired", content: { "application/json": { schema: errorResponseSchema } } },
        },
      },
    },
  },
});

export const handleTripDraftsRequest = async (request: Request, contextIp?: string | null): Promise<Response> => {
  const url = new URL(request.url);
  const origin = url.origin;
  const subPath = url.pathname.replace(/^\/api\/trip-drafts\/?/, "").replace(/\/+$/, "");

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });

  if (request.method === "GET" || request.method === "HEAD") {
    if (subPath === "schema") return json(200, buildTripDraftSchemaDocument(origin), DOCUMENT_CACHE);
    if (subPath === "openapi.json") return json(200, buildTripDraftOpenApiDocument(origin), DOCUMENT_CACHE);
    if (subPath === "") {
      return json(200, {
        ok: true,
        message: "POST a trip to this URL to create a draft. GET /api/trip-drafts/schema for the format.",
        schema: `${origin}/api/trip-drafts/schema`,
      }, DOCUMENT_CACHE);
    }
    if (!subPath.includes("/")) {
      const result = await readTripDraft(subPath, origin, { trackView: url.searchParams.get("view") === "1" });
      return result.ok ? json(200, result) : failure(result);
    }
    return json(404, { ok: false, code: "not_found", message: "Unknown trip draft endpoint." });
  }

  if (request.method !== "POST") return json(405, { ok: false, code: "method_not_allowed", message: "Use GET or POST." });
  if (subPath !== "" && subPath !== "validate") {
    return json(404, { ok: false, code: "not_found", message: "Unknown trip draft endpoint." });
  }

  const body = await readTripDraftJsonBody(request, TRIP_DRAFT_LIMITS.maxBodyBytes);
  if (!body.ok) return failure(body);

  if (subPath === "validate") {
    const result = validateTripDraftPayload(body.body);
    return result.ok
      ? json(200, { ...result, message: "Valid. POST the same body to /api/trip-drafts to create the draft." })
      : failure(result);
  }

  const result = await createTripDraft(body.body, {
    origin,
    source: resolveTripDraftSource(request.headers.get("x-travelflow-draft-source"), "api"),
    ip: readClientIp(request, contextIp),
    userAgent: request.headers.get("user-agent"),
  });
  if (!result.ok) return failure(result);
  return json(201, {
    ...result,
    message: `Draft created. Share this link with the traveller: ${result.url} — they can view it now and save it to their TravelFlow account to edit it.`,
  });
};

export default async (request: Request, context?: { ip?: string }): Promise<Response> => (
  handleTripDraftsRequest(request, context?.ip ?? null)
);
