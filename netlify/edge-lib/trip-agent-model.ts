import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';

import { readEnv } from './ai-provider-runtime.ts';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export interface TripAgentModelChoice {
  /** Provider that will serve the call. */
  provider: 'gateway' | 'openrouter' | 'openai';
  /** Model id as the provider expects it. */
  modelId: string;
  /** Full id for logs and message metadata. */
  label: string;
}

export interface TripAgentModelInputs {
  /** `TRIP_AGENT_MODEL`, e.g. "openrouter:google/gemini-3.8-flash". */
  override: string;
  /** `ai_default_model_id` from the public runtime settings. */
  runtimeDefault: string;
  /** Model recorded on the agent definition row. */
  definitionModel: string;
  /** Fallback model recorded on the agent definition row. */
  fallbackModel: string;
  hasGatewayKey: boolean;
  hasOpenRouterKey: boolean;
  hasOpenAiKey: boolean;
}

const parseModelId = (value: string): { provider: string; model: string } | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const separator = trimmed.indexOf(':');
  if (separator === -1) return { provider: '', model: trimmed };
  return { provider: trimmed.slice(0, separator), model: trimmed.slice(separator + 1) };
};

/**
 * Chooses the model the run should use. The planner shares the app's configured
 * default model instead of carrying its own, so changing the default in the
 * admin settings moves the Trip Agent with it.
 */
export const chooseTripAgentModel = (inputs: TripAgentModelInputs): TripAgentModelChoice => {
  for (const candidate of [inputs.override, inputs.runtimeDefault]) {
    const parsed = parseModelId(candidate || '');
    if (!parsed) continue;
    if (parsed.provider === 'openrouter' && inputs.hasOpenRouterKey) {
      return { provider: 'openrouter', modelId: parsed.model, label: `openrouter/${parsed.model}` };
    }
    if (parsed.provider === 'openai' && inputs.hasOpenAiKey) {
      return { provider: 'openai', modelId: parsed.model, label: `openai/${parsed.model}` };
    }
    if (parsed.provider === 'gateway' && inputs.hasGatewayKey) {
      return { provider: 'gateway', modelId: parsed.model, label: parsed.model };
    }
  }

  if (inputs.hasGatewayKey && inputs.definitionModel) {
    return { provider: 'gateway', modelId: inputs.definitionModel, label: inputs.definitionModel };
  }
  if (inputs.hasOpenRouterKey && inputs.definitionModel) {
    return { provider: 'openrouter', modelId: inputs.definitionModel, label: `openrouter/${inputs.definitionModel}` };
  }
  if (inputs.hasOpenAiKey) {
    const directModelId = (inputs.fallbackModel || inputs.definitionModel).replace(/^openai\//, '');
    return { provider: 'openai', modelId: directModelId, label: `openai/${directModelId}` };
  }
  throw new Error('TRIP_AGENT_MODEL_NOT_CONFIGURED');
};

/** Reads the app-wide default model id from the public runtime settings. */
export const readRuntimeDefaultModelId = async (): Promise<string> => {
  const supabaseUrl = readEnv('VITE_SUPABASE_URL').replace(/\/+$/, '');
  const anonKey = readEnv('VITE_SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) return '';
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_public_runtime_settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: '{}',
    });
    if (!response.ok) return '';
    const payload = await response.json();
    const row = Array.isArray(payload) ? payload[0] : payload;
    const value = row?.ai_default_model_id;
    return typeof value === 'string' ? value : '';
  } catch {
    return '';
  }
};

/**
 * Merges OpenRouter's `reasoning` control into each request body. "none" drops
 * the field so a provider default applies.
 */
export const withOpenRouterReasoning = (effort: string): typeof fetch => async (input, init) => {
  if (!init?.body || typeof init.body !== 'string' || effort === 'none') return fetch(input, init);
  try {
    const body = JSON.parse(init.body) as Record<string, unknown>;
    if (!body.reasoning) body.reasoning = { effort, exclude: false };
    return await fetch(input, { ...init, body: JSON.stringify(body) });
  } catch {
    return await fetch(input, init);
  }
};

/** Turns a choice into the language model the AI SDK should call. */
export const instantiateTripAgentModel = (choice: TripAgentModelChoice): LanguageModel => {
  if (choice.provider === 'gateway') return choice.modelId;
  if (choice.provider === 'openrouter') {
    return createOpenAI({
      apiKey: readEnv('OPENROUTER_API_KEY'),
      baseURL: OPENROUTER_BASE_URL,
      headers: { 'X-Title': 'TravelFlow Trip Agent' },
      // OpenRouter takes a `reasoning` body field that the OpenAI-compatible
      // client does not model. Left at its default, Gemini spent its whole
      // output budget thinking and every run ended on `length` before a tool
      // call was emitted.
      fetch: withOpenRouterReasoning(readEnv('TRIP_AGENT_REASONING_EFFORT') || 'low'),
    }).chat(choice.modelId);
  }
  return createOpenAI({ apiKey: readEnv('OPENAI_API_KEY') }).responses(choice.modelId);
};

export const resolveTripAgentModel = async (
  definitionModel: string,
  fallbackModel: string,
): Promise<{ model: LanguageModel; modelId: string; usingGateway: boolean }> => {
  const override = readEnv('TRIP_AGENT_MODEL');
  const runtimeDefault = override ? '' : await readRuntimeDefaultModelId();
  const choice = chooseTripAgentModel({
    override,
    runtimeDefault,
    definitionModel,
    fallbackModel,
    hasGatewayKey: Boolean(readEnv('AI_GATEWAY_API_KEY')),
    hasOpenRouterKey: Boolean(readEnv('OPENROUTER_API_KEY')),
    hasOpenAiKey: Boolean(readEnv('OPENAI_API_KEY')),
  });
  return {
    model: instantiateTripAgentModel(choice),
    modelId: choice.label,
    usingGateway: choice.provider === 'gateway',
  };
};
