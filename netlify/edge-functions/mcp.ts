/**
 * TravelFlow remote MCP server: POST /api/mcp (docs/EXTERNAL_TRIP_DRAFTS.md).
 *
 * Stateless Streamable HTTP. Every request is answered with a single JSON
 * response; there is no session and no server-sent event stream, which the
 * transport allows. No auth: the tools only create and read anonymous drafts.
 *
 * The tools never call a model. An assistant plans the trip with its own
 * tokens and hands TravelFlow the finished itinerary.
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
  validateTripDraftPayload,
  type TripDraftFailure,
} from "../edge-lib/trip-drafts.ts";

const SUPPORTED_PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const LATEST_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, Mcp-Protocol-Version",
};

export const MCP_SERVER_INSTRUCTIONS = [
  "TravelFlow is a visual trip planner (timeline + map). Use these tools to hand a trip you planned to TravelFlow.",
  "1. Call get_trip_draft_schema once to read the format and a working example.",
  "2. Plan the whole trip yourself, then call create_trip_draft (or validate_trip_draft first if unsure).",
  "3. Give the returned url to the traveller. They can view the plan immediately and save it to their TravelFlow account to edit it.",
  "TravelFlow does not generate trips for you; it only checks and stores the plan you send.",
].join("\n");

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === "object" && !Array.isArray(value)
);

const tripArgumentsSchema = TRIP_DRAFT_REQUEST_JSON_SCHEMA;

export const MCP_TOOLS = [
  {
    name: "get_trip_draft_schema",
    title: "Get the TravelFlow trip format",
    description: "Returns the JSON Schema, rules and a complete example for a TravelFlow trip. Read this before creating a trip.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "validate_trip_draft",
    title: "Check a trip",
    description: "Checks a trip against the TravelFlow schema without storing it. Returns ok or a list of precise errors to fix.",
    inputSchema: tripArgumentsSchema,
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "create_trip_draft",
    title: "Send a trip to TravelFlow",
    description: [
      "Stores a trip you planned as a TravelFlow draft and returns a link for the traveller.",
      "Plan the full itinerary yourself first; TravelFlow does not generate trips.",
      ...TRIP_DRAFT_RULES.map((rule) => `- ${rule}`),
    ].join("\n"),
    inputSchema: tripArgumentsSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "get_trip_draft",
    title: "Read a TravelFlow draft",
    description: "Reads a draft you created earlier by its id (drf_…), including whether the traveller has saved it to their account.",
    inputSchema: {
      type: "object",
      properties: { draftId: { type: "string", pattern: "^drf_[A-Za-z0-9]{24}$" } },
      required: ["draftId"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
] as const;

const textResult = (payload: Record<string, unknown>, isError = false) => ({
  content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
  structuredContent: payload,
  ...(isError ? { isError: true } : {}),
});

const failureResult = (failure: TripDraftFailure) => textResult({
  ok: false,
  code: failure.code,
  message: failure.message,
  ...(failure.errors ? { errors: failure.errors } : {}),
}, true);

export interface McpCallContext {
  origin: string;
  ip: string | null;
  userAgent: string | null;
}

export const callMcpTool = async (name: string, args: Record<string, unknown>, context: McpCallContext) => {
  if (name === "get_trip_draft_schema") {
    return textResult(buildTripDraftSchemaDocument(context.origin) as unknown as Record<string, unknown>);
  }
  if (name === "validate_trip_draft") {
    const result = validateTripDraftPayload(args);
    return result.ok ? textResult({ ...result, message: "Valid. Call create_trip_draft with the same arguments." }) : failureResult(result);
  }
  if (name === "create_trip_draft") {
    const result = await createTripDraft(args, { origin: context.origin, source: "mcp", ip: context.ip, userAgent: context.userAgent });
    if (!result.ok) return failureResult(result);
    return textResult({
      ...result,
      message: `Draft created. Give the traveller this link: ${result.url}. They can view it now and save it to their TravelFlow account to edit it.`,
    });
  }
  if (name === "get_trip_draft") {
    const draftId = typeof args.draftId === "string" ? args.draftId : "";
    const result = await readTripDraft(draftId, context.origin);
    if (!result.ok) return failureResult(result);
    const { trip: _trip, ...summary } = result;
    return textResult(summary);
  }
  return null;
};

const rpcResult = (id: unknown, result: unknown) => ({ jsonrpc: "2.0", id, result });
const rpcError = (id: unknown, code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

const MAX_BATCH_SIZE = 20;

export const handleJsonRpcMessage = async (message: unknown, context: McpCallContext): Promise<Record<string, unknown> | null> => {
  // A response from the client to a server request: we never send any, and
  // the transport answers responses like notifications, with 202 and no body.
  if (isRecord(message) && message.jsonrpc === "2.0" && !("method" in message) && ("result" in message || "error" in message)) {
    return null;
  }
  if (!isRecord(message) || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return rpcError(isRecord(message) ? message.id : null, -32600, "Invalid Request");
  }
  const { id } = message;
  const method = message.method;
  const params = isRecord(message.params) ? message.params : {};
  const isNotification = !("id" in message);

  if (method.startsWith("notifications/")) return null;
  if (isNotification) return null;

  switch (method) {
    case "initialize": {
      const requested = typeof params.protocolVersion === "string" ? params.protocolVersion : "";
      return rpcResult(id, {
        protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : LATEST_PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "travelflow", title: "TravelFlow", version: "1.0.0", websiteUrl: context.origin },
        instructions: MCP_SERVER_INSTRUCTIONS,
      });
    }
    case "ping":
      return rpcResult(id, {});
    case "tools/list":
      return rpcResult(id, { tools: MCP_TOOLS });
    case "resources/list":
      return rpcResult(id, { resources: [] });
    case "prompts/list":
      return rpcResult(id, { prompts: [] });
    case "tools/call": {
      const name = typeof params.name === "string" ? params.name : "";
      const args = isRecord(params.arguments) ? params.arguments : {};
      const result = await callMcpTool(name, args, context);
      if (!result) return rpcError(id, -32602, `Unknown tool: ${name}`);
      return rpcResult(id, result);
    }
    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
};

const jsonResponse = (status: number, payload: unknown, extraHeaders: Record<string, string> = {}): Response => (
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  })
);

export const handleMcpRequest = async (request: Request, contextIp?: string | null): Promise<Response> => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (request.method === "GET") {
    // No server-initiated stream. A human opening the URL gets a pointer instead of a bare 405.
    const accept = request.headers.get("accept") || "";
    if (accept.includes("text/event-stream")) {
      return new Response(null, { status: 405, headers: { ...CORS_HEADERS, Allow: "POST, OPTIONS" } });
    }
    return jsonResponse(200, {
      name: "TravelFlow MCP server",
      transport: "streamable-http",
      endpoint: new URL(request.url).origin + "/api/mcp",
      instructions: MCP_SERVER_INSTRUCTIONS,
      tools: MCP_TOOLS.map((tool) => tool.name),
    });
  }
  if (request.method === "DELETE") return new Response(null, { status: 405, headers: CORS_HEADERS });
  if (request.method !== "POST") return jsonResponse(405, rpcError(null, -32600, "Use POST."));

  const body = await readTripDraftJsonBody(request, TRIP_DRAFT_LIMITS.maxBodyBytes + 16 * 1024);
  if (!body.ok) {
    return jsonResponse(body.status === 413 ? 413 : 400, rpcError(null, body.code === "invalid_json" ? -32700 : -32600, body.message));
  }

  const url = new URL(request.url);
  const context: McpCallContext = {
    origin: url.origin,
    ip: readClientIp(request, contextIp),
    userAgent: request.headers.get("user-agent"),
  };

  // Batches were dropped from the spec in 2025-06-18 but older clients still
  // send them. Entries run one at a time so a batch cannot race the per-caller
  // rate limit, and entries past the cap get an explicit error.
  if (Array.isArray(body.body)) {
    if (body.body.length === 0) return jsonResponse(400, rpcError(null, -32600, "Empty batch"));
    const responses: Record<string, unknown>[] = [];
    for (const [index, entry] of body.body.entries()) {
      const response = index < MAX_BATCH_SIZE
        ? await handleJsonRpcMessage(entry, context)
        : isRecord(entry) && "id" in entry && "method" in entry
          ? rpcError(entry.id, -32600, `Batches are limited to ${MAX_BATCH_SIZE} messages.`)
          : null;
      if (response) responses.push(response);
    }
    return responses.length > 0 ? jsonResponse(200, responses) : new Response(null, { status: 202, headers: CORS_HEADERS });
  }

  const response = await handleJsonRpcMessage(body.body, context);
  if (!response) return new Response(null, { status: 202, headers: CORS_HEADERS });
  return jsonResponse(200, response);
};

export default async (request: Request, context?: { ip?: string }): Promise<Response> => (
  handleMcpRequest(request, context?.ip ?? null)
);
