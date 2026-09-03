import { z } from 'zod';

import {
  applyTripAgentOperations,
  tripAgentContextRefSchema,
  type TripAgentMessage,
} from '../../shared/tripAgent.ts';
import {
  createTripAgentThread,
  archiveTripAgentThread,
  applyPersistedTripAgentChangeSet,
  assertThreadInTrip,
  assertTripAgentAvailable,
  getTripAgentActor,
  getTripAgentQuota,
  listTripAgentThreads,
  loadEditableTrip,
  loadTripAgentChangeSet,
  loadTripAgentMessages,
  persistTripAgentMessage,
  rejectTripAgentChangeSet,
  refundTripAgentQuota,
  reserveTripAgentQuota,
} from '../edge-lib/trip-agent-store.ts';
import { streamTripAgentResponse } from '../edge-lib/trip-agent-runtime.ts';
import { getBearerToken, verifySupabaseUser } from '../edge-lib/ai-generate-guard.ts';

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

const json = (status: number, payload: unknown): Response =>
  new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS });

const uuidSchema = z.string().uuid();
const tripIdSchema = z.string().trim().min(1).max(160);

interface TripAgentLogContext {
  action: string;
  tripId?: string;
  threadId?: string;
  requestId?: string;
}

const boundedErrorMessage = (error: unknown): string => (
  error instanceof Error ? error.message.slice(0, 300) : 'Unknown Trip Agent error.'
);

export interface TripAgentFailure {
  status: number;
  code: string;
  error: string;
}

export const classifyTripAgentFailure = (error: unknown): TripAgentFailure => {
  if (error instanceof z.ZodError) {
    return { status: 400, code: 'TRIP_AGENT_INVALID_REQUEST', error: 'This request could not be read. Reload the planner and try again.' };
  }
  const message = error instanceof Error ? error.message : 'Unknown Trip Agent error.';
  const has = (needle: string): boolean => message.includes(needle);
  if (has('AUTH') || has('REGISTERED_ACCOUNT')) return { status: 401, code: 'TRIP_AGENT_AUTH_REQUIRED', error: 'Create an account to plan with AI.' };
  if (has('EDIT_ACCESS')) return { status: 403, code: 'TRIP_AGENT_EDIT_ACCESS_REQUIRED', error: 'Edit access is required.' };
  if (has('DISABLED')) return { status: 403, code: 'TRIP_AGENT_DISABLED', error: 'Trip Agent is not enabled for this account yet.' };
  if (has('STALE')) return { status: 409, code: 'TRIP_AGENT_PROPOSAL_STALE', error: 'This proposal is based on an older trip version.' };
  if (has('NOT_PENDING')) return { status: 409, code: 'TRIP_AGENT_PROPOSAL_NOT_PENDING', error: 'This proposal is no longer pending.' };
  if (has('MODEL_NOT_CONFIGURED')) return { status: 503, code: 'TRIP_AGENT_MODEL_NOT_CONFIGURED', error: 'Trip Agent model access is not configured.' };
  if (has('PERSISTENCE_FAILED')) return { status: 502, code: 'TRIP_AGENT_PERSISTENCE_FAILED', error: 'Your message could not be saved, so nothing was sent.' };
  if (has('is not configured')) return { status: 503, code: 'TRIP_AGENT_NOT_CONFIGURED', error: 'Trip Agent is not configured on this environment.' };
  if (has('thread not found')) return { status: 404, code: 'TRIP_AGENT_THREAD_NOT_FOUND', error: 'This chat is no longer available.' };
  if (has('too large')) return { status: 413, code: 'TRIP_AGENT_PAYLOAD_TOO_LARGE', error: 'This message is too large to process.' };
  return { status: 502, code: 'TRIP_AGENT_REQUEST_FAILED', error: 'Trip Agent could not complete this request.' };
};

const errorResponse = (error: unknown, context: TripAgentLogContext): Response => {
  const failure = classifyTripAgentFailure(error);
  return json(failure.status, {
    code: failure.code,
    error: failure.error,
    detail: boundedErrorMessage(error),
    ...(context.requestId ? { requestId: context.requestId } : {}),
  });
};

const authenticate = async (request: Request) => {
  const token = getBearerToken(request);
  if (!token) throw new Error('AUTH_REQUIRED');
  const verification = await verifySupabaseUser(token);
  if (!verification.ok) throw new Error('AUTH_TOKEN_INVALID');
  if (verification.isAnonymous) throw new Error('TRIP_AGENT_REGISTERED_ACCOUNT_REQUIRED');
  const actor = await getTripAgentActor(verification.userId);
  await assertTripAgentAvailable(actor);
  return actor;
};

const userMessageSchema = z.object({
  id: z.string().trim().min(1).max(160),
  role: z.literal('user'),
  parts: z.array(z.object({ type: z.literal('text'), text: z.string().trim().min(1).max(8_000) }).passthrough()).min(1).max(5),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('createThread'), tripId: tripIdSchema }).strict(),
  z.object({ action: z.literal('archiveThread'), tripId: tripIdSchema, threadId: uuidSchema }).strict(),
  z.object({
    action: z.literal('chat'),
    tripId: tripIdSchema,
    threadId: uuidSchema,
    requestId: uuidSchema,
    message: userMessageSchema,
    contextRefs: z.array(tripAgentContextRefSchema).max(12).default([]),
  }).strict(),
  z.object({
    action: z.literal('apply'),
    tripId: tripIdSchema,
    changeSetId: uuidSchema,
    selectedOperationIds: z.array(z.string().trim().min(1).max(120)).min(1).max(100),
  }).strict(),
  z.object({ action: z.literal('reject'), tripId: tripIdSchema, changeSetId: uuidSchema }).strict(),
]);

