import { createMCPClient } from '@ai-sdk/mcp';
import { ToolLoopAgent, isStepCount, type ToolSet } from 'ai';
import { readEnv } from './ai-provider-runtime.ts';
import { resolveTripAgentModel } from './trip-agent-model.ts';
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

export const runGroundedMapsSpecialist = async (input: {
  capability: 'hotel' | 'route';
  task: string;
  definition: AgentRuntimeDefinition;
  abortSignal?: AbortSignal;
}): Promise<{ status: 'complete' | 'unavailable'; summary: string }> => {
  // Only a dedicated server-side key: VITE_GOOGLE_MAPS_API_KEY is shipped to
  // browsers and is expected to be referrer-restricted, so it must not
  // authenticate a server call.
  const apiKey = readEnv('GOOGLE_MAPS_GROUNDING_API_KEY');
  if (!apiKey) {
    return {
      status: 'unavailable',
      summary: 'Google Maps grounding is not configured, so I cannot provide grounded place or route facts yet.',
    };
  }

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
    const specialist = new ToolLoopAgent({
      id: input.definition.agentKey,
      model: resolved.model,
      instructions: input.definition.instructions,
      tools: allowedTools,
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
    return { status: 'complete', summary: result.text.slice(0, 12_000) };
  } catch {
    return {
      status: 'unavailable',
      summary: 'Google Maps grounding is temporarily unavailable. No place or route facts were inferred.',
    };
  } finally {
    await client?.close().catch(() => undefined);
  }
};
