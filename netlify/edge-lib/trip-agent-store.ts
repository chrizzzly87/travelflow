import type { ITrip, IViewSettings } from '../../types.ts';
import type {
  TripAgentChangeSetV1,
  TripAgentContextRef,
  TripAgentMessage,
  TripAgentQuotaState,
} from '../../shared/tripAgent.ts';
import { readEnv } from './ai-provider-runtime.ts';
import { redactDiagnostic } from './trip-agent-redaction.ts';

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

/**
 * Loads a trip the actor may edit. A share token is accepted as proof of
 * editable-share access, which is how the rest of the app treats it.
 */
export const loadEditableTrip = async (
  tripId: string,
  actorId: string,
  shareToken?: string | null,
): Promise<{
  trip: ITrip;
  view: IViewSettings | null;
}> => {
  const allowed = await rpc<boolean>('trip_agent_can_edit_with_share', {
    p_trip_id: tripId,
    p_user_id: actorId,
    p_share_token: shareToken || null,
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
  const threads = rows.map(mapThread);
  const untitled = threads.filter((thread) => thread.title === DEFAULT_TRIP_AGENT_THREAD_TITLE);
  if (untitled.length === 0) return threads;

  // Chats created before prompt-based naming, or created and never used, would
  // otherwise all read "New trip chat" in the history menu.
  const ids = untitled.map((thread) => `"${thread.id}"`).join(',');
  const firstPrompts = await rest<Array<{ thread_id: string; parts: TripAgentMessage['parts'] }>>(
    `trip_agent_messages?thread_id=in.(${encodeURIComponent(ids)})&role=eq.user&select=thread_id,parts&order=sequence.asc&limit=200`,
  ).catch(() => [] as Array<{ thread_id: string; parts: TripAgentMessage['parts'] }>);

  const titleByThread = new Map<string, string>();
  (firstPrompts || []).forEach((row) => {
    if (titleByThread.has(row.thread_id)) return;
    const text = (row.parts || []).find((part) => part.type === 'text');
    const title = text && 'text' in text ? String(text.text).replace(/\s+/g, ' ').trim().slice(0, 60) : '';
    if (title) titleByThread.set(row.thread_id, title);
  });

  return threads.map((thread) => {
    const derived = titleByThread.get(thread.id);
    return derived ? { ...thread, title: derived } : thread;
  });
};

export const DEFAULT_TRIP_AGENT_THREAD_TITLE = 'New trip chat';

export const createTripAgentThread = async (
  tripId: string,
  actorId: string,
  title = DEFAULT_TRIP_AGENT_THREAD_TITLE,
): Promise<TripAgentThreadRecord> => {
  const rows = await rest<ThreadRow[]>('trip_agent_threads?select=*', {
    method: 'POST',
    headers: serviceHeaders('return=representation'),
    body: JSON.stringify({ trip_id: tripId, created_by: actorId, title: title.slice(0, 160) }),
  });
  return mapThread(rows[0]);
};

/**
 * Names a chat after its first prompt so the history list is readable. The
 * default-title filter keeps a renamed thread untouched.
 */
export const titleTripAgentThreadFromPrompt = async (threadId: string, prompt: string): Promise<void> => {
  const title = prompt.replace(/\s+/g, ' ').trim().slice(0, 60);
  if (!title) return;
  await rest(
    `trip_agent_threads?id=eq.${encodeURIComponent(threadId)}&title=eq.${encodeURIComponent(DEFAULT_TRIP_AGENT_THREAD_TITLE)}`,
    {
      method: 'PATCH',
      headers: serviceHeaders('return=minimal'),
      body: JSON.stringify({ title, updated_at: new Date().toISOString() }),
    },
  );
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
  status: 'streaming' | 'complete' | 'cancelled' | 'failed';
  context_refs: TripAgentContextRef[] | null;
};

const STALE_STREAM_MS = 3 * 60 * 1_000;

/**
 * Closes out runs that were streaming when the tab went away. Without this a
 * reloaded transcript shows a spinner that can never finish.
 */
export const abortStaleTripAgentStreams = async (threadId: string): Promise<number> => {
  const cutoff = new Date(Date.now() - STALE_STREAM_MS).toISOString();
  const [staleMessages, staleRuns] = await Promise.all([
    rest<Array<{ id: string }>>(
      `trip_agent_messages?thread_id=eq.${encodeURIComponent(threadId)}&status=eq.streaming&updated_at=lt.${encodeURIComponent(cutoff)}&select=id`,
    ).catch(() => [] as Array<{ id: string }>),
    // A run can outlive its message: the platform can terminate the function
    // between the last token and the closing write.
    rest<Array<{ id: string }>>(
      `trip_agent_runs?thread_id=eq.${encodeURIComponent(threadId)}&status=eq.running&started_at=lt.${encodeURIComponent(cutoff)}&select=id`,
    ).catch(() => [] as Array<{ id: string }>),
  ]);

  if (staleMessages?.length) {
    await rest(`trip_agent_messages?thread_id=eq.${encodeURIComponent(threadId)}&status=eq.streaming&updated_at=lt.${encodeURIComponent(cutoff)}`, {
      method: 'PATCH',
      headers: serviceHeaders('return=minimal'),
      body: JSON.stringify({ status: 'cancelled', updated_at: new Date().toISOString() }),
    }).catch(() => undefined);
  }
  if (staleRuns?.length) {
    await rest(`trip_agent_runs?thread_id=eq.${encodeURIComponent(threadId)}&status=eq.running&started_at=lt.${encodeURIComponent(cutoff)}`, {
      method: 'PATCH',
      headers: serviceHeaders('return=minimal'),
      body: JSON.stringify({ status: 'cancelled', error_code: 'RUN_ABANDONED', finished_at: new Date().toISOString() }),
    }).catch(() => undefined);
  }
  return (staleMessages?.length || 0) + (staleRuns?.length || 0);
};

export const loadTripAgentMessages = async (threadId: string): Promise<TripAgentMessage[]> => {
  const rows = await rest<MessageRow[]>(
    `trip_agent_messages?thread_id=eq.${encodeURIComponent(threadId)}&select=id,role,parts,metadata,status,context_refs&order=sequence.asc&limit=500`,
  );
  return rows.map((row) => ({
    id: row.id,
    role: row.role === 'system' ? 'assistant' : row.role,
    // A reasoning part predates the no-reasoning rule; it is dropped on read too.
    parts: (row.parts || []).filter((part) => part.type !== 'reasoning'),
    metadata: {
      ...(row.metadata || {}),
      status: row.status,
      ...(row.context_refs?.length ? { contextRefs: row.context_refs } : {}),
    },
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
      error_message: redactDiagnostic(input.errorMessage) || null,
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
  // One open proposal per trip: a second pending set would go stale the moment
  // the first is applied, and the reviewer would meet two competing cards.
  await rest(
    `trip_agent_change_sets?trip_id=eq.${encodeURIComponent(changeSet.tripId)}&status=eq.pending`,
    {
      method: 'PATCH',
      headers: serviceHeaders('return=minimal'),
      body: JSON.stringify({ status: 'rejected', rejected_at: new Date().toISOString() }),
    },
  ).catch(() => undefined);
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

export interface TripAgentChangeSetStatusRecord {
  id: string;
  status: 'pending' | 'applied' | 'applied_partial' | 'rejected' | 'stale';
  appliedOperationIds: string[];
}

/**
 * Current status of every proposal in a thread. A transcript keeps the proposal
 * as it was streamed, so the card has to be rebuilt from the record, or a
 * reload would offer an applied or rejected proposal again.
 */
export const loadTripAgentChangeSetStatuses = async (
  threadId: string,
): Promise<TripAgentChangeSetStatusRecord[]> => {
  const rows = await rest<Array<{ id: string; status: TripAgentChangeSetStatusRecord['status']; selected_operation_ids: string[] | null }>>(
    `trip_agent_change_sets?thread_id=eq.${encodeURIComponent(threadId)}&select=id,status,selected_operation_ids&limit=200`,
  ).catch(() => []);
  return (rows || []).map((row) => ({
    id: row.id,
    status: row.status,
    appliedOperationIds: row.selected_operation_ids || [],
  }));
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
  actorId: string;
  changeSetId: string;
  selectedOperationIds: string[];
  trip: ITrip;
  view: IViewSettings | null;
  shareToken?: string | null;
}): Promise<{ trip: ITrip; versionId: string; status: 'applied' | 'applied_partial' | 'stale' }> => {
  const result = await rpc<{ trip: ITrip | null; versionId: string | null; status: 'applied' | 'applied_partial' | 'stale' }>(
    'apply_trip_agent_change_set',
    {
      p_actor_id: input.actorId,
      p_change_set_id: input.changeSetId,
      p_selected_operation_ids: input.selectedOperationIds,
      p_trip_data: safeJson(input.trip),
      p_view_settings: safeJson(input.view),
      p_share_token: input.shareToken || null,
    },
  );
  // The stale case is a result rather than a raised error, so the status update
  // that records it survives; the caller turns it into the client failure.
  if (result?.status === 'stale') throw new Error('TRIP_AGENT_STALE_PROPOSAL');
  return result as { trip: ITrip; versionId: string; status: 'applied' | 'applied_partial' };
};

export const rejectTripAgentChangeSet = async (changeSetId: string, tripId: string): Promise<void> => {
  await rest(`trip_agent_change_sets?id=eq.${encodeURIComponent(changeSetId)}&trip_id=eq.${encodeURIComponent(tripId)}&status=eq.pending`, {
    method: 'PATCH',
    headers: serviceHeaders('return=minimal'),
    body: JSON.stringify({ status: 'rejected', rejected_at: new Date().toISOString() }),
  });
};
