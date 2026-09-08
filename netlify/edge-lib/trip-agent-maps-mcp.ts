import { createMCPClient } from '@ai-sdk/mcp';
import { ToolLoopAgent, isStepCount, tool, type ToolSet } from 'ai';
import { z } from 'zod';
import { readEnv } from './ai-provider-runtime.ts';
import { resolveTripAgentModel } from './trip-agent-model.ts';
import {
  groupHotelOptionsByBudget,
  toRouteAlternatives,
  tripAgentHotelResultSchema,
  tripAgentRouteResultSchema,
} from '../../shared/tripAgentSpecialistResults.ts';
import type { TripAgentHotelOption, TripAgentRouteAlternative } from '../../shared/tripAgent.ts';
import type { AgentRuntimeDefinition } from './trip-agent-store.ts';

const GOOGLE_MAPS_MCP_URL = 'https://mapstools.googleapis.com/mcp';

// The Maps MCP server currently exposes search_places, compute_routes,
// resolve_names, resolve_maps_urls and lookup_weather. Each specialist gets its
// own capability plus name resolution, and nothing else.
const ALLOWED_TOOL_PATTERNS: Record<'hotel' | 'route', RegExp> = {
  hotel: /^(search_places|resolve_names|resolve_maps_urls|.*place.*detail.*)$/i,
  route: /^(compute_routes|resolve_names|.*(route|direction|distance).*)$/i,
};

const selectAllowedTools = (tools: ToolSet, capability: 'hotel' | 'route'): ToolSet => (
  Object.fromEntries(Object.entries(tools).filter(([name]) => ALLOWED_TOOL_PATTERNS[capability].test(name)))
);

export interface GroundedSpecialistResult {
  status: 'complete' | 'unavailable';
  summary: string;
  /** Structured stays, grouped by budget, when the hotel specialist returned any. */
  hotelOptions?: { cityId: string; groups: Record<'low' | 'medium' | 'high', TripAgentHotelOption[]> };
  /** Structured route alternatives, when the route specialist returned any. */
  routeAlternatives?: TripAgentRouteAlternative[];
}

export const runGroundedMapsSpecialist = async (input: {
  capability: 'hotel' | 'route';
  task: string;
  definition: AgentRuntimeDefinition;
  abortSignal?: AbortSignal;
}): Promise<GroundedSpecialistResult> => {
  // A dedicated server key is preferred. The existing Maps key is accepted as a
  // fallback by product decision (2026-09-04): it already works against this
  // endpoint, and a second key was not worth the operational cost. The trade-off
  // is recorded in docs/AI_AGENT_FEATURE_GUARDRAILS.md — that key ships to
  // browsers, so it must stay quota-capped and API-restricted in Google Cloud.
  const dedicatedKey = readEnv('GOOGLE_MAPS_GROUNDING_API_KEY');
  const apiKey = dedicatedKey || readEnv('VITE_GOOGLE_MAPS_API_KEY');
  if (!apiKey) {
    return {
      status: 'unavailable',
      summary: 'Google Maps grounding is not configured, so I cannot provide grounded place or route facts yet.',
    };
  }

  console.info('[trip-agent] grounding key source', {
    capability: input.capability,
    source: dedicatedKey ? 'grounding_key' : 'shared_maps_key',
  });

  let client: Awaited<ReturnType<typeof createMCPClient>> | null = null;
  try {
    client = await createMCPClient({
      transport: {
        type: 'http',
        url: GOOGLE_MAPS_MCP_URL,
        headers: { 'X-Goog-Api-Key': apiKey },
        redirect: 'error',
      },
    });
    const allowedTools = selectAllowedTools(await client.tools(), input.capability);
    if (Object.keys(allowedTools).length === 0) {
      return { status: 'unavailable', summary: 'The Maps provider did not expose an approved capability.' };
    }
    // Same resolution as the orchestrator: a bare model id only works when the
    // AI Gateway is configured, which left the specialists unusable elsewhere.
    const resolved = await resolveTripAgentModel(input.definition.model, input.definition.fallbackModel);
    // The specialist reports through a typed tool instead of prose, so the panel
    // can render three budget groups or selectable alternatives rather than a
    // paragraph.
    let hotelResult: GroundedSpecialistResult['hotelOptions'];
    let routeResult: GroundedSpecialistResult['routeAlternatives'];
    const reportingTools: ToolSet = input.capability === 'hotel'
      ? {
        report_hotel_options: tool({
          description: 'Report the researched stays, grouped low, medium and high by budget fit. Call this once, last.',
          inputSchema: tripAgentHotelResultSchema,
          execute: async (result) => {
            hotelResult = { cityId: result.cityId, groups: groupHotelOptionsByBudget(result.options) };
            return { kind: 'trip-agent-hotel-options' as const, accepted: result.options.length };
          },
        }),
      }
      : {
        report_route_alternatives: tool({
          description: 'Report at most three researched route alternatives. Call this once, last.',
          inputSchema: tripAgentRouteResultSchema,
          execute: async (result) => {
            routeResult = toRouteAlternatives(result);
            return { kind: 'trip-agent-route-alternatives' as const, accepted: result.alternatives.length };
          },
        }),
      };

    const specialist = new ToolLoopAgent({
      id: input.definition.agentKey,
      model: resolved.model,
      instructions: `${input.definition.instructions}

Finish by calling ${input.capability === 'hotel' ? 'report_hotel_options' : 'report_route_alternatives'} exactly once with what you found. Only include options a source supports.`,
      tools: { ...allowedTools, ...reportingTools },
      reasoning: input.definition.reasoningEffort,
      maxOutputTokens: 4_000,
      stopWhen: isStepCount(6),
      ...(resolved.usingGateway ? {
        providerOptions: {
          gateway: {
            models: [input.definition.model, input.definition.fallbackModel],
            zeroDataRetention: true,
            disallowPromptTraining: true,
          },
        },
      } : {}),
    });
    const result = await specialist.generate({
      prompt: input.task.slice(0, 8_000),
      abortSignal: input.abortSignal,
    });
    return {
      status: 'complete',
      summary: result.text.slice(0, 12_000),
      ...(hotelResult ? { hotelOptions: hotelResult } : {}),
      ...(routeResult ? { routeAlternatives: routeResult } : {}),
    };
  } catch {
    return {
      status: 'unavailable',
      summary: 'Google Maps grounding is temporarily unavailable. No place or route facts were inferred.',
    };
  } finally {
    await client?.close().catch(() => undefined);
  }
};