export default async (request: Request) => {
  const startedAt = Date.now();
  let logContext: TripAgentLogContext = {
    action: request.method === 'GET' ? 'bootstrap' : 'unknown',
  };
  try {
    const actor = await authenticate(request);

    if (request.method === 'GET') {
      const url = new URL(request.url);
      const tripId = tripIdSchema.parse(url.searchParams.get('tripId'));
      const requestedThreadId = url.searchParams.get('threadId');
      logContext = { action: 'bootstrap', tripId, threadId: requestedThreadId || undefined };
      await loadEditableTrip(tripId, actor.userId);
      const threads = await listTripAgentThreads(tripId);
      const currentThread = requestedThreadId
        ? threads.find((thread) => thread.id === requestedThreadId)
        : threads.find((thread) => thread.status === 'active');
      const [messages, quota] = await Promise.all([
        currentThread ? loadTripAgentMessages(currentThread.id) : Promise.resolve([]),
        getTripAgentQuota(actor.userId),
      ]);
      return json(200, { actor, threads, currentThreadId: currentThread?.id || null, messages, quota });
    }

    if (request.method !== 'POST') return json(405, { error: 'Method not allowed.' });
    const body = bodySchema.parse(await request.json());
    logContext = {
      action: body.action,
      tripId: body.tripId,
      ...('threadId' in body ? { threadId: body.threadId } : {}),
      ...('requestId' in body ? { requestId: body.requestId } : {}),
    };
    const canonical = await loadEditableTrip(body.tripId, actor.userId);

    if (body.action === 'createThread') {
      return json(201, { thread: await createTripAgentThread(body.tripId, actor.userId) });
    }
    if (body.action === 'archiveThread') {
      await assertThreadInTrip(body.threadId, body.tripId);
      await archiveTripAgentThread(body.threadId, body.tripId);
      return json(200, { ok: true });
    }
    if (body.action === 'reject') {
      await loadTripAgentChangeSet(body.changeSetId, body.tripId);
      await rejectTripAgentChangeSet(body.changeSetId, body.tripId);
      return json(200, { ok: true });
    }
    if (body.action === 'apply') {
      const changeSet = await loadTripAgentChangeSet(body.changeSetId, body.tripId);
      const replay = applyTripAgentOperations(canonical.trip, changeSet.operations, body.selectedOperationIds);
      if (replay.appliedOperationIds.length === 0) {
        return json(422, { code: 'TRIP_AGENT_NO_OP', error: 'The selected changes no longer alter this trip.' });
      }
      const committed = await applyPersistedTripAgentChangeSet({
        actorId: actor.userId,
        changeSetId: body.changeSetId,
        selectedOperationIds: replay.appliedOperationIds,
        trip: replay.trip,
        view: canonical.view,
      });
      return json(200, { ...committed, appliedOperationIds: replay.appliedOperationIds, noOpOperationIds: replay.noOpOperationIds });
    }

    await assertThreadInTrip(body.threadId, body.tripId);
    const quota = await reserveTripAgentQuota(actor.userId, body.requestId, body.tripId);
    if (!quota.allowed) {
      return json(429, { code: 'TRIP_AGENT_QUOTA_EXCEEDED', error: 'Daily Trip Agent limit reached.', quota });
    }
    const userMessage = {
      ...(body.message as TripAgentMessage),
      metadata: {
        ...(body.message.metadata || {}),
        authorId: actor.userId,
        authorLabel: actor.label,
        createdAt: new Date().toISOString(),
      },
    };
    try {
      await persistTripAgentMessage({
        message: userMessage,
        threadId: body.threadId,
        tripId: body.tripId,
        authorId: actor.userId,
        contextRefs: body.contextRefs,
      });
    } catch (error) {
      await refundTripAgentQuota(actor.userId, body.requestId).catch(() => undefined);
      console.error('[trip-agent] user message persistence failed', {
        ...logContext,
        quotaRefunded: true,
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage: boundedErrorMessage(error),
      });
      throw new Error(`TRIP_AGENT_PERSISTENCE_FAILED: ${boundedErrorMessage(error)}`);
    }
    console.info('[trip-agent] chat accepted', {
      ...logContext,
      contextCount: body.contextRefs.length,
      quotaRemaining: quota.remaining,
      durationMs: Date.now() - startedAt,
    });
    return await streamTripAgentResponse({
      actor,
      trip: canonical.trip,
      threadId: body.threadId,
      requestId: body.requestId,
      userMessage,
      contextRefs: body.contextRefs,
      abortSignal: request.signal,
    });
  } catch (error) {
    const failure = classifyTripAgentFailure(error);
    console.error('[trip-agent] request failed', {
      ...logContext,
      code: failure.code,
      status: failure.status,
      durationMs: Date.now() - startedAt,
      errorName: error instanceof Error ? error.name : 'UnknownError',
      errorMessage: boundedErrorMessage(error),
    });
    return errorResponse(error, logContext);
  }
};
