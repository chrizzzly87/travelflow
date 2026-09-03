import { createMCPClient } from '@ai-sdk/mcp';
import { ToolLoopAgent, isStepCount, type ToolSet } from 'ai';
import { readEnv } from './ai-provider-runtime.ts';
import type { AgentRuntimeDefinition } from './trip-agent-store.ts';

const GOOGLE_MAPS_MCP_URL = 'https://mapstools.googleapis.com/mcp';

const selectAllowedTools = (tools: ToolSet, capability: 'hotel' | 'route'): ToolSet => {
  const matcher = capability === 'hotel'
    ? /(place|search|detail)/i
    : /(route|direction|distance)/i;
  return Object.fromEntries(Object.entries(tools).filter(([name]) => matcher.test(name)));
};

export const runGroundedMapsSpecialist = async (input: {
  capability: 'hotel' | 'route';
  task: string;
  definition: AgentRuntimeDefinition;
  abortSignal?: AbortSignal;
}): Promise<{ status: 'complete' | 'unavailable'; summary: string }> => {
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
    const specialist = new ToolLoopAgent({
      id: input.definition.agentKey,
      model: input.definition.model,
      instructions: input.definition.instructions,
      tools: allowedTools,
      reasoning: input.definition.reasoningEffort,
      maxOutputTokens: 2_000,
      stopWhen: isStepCount(6),
      providerOptions: {
        gateway: {
          models: [input.definition.model, input.definition.fallbackModel],
          zeroDataRetention: true,
          disallowPromptTraining: true,
        },
      },
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
