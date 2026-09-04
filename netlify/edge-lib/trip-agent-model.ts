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

export interface TripAgentRuntimeModelSettings {
  defaultModelId: string;
  approvedOpenRouterModels: string[];
}

/**
 * Reads the app-wide default model and the approved OpenRouter list in one
 * call. Approval is enforced on the active path, not only on the Gateway one.
 */
export const readRuntimeModelSettings = async (): Promise<TripAgentRuntimeModelSettings> => {
  const supabaseUrl = readEnv('VITE_SUPABASE_URL').replace(/\/+$/, '');
  const anonKey = readEnv('VITE_SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) return { defaultModelId: '', approvedOpenRouterModels: [] };
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
    if (!response.ok) return { defaultModelId: '', approvedOpenRouterModels: [] };
    const payload = await response.json();
    const row = Array.isArray(payload) ? payload[0] : payload;
    const list = Array.isArray(row?.ai_approved_openrouter_models) ? row.ai_approved_openrouter_models : [];
    return {
      defaultModelId: typeof row?.ai_default_model_id === 'string' ? row.ai_default_model_id : '',
      approvedOpenRouterModels: list.flatMap((entry: unknown) => (
        typeof entry === 'string' && entry.trim() ? [entry.trim()] : []
      )),
    };
  } catch {
    return { defaultModelId: '', approvedOpenRouterModels: [] };
  }
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
export const applyOpenRouterReasoning = (
  body: Record<string, unknown>,
  effort: string,
): Record<string, unknown> => {
  if (effort === 'none') return body;
  // OpenRouter rejects a request that carries both `reasoning_effort` and
  // `reasoning.effort`, and the AI SDK sends the flat field for the agent's
  // `reasoning` option, so the two are merged into one here.
  const next: Record<string, unknown> = { ...body };
  delete next.reasoning_effort;
  const existing = next.reasoning as Record<string, unknown> | undefined;
  next.reasoning = { ...(existing || {}), effort };
  return next;
};

/**
 * Provider preferences that keep planning data out of training and logging
 * pipelines. The Gateway path carries the same guarantee through
 * `zeroDataRetention`; without them the OpenRouter path would have none.
 */
export const applyOpenRouterPrivacy = (body: Record<string, unknown>): Record<string, unknown> => ({
  ...body,
  provider: {
    ...(body.provider as Record<string, unknown> | undefined),
    data_collection: 'deny',
    allow_fallbacks: false,
  },
});

export const withOpenRouterRequestPolicy = (effort: string): typeof fetch => async (input, init) => {
  if (!init?.body || typeof init.body !== 'string') return fetch(input, init);
  try {
    const parsed = JSON.parse(init.body) as Record<string, unknown>;
    const body = applyOpenRouterPrivacy(applyOpenRouterReasoning(parsed, effort));
    return await fetch(input, { ...init, body: JSON.stringify(body) });
  } catch {
    return await fetch(input, init);
  }
};

/** True when the configured default may be used as-is. */
export const isApprovedRuntimeDefault = (settings: TripAgentRuntimeModelSettings): boolean => {
  const parsed = settings.defaultModelId.trim();
  if (!parsed) return false;
  if (!parsed.startsWith('openrouter:')) return true;
  const model = parsed.slice('openrouter:'.length);
  return settings.approvedOpenRouterModels.length === 0
    ? false
    : settings.approvedOpenRouterModels.includes(model);
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
      fetch: withOpenRouterRequestPolicy(readEnv('TRIP_AGENT_REASONING_EFFORT') || 'low'),
    }).chat(choice.modelId);
  }
  return createOpenAI({ apiKey: readEnv('OPENAI_API_KEY') }).responses(choice.modelId);
};

export const resolveTripAgentModel = async (
  definitionModel: string,
  fallbackModel: string,
): Promise<{ model: LanguageModel; modelId: string; usingGateway: boolean }> => {
  const override = readEnv('TRIP_AGENT_MODEL');
  const settings = override
    ? { defaultModelId: '', approvedOpenRouterModels: [] }
    : await readRuntimeModelSettings();
  // An unapproved default is ignored rather than silently used: model approval
  // is an administrator decision, and it has to hold on this path too.
  const runtimeDefault = isApprovedRuntimeDefault(settings) ? settings.defaultModelId : '';
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
