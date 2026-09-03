import type { ITrip, IViewSettings } from '../../types.ts';
import type {
  TripAgentChangeSetV1,
  TripAgentContextRef,
  TripAgentMessage,
  TripAgentQuotaState,
} from '../../shared/tripAgent.ts';
import { readEnv } from './ai-provider-runtime.ts';

const MAX_PERSISTED_JSON_CHARS = 180_000;

const serviceHeaders = (prefer?: string): HeadersInit => {
  const key = readEnv('SUPABASE_SERVICE_ROLE_KEY');
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    ...(prefer ? { Prefer: prefer } : {}),
  };
};

const serviceUrl = (): string => readEnv('VITE_SUPABASE_URL').replace(/\/+$/, '');

const ensureConfigured = (): void => {
  if (!serviceUrl() || !readEnv('SUPABASE_SERVICE_ROLE_KEY')) {
    throw new Error('Trip Agent persistence is not configured.');
  }
};

const parseError = async (response: Response): Promise<never> => {
  const raw = await response.text();
  let message = raw || `Supabase request failed (${response.status}).`;
  try {
    const parsed = JSON.parse(raw) as { message?: string; hint?: string };
    message = parsed.message || parsed.hint || message;
  } catch {
    // Keep the bounded response text.
  }
  throw new Error(message.slice(0, 1_000));
};

