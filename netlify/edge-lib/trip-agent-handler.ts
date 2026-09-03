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

const errorResponse = (error: unknown): Response => {
  const message = error instanceof Error ? error.message : 'Unknown Trip Agent error.';
  if (message.includes('AUTH') || message.includes('REGISTERED_ACCOUNT')) return json(401, { code: message, error: 'Create an account to plan with AI.' });
  if (message.includes('EDIT_ACCESS')) return json(403, { code: message, error: 'Edit access is required.' });
  if (message.includes('DISABLED')) return json(403, { code: message, error: 'Trip Agent is not enabled for this account yet.' });
  if (message.includes('STALE')) return json(409, { code: message, error: 'This proposal is based on an older trip version.' });
  if (message.includes('NOT_PENDING')) return json(409, { code: message, error: 'This proposal is no longer pending.' });
  if (message.includes('MODEL_NOT_CONFIGURED')) return json(503, { code: message, error: 'Trip Agent model access is not configured.' });
  return json(400, { code: 'TRIP_AGENT_REQUEST_FAILED', error: message.slice(0, 500) });
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
  try {
    const actor = await authenticate(request);

    if (request.method === 'GET') {
      const url = new URL(request.url);
      const tripId = tripIdSchema.parse(url.searchParams.get('tripId'));
      const requestedThreadId = url.searchParams.get('threadId');
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
    await persistTripAgentMessage({
      message: userMessage,
      threadId: body.threadId,
      tripId: body.tripId,
      authorId: actor.userId,
      contextRefs: body.contextRefs,
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
    return errorResponse(error);
  }
};
