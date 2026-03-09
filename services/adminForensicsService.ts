export interface AdminForensicsEventInput {
  source: 'admin' | 'user';
  id: string;
  created_at: string;
  action: string;
  target_type: string;
  target_id: string | null;
  actor_user_id: string | null;
  actor_email: string | null;
  metadata: Record<string, unknown> | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
}

export interface AdminForensicsReplayBundle {
  schema: 'admin_forensics_replay_v1';
  generated_at: string;
  filters: Record<string, unknown>;
  totals: {
    event_count: number;
    correlation_count: number;
  };
  events: Array<{
    sequence: number;
    source: 'admin' | 'user';
    id: string;
    created_at: string;
    correlation_id: string;
    action: string;
    target_type: string;
    target_id: string | null;
    actor_user_id: string | null;
    actor_email: string | null;
    redaction_policy: string;
    metadata: Record<string, unknown>;
    before_data: Record<string, unknown>;
    after_data: Record<string, unknown>;
  }>;
  correlations: Array<{
    correlation_id: string;
    event_ids: string[];
    actions: string[];
    first_seen_at: string;
    last_seen_at: string;
  }>;
}

const asRecord = (value: Record<string, unknown> | null | undefined): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
};

const resolveCorrelationId = (event: AdminForensicsEventInput): string => {
  const metadata = asRecord(event.metadata);
  return (
    asString(metadata.correlation_id)
    || asString(metadata.event_id)
    || `${event.source}:${event.id}`
  );
};

const normalizeRedactionPolicy = (event: AdminForensicsEventInput): string => {
  const metadata = asRecord(event.metadata);
  return asString(metadata.redaction_policy) || 'none';
};

const applyRedactionPolicy = (
  value: Record<string, unknown>,
  policy: string
): Record<string, unknown> => {
  if (policy === 'none') return value;
  const next = { ...value };
  if (Object.prototype.hasOwnProperty.call(next, 'error_message')) {
    next.error_message = '[redacted]';
  }
  return next;
};

export const buildAdminForensicsReplayBundle = (
  events: AdminForensicsEventInput[],
  options?: {
    generatedAtIso?: string;
    filters?: Record<string, unknown>;
  }
): AdminForensicsReplayBundle => {
  const generatedAtIso = options?.generatedAtIso || new Date().toISOString();
  const sortedEvents = [...events].sort((left, right) => (
    left.created_at.localeCompare(right.created_at)
  ));

  const normalizedEvents = sortedEvents.map((event, index) => {
    const correlationId = resolveCorrelationId(event);
    const redactionPolicy = normalizeRedactionPolicy(event);
    const metadata = applyRedactionPolicy(asRecord(event.metadata), redactionPolicy);
    const beforeData = applyRedactionPolicy(asRecord(event.before_data), redactionPolicy);
    const afterData = applyRedactionPolicy(asRecord(event.after_data), redactionPolicy);
    return {
      sequence: index + 1,
      source: event.source,
      id: event.id,
      created_at: event.created_at,
      correlation_id: correlationId,
      action: event.action,
      target_type: event.target_type,
      target_id: event.target_id,
      actor_user_id: event.actor_user_id,
      actor_email: event.actor_email,
      redaction_policy: redactionPolicy,
      metadata,
      before_data: beforeData,
      after_data: afterData,
    } satisfies AdminForensicsReplayBundle['events'][number];
  });

  const correlationMap = new Map<string, {
    event_ids: string[];
    actions: string[];
    first_seen_at: string;
    last_seen_at: string;
  }>();

  normalizedEvents.forEach((event) => {
    const existing = correlationMap.get(event.correlation_id);
    if (!existing) {
      correlationMap.set(event.correlation_id, {
        event_ids: [event.id],
        actions: [event.action],
        first_seen_at: event.created_at,
        last_seen_at: event.created_at,
      });
      return;
    }
    existing.event_ids.push(event.id);
    if (!existing.actions.includes(event.action)) {
      existing.actions.push(event.action);
    }
    if (event.created_at < existing.first_seen_at) existing.first_seen_at = event.created_at;
    if (event.created_at > existing.last_seen_at) existing.last_seen_at = event.created_at;
  });

  const correlations = Array.from(correlationMap.entries())
    .map(([correlationId, payload]) => ({
      correlation_id: correlationId,
      event_ids: payload.event_ids,
      actions: payload.actions,
      first_seen_at: payload.first_seen_at,
      last_seen_at: payload.last_seen_at,
    }))
    .sort((left, right) => left.first_seen_at.localeCompare(right.first_seen_at));

  return {
    schema: 'admin_forensics_replay_v1',
    generated_at: generatedAtIso,
    filters: options?.filters ?? {},
    totals: {
      event_count: normalizedEvents.length,
      correlation_count: correlations.length,
    },
    events: normalizedEvents,
    correlations,
  };
};

export const downloadAdminForensicsReplayBundle = (
  bundle: AdminForensicsReplayBundle,
  fileName: string
): boolean => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  const payload = `${JSON.stringify(bundle, null, 2)}\n`;
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    return true;
  } finally {
    URL.revokeObjectURL(url);
  }
};