const rest = async <T>(path: string, init?: RequestInit): Promise<T> => {
  ensureConfigured();
  const response = await fetch(`${serviceUrl()}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...serviceHeaders(),
      ...(init?.headers || {}),
    },
  });
  if (!response.ok) return parseError(response);
  if (response.status === 204) return undefined as T;
  const raw = await response.text();
  if (!raw.trim()) return undefined as T;
  return JSON.parse(raw) as T;
};

const rpc = async <T>(name: string, body: Record<string, unknown>): Promise<T> =>
  rest<T>(`rpc/${name}`, {
    method: 'POST',
    headers: serviceHeaders('return=representation'),
    body: JSON.stringify(body),
  });

const safeJson = (value: unknown): unknown => {
  const serialized = JSON.stringify(value);
  if (serialized.length > MAX_PERSISTED_JSON_CHARS) {
    throw new Error('Trip Agent payload is too large.');
  }
  return JSON.parse(serialized);
};

export interface TripAgentActor {
  userId: string;
  label: string;
  isAdmin: boolean;
}

export interface TripAgentThreadRecord {
  id: string;
  tripId: string;
  title: string;
  status: 'active' | 'archived';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

type ThreadRow = {
  id: string;
  trip_id: string;
  title: string;
  status: 'active' | 'archived';
  created_by: string;
  created_at: string;
  updated_at: string;
};

const mapThread = (row: ThreadRow): TripAgentThreadRecord => ({
  id: row.id,
  tripId: row.trip_id,
  title: row.title,
  status: row.status,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const getTripAgentActor = async (userId: string): Promise<TripAgentActor> => {
  const rows = await rest<Array<{
    display_name: string | null;
    username: string | null;
    first_name: string | null;
    system_role: string | null;
  }>>(`profiles?id=eq.${encodeURIComponent(userId)}&select=display_name,username,first_name,system_role&limit=1`);
  const profile = rows[0];
  return {
    userId,
    label: profile?.display_name || profile?.first_name || profile?.username || 'Trip editor',
    isAdmin: profile?.system_role === 'admin',
  };
};

export const assertTripAgentAvailable = async (actor: TripAgentActor): Promise<void> => {
  const rows = await rest<Array<{ trip_agent_enabled: boolean; trip_agent_admin_preview: boolean }>>(
    'app_runtime_settings?select=trip_agent_enabled,trip_agent_admin_preview&limit=1',
  );
  const settings = rows[0];
  const available = settings?.trip_agent_enabled === true
    || (settings?.trip_agent_admin_preview !== false && actor.isAdmin);
  if (!available) throw new Error('TRIP_AGENT_DISABLED');
};

export const loadEditableTrip = async (tripId: string, actorId: string): Promise<{
  trip: ITrip;
  view: IViewSettings | null;
}> => {
  const allowed = await rpc<boolean>('trip_agent_can_edit', {
    p_trip_id: tripId,
    p_user_id: actorId,
  });
  if (!allowed) throw new Error('TRIP_AGENT_EDIT_ACCESS_REQUIRED');
  const rows = await rest<Array<{ data: ITrip; view_settings: IViewSettings | null }>>(
    `trips?id=eq.${encodeURIComponent(tripId)}&select=data,view_settings&limit=1`,
  );
  if (!rows[0]) throw new Error('Trip not found.');
  return { trip: rows[0].data, view: rows[0].view_settings };
};

export const listTripAgentThreads = async (tripId: string): Promise<TripAgentThreadRecord[]> => {
  const rows = await rest<ThreadRow[]>(
    `trip_agent_threads?trip_id=eq.${encodeURIComponent(tripId)}&select=*&order=updated_at.desc&limit=100`,
  );
  return rows.map(mapThread);
};

export const createTripAgentThread = async (
  tripId: string,
  actorId: string,
  title = 'New trip chat',
): Promise<TripAgentThreadRecord> => {
  const rows = await rest<ThreadRow[]>('trip_agent_threads?select=*', {
    method: 'POST',
    headers: serviceHeaders('return=representation'),
    body: JSON.stringify({ trip_id: tripId, created_by: actorId, title: title.slice(0, 160) }),
  });
  return mapThread(rows[0]);
};

export const archiveTripAgentThread = async (threadId: string, tripId: string): Promise<void> => {
  await rest(`trip_agent_threads?id=eq.${encodeURIComponent(threadId)}&trip_id=eq.${encodeURIComponent(tripId)}`, {
    method: 'PATCH',
    headers: serviceHeaders('return=minimal'),
    body: JSON.stringify({ status: 'archived', archived_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
  });
};

export const assertThreadInTrip = async (threadId: string, tripId: string): Promise<void> => {
  const rows = await rest<Array<{ id: string }>>(
    `trip_agent_threads?id=eq.${encodeURIComponent(threadId)}&trip_id=eq.${encodeURIComponent(tripId)}&status=eq.active&select=id&limit=1`,
  );
  if (!rows[0]) throw new Error('Trip Agent thread not found or archived.');
};

type MessageRow = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts: TripAgentMessage['parts'];
  metadata: TripAgentMessage['metadata'];
};

export const loadTripAgentMessages = async (threadId: string): Promise<TripAgentMessage[]> => {
  const rows = await rest<MessageRow[]>(
    `trip_agent_messages?thread_id=eq.${encodeURIComponent(threadId)}&select=id,role,parts,metadata&order=sequence.asc&limit=500`,
  );
  return rows.map((row) => ({
    id: row.id,
    role: row.role === 'system' ? 'assistant' : row.role,
    parts: row.parts,
    metadata: row.metadata || {},
  }));
};

export const persistTripAgentMessage = async (input: {
  message: TripAgentMessage;
  threadId: string;
  tripId: string;
  authorId?: string | null;
  contextRefs?: TripAgentContextRef[];
  status?: 'streaming' | 'complete' | 'cancelled' | 'failed';
}): Promise<void> => {
  await rest('trip_agent_messages?on_conflict=id', {
    method: 'POST',
    headers: serviceHeaders('resolution=merge-duplicates,return=minimal'),
    body: JSON.stringify({
      id: input.message.id,
      thread_id: input.threadId,
      trip_id: input.tripId,
      author_id: input.authorId || null,
      role: input.message.role,
      parts: safeJson(input.message.parts),
      context_refs: safeJson(input.contextRefs || []),
      status: input.status || 'complete',
      metadata: safeJson(input.message.metadata || {}),
      updated_at: new Date().toISOString(),
    }),
  });
  await rest(`trip_agent_threads?id=eq.${encodeURIComponent(input.threadId)}`, {
    method: 'PATCH',
    headers: serviceHeaders('return=minimal'),
    body: JSON.stringify({ updated_at: new Date().toISOString() }),
  });
};

export const reserveTripAgentQuota = async (
  userId: string,
  requestId: string,
  tripId: string,
): Promise<TripAgentQuotaState & { allowed: boolean }> => {
  const result = await rpc<{
    allowed: boolean;
    used: number;
    limit: number | null;
    remaining: number | null;
    resetsAt: string;
  } | undefined>('reserve_trip_agent_request', {
    p_user_id: userId,
    p_request_id: requestId,
    p_trip_id: tripId,
  });
  if (!result || typeof result.allowed !== 'boolean') {
    throw new Error('Trip Agent quota reservation is not configured.');
  }
  return { ...result, enabled: true };
};

export const refundTripAgentQuota = async (userId: string, requestId: string): Promise<void> => {
  await rpc('refund_trip_agent_request', { p_user_id: userId, p_request_id: requestId });
};

export const getTripAgentQuota = async (userId: string): Promise<TripAgentQuotaState> => {
  const [entitlements, usageRows] = await Promise.all([
    rpc<Record<string, unknown>>('get_effective_entitlements', { p_user_id: userId }),
    rest<Array<{ used_count: number }>>(
      `trip_agent_usage_daily?user_id=eq.${encodeURIComponent(userId)}&usage_date=eq.${new Date().toISOString().slice(0, 10)}&select=used_count&limit=1`,
    ),
  ]);
  const limitValue = entitlements.tripAgentRequestsPerDay;
  const limit = typeof limitValue === 'number' ? Math.max(0, Math.floor(limitValue)) : null;
  const used = usageRows[0]?.used_count || 0;
  const tomorrow = new Date();
  tomorrow.setUTCHours(24, 0, 0, 0);
  return {
    enabled: entitlements.canUseTripAgent !== false,
    limit,
    used,
    remaining: limit === null ? null : Math.max(limit - used, 0),
    resetsAt: tomorrow.toISOString(),
  };
};

export interface AgentRuntimeDefinition {
  agentKey: 'trip_orchestrator' | 'hotel_scout' | 'route_planner';
  enabled: boolean;
  model: string;
  fallbackModel: string;
  reasoningEffort: 'none' | 'minimal' | 'low' | 'medium' | 'high';
  promptVersionId: string;
  instructions: string;
  toolAllowlist: string[];
  mcpCapabilityAllowlist: string[];
}

export const loadAgentDefinition = async (agentKey: AgentRuntimeDefinition['agentKey']): Promise<AgentRuntimeDefinition> => {
  const rows = await rest<Array<{
    agent_key: AgentRuntimeDefinition['agentKey']; enabled: boolean; model: string; fallback_model: string;
    reasoning_effort: AgentRuntimeDefinition['reasoningEffort']; published_prompt_version_id: string;
    tool_allowlist: string[]; mcp_capability_allowlist: string[];
  }>>(`trip_agent_definitions?agent_key=eq.${agentKey}&select=*&limit=1`);
  const row = rows[0];
  if (!row?.enabled || !row.published_prompt_version_id) throw new Error(`Agent ${agentKey} is unavailable.`);
  const prompts = await rest<Array<{ instructions: string }>>(
    `trip_agent_prompt_versions?id=eq.${row.published_prompt_version_id}&status=eq.published&select=instructions&limit=1`,
  );
  if (!prompts[0]) throw new Error(`Published prompt for ${agentKey} is unavailable.`);
  return {
    agentKey: row.agent_key,
    enabled: row.enabled,
    model: row.model,
    fallbackModel: row.fallback_model,
    reasoningEffort: row.reasoning_effort,
    promptVersionId: row.published_prompt_version_id,
    instructions: prompts[0].instructions,
    toolAllowlist: row.tool_allowlist,
    mcpCapabilityAllowlist: row.mcp_capability_allowlist,
  };
};

export const createTripAgentRun = async (input: {
  id: string; threadId: string; tripId: string; userId: string; requestId: string;
  definition: AgentRuntimeDefinition; model: string;
}): Promise<void> => {
  await rest('trip_agent_runs', {
    method: 'POST',
    headers: serviceHeaders('return=minimal'),
    body: JSON.stringify({
      id: input.id,
      thread_id: input.threadId,
      trip_id: input.tripId,
      user_id: input.userId,
      request_id: input.requestId,
      agent_key: input.definition.agentKey,
      prompt_version_id: input.definition.promptVersionId,
      model: input.model,
      fallback_model: input.definition.fallbackModel,
      status: 'running',
      started_at: new Date().toISOString(),
    }),
  });
};

export const finishTripAgentRun = async (runId: string, input: {
  status: 'completed' | 'failed' | 'cancelled' | 'refunded';
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
  errorCode?: string;
  errorMessage?: string;
}): Promise<void> => {
  await rest(`trip_agent_runs?id=eq.${encodeURIComponent(runId)}`, {
    method: 'PATCH',
    headers: serviceHeaders('return=minimal'),
    body: JSON.stringify({
      status: input.status,
      latency_ms: input.latencyMs,
      input_tokens: input.inputTokens ?? null,
      output_tokens: input.outputTokens ?? null,
      estimated_cost_usd: input.estimatedCostUsd ?? null,
      error_code: input.errorCode || null,
      error_message: input.errorMessage?.slice(0, 1_000) || null,
      finished_at: new Date().toISOString(),
    }),
  });
};

export const persistTripAgentToolCall = async (input: {
  runId: string; agentKey: string; toolName: string; toolInput: unknown; toolOutput?: unknown;
  status: 'completed' | 'failed' | 'unavailable'; durationMs?: number; errorCode?: string;
}): Promise<void> => {
  await rest('trip_agent_tool_calls', {
    method: 'POST',
    headers: serviceHeaders('return=minimal'),
    body: JSON.stringify({
      run_id: input.runId,
      agent_key: input.agentKey,
      tool_name: input.toolName,
      input: safeJson(input.toolInput),
      output: safeJson(input.toolOutput ?? null),
      status: input.status,
      duration_ms: input.durationMs ?? null,
      error_code: input.errorCode || null,
      finished_at: new Date().toISOString(),
    }),
  });
};

export const persistTripAgentChangeSet = async (changeSet: TripAgentChangeSetV1, actorId: string): Promise<void> => {
  await rest('trip_agent_change_sets', {
    method: 'POST',
    headers: serviceHeaders('return=minimal'),
    body: JSON.stringify({
      id: changeSet.id,
      run_id: changeSet.runId,
      thread_id: changeSet.threadId,
      trip_id: changeSet.tripId,
      created_by: actorId,
      schema_version: changeSet.schemaVersion,
      base_trip_updated_at: changeSet.baseTripUpdatedAt,
      summary: changeSet.summary,
      operations: safeJson(changeSet.operations),
      sources: safeJson(changeSet.sources),
      status: 'pending',
    }),
  });
};

export const loadTripAgentChangeSet = async (changeSetId: string, tripId: string): Promise<TripAgentChangeSetV1> => {
  const rows = await rest<Array<{
    id: string; run_id: string; thread_id: string; trip_id: string; schema_version: 1;
    base_trip_updated_at: number; summary: string; operations: TripAgentChangeSetV1['operations'];
    sources: TripAgentChangeSetV1['sources']; status: TripAgentChangeSetV1['status'];
    selected_operation_ids: string[]; applied_version_id: string | null; created_at: string; applied_at: string | null;
  }>>(`trip_agent_change_sets?id=eq.${encodeURIComponent(changeSetId)}&trip_id=eq.${encodeURIComponent(tripId)}&select=*&limit=1`);
  const row = rows[0];
  if (!row) throw new Error('Trip Agent proposal not found.');
  return {
    schemaVersion: row.schema_version,
    id: row.id,
    tripId: row.trip_id,
    threadId: row.thread_id,
    runId: row.run_id,
    baseTripUpdatedAt: Number(row.base_trip_updated_at),
    summary: row.summary,
    operations: row.operations,
    sources: row.sources,
    status: row.status,
    selectedOperationIds: row.selected_operation_ids,
    appliedVersionId: row.applied_version_id,
    createdAt: row.created_at,
    appliedAt: row.applied_at,
  };
};

export const applyPersistedTripAgentChangeSet = async (input: {
  actorId: string; changeSetId: string; selectedOperationIds: string[]; trip: ITrip; view: IViewSettings | null;
}): Promise<{ trip: ITrip; versionId: string; status: 'applied' | 'applied_partial' }> =>
  rpc('apply_trip_agent_change_set', {
    p_actor_id: input.actorId,
    p_change_set_id: input.changeSetId,
    p_selected_operation_ids: input.selectedOperationIds,
    p_trip_data: safeJson(input.trip),
    p_view_settings: safeJson(input.view),
  });

export const rejectTripAgentChangeSet = async (changeSetId: string, tripId: string): Promise<void> => {
  await rest(`trip_agent_change_sets?id=eq.${encodeURIComponent(changeSetId)}&trip_id=eq.${encodeURIComponent(tripId)}&status=eq.pending`, {
    method: 'PATCH',
    headers: serviceHeaders('return=minimal'),
    body: JSON.stringify({ status: 'rejected', rejected_at: new Date().toISOString() }),
  });
};
