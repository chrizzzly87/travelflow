/**
 * In-page WebMCP tools (docs/EXTERNAL_TRIP_DRAFTS.md).
 *
 * A browser agent visiting TravelFlow can read the trip format, check a trip
 * and hand over a finished trip as a draft. The tools wrap the public
 * `/api/trip-drafts` API; none of them reaches our own trip generation, so an
 * agent cannot spend TravelFlow's model budget.
 *
 * Chrome exposes the API as `document.modelContext`; earlier builds and the
 * polyfills use `navigator.modelContext`. Tools are unregistered through the
 * AbortSignal passed at registration.
 */

export interface WebMcpTool {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    annotations?: { readOnlyHint?: boolean; consequentialHint?: boolean; untrustedContentHint?: boolean };
    execute: (input: Record<string, unknown>, options?: { signal?: AbortSignal }) => Promise<string>;
}

interface ModelContextLike {
    registerTool: (tool: WebMcpTool, options?: { signal?: AbortSignal }) => unknown;
}

export interface TravelFlowWebMcpDeps {
    fetchImpl?: typeof fetch;
    navigate: (path: string) => void;
    onDraftCreated?: (draftId: string) => void;
}

export const resolveModelContext = (scope: { document?: unknown; navigator?: unknown } = globalThis as never): ModelContextLike | null => {
    const candidates = [
        (scope.document as { modelContext?: unknown } | undefined)?.modelContext,
        (scope.navigator as { modelContext?: unknown } | undefined)?.modelContext,
    ];
    for (const candidate of candidates) {
        if (candidate && typeof (candidate as ModelContextLike).registerTool === 'function') return candidate as ModelContextLike;
    }
    return null;
};

const SCHEMA_URL = '/api/trip-drafts/schema';

// Kept small on purpose: the full schema is served by get_trip_draft_schema
// and checked server-side. Agents get the shape here and the rules there.
const TRIP_INPUT_SCHEMA: Record<string, unknown> = {
    type: 'object',
    properties: {
        trip: {
            type: 'object',
            description: 'The itinerary in TravelFlow format (tripTitle, countryInfo, cities, travelSegments, activities, dayTrips). Call get_trip_draft_schema first for every field and a full example.',
        },
        startDate: { type: 'string', description: 'First day of the trip, YYYY-MM-DD. Defaults to 30 days from today.' },
        roundTrip: { type: 'boolean', description: 'True when the trip ends back in the first city.' },
        client: {
            type: 'object',
            properties: { name: { type: 'string' }, model: { type: 'string' } },
            description: 'Optional: which assistant is calling.',
        },
    },
    required: ['trip'],
};

const asText = (payload: unknown): string => JSON.stringify(payload, null, 2);

const readJson = async (response: Response): Promise<Record<string, unknown>> => {
    try {
        const value = await response.json();
        return value && typeof value === 'object' ? value as Record<string, unknown> : {};
    } catch {
        return { ok: false, message: `TravelFlow answered with status ${response.status}.` };
    }
};

export const createTravelFlowWebMcpTools = ({ fetchImpl = fetch, navigate, onDraftCreated }: TravelFlowWebMcpDeps): WebMcpTool[] => {
    const postDraft = async (path: string, input: Record<string, unknown>, signal?: AbortSignal) => {
        const response = await fetchImpl(path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-TravelFlow-Draft-Source': 'webmcp' },
            body: JSON.stringify(input),
            signal,
        });
        return readJson(response);
    };

    return [
        {
            name: 'get_trip_draft_schema',
            description: 'Get the TravelFlow trip format: JSON Schema, rules and a complete example. Read this before creating a trip. TravelFlow does not generate trips; you plan the trip and send it.',
            inputSchema: { type: 'object', properties: {} },
            annotations: { readOnlyHint: true },
            execute: async (_input, options) => {
                const response = await fetchImpl(SCHEMA_URL, { signal: options?.signal });
                return asText(await readJson(response));
            },
        },
        {
            name: 'validate_trip_draft',
            description: 'Check a trip against the TravelFlow format without saving it. Returns ok or a list of errors to fix.',
            inputSchema: TRIP_INPUT_SCHEMA,
            annotations: { readOnlyHint: true },
            execute: async (input, options) => asText(await postDraft('/api/trip-drafts/validate', input, options?.signal)),
        },
        {
            name: 'create_trip_draft',
            description: 'Send a trip you planned to TravelFlow and open it on this page as a draft. The traveller can then review it and save it to their account.',
            inputSchema: TRIP_INPUT_SCHEMA,
            annotations: { readOnlyHint: false, consequentialHint: false },
            execute: async (input, options) => {
                const result = await postDraft('/api/trip-drafts', input, options?.signal);
                if (result.ok === true && typeof result.draftId === 'string') {
                    onDraftCreated?.(result.draftId);
                    navigate(`/draft/${result.draftId}`);
                    return asText({ ...result, message: `Draft created and opened on this page: ${String(result.url)}` });
                }
                return asText(result);
            },
        },
    ];
};

/** Registers the tools when the browser supports WebMCP. Returns whether it did. */
export const registerTravelFlowWebMcpTools = (
    signal: AbortSignal,
    deps: TravelFlowWebMcpDeps,
    modelContext: ModelContextLike | null = resolveModelContext(),
): boolean => {
    if (!modelContext) return false;
    for (const tool of createTravelFlowWebMcpTools(deps)) {
        try {
            modelContext.registerTool(tool, { signal });
        } catch {
            // A duplicate name (hot reload, a second shell) throws InvalidStateError; the first registration stays.
        }
    }
    return true;
};
