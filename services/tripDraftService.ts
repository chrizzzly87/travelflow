/**
 * Client side of external trip drafts (docs/EXTERNAL_TRIP_DRAFTS.md): read a
 * draft, paste one in, and record a save into the traveller's account.
 */
import type { ITrip } from '../types';
import { generateTripId } from '../utils';
import { resolveTripExpiryFromEntitlements } from '../config/productLimits';
import { isTripDraftId } from '../shared/tripDrafts';
import { supabase } from './supabaseClient';

export type TripDraftStatus = 'draft' | 'claimed' | 'expired';

export interface TripDraftView {
    draftId: string;
    url: string;
    title: string;
    startDate: string | null;
    status: TripDraftStatus;
    source: string;
    clientName: string | null;
    clientModel: string | null;
    claimCount: number;
    expiresAt: string | null;
    createdAt: string;
    trip: ITrip;
}

export class TripDraftRequestError extends Error {
    constructor(public readonly code: string, message: string, public readonly errors: string[] = []) {
        super(message);
        this.name = 'TripDraftRequestError';
    }
}

const readJson = async (response: Response): Promise<Record<string, unknown>> => {
    try {
        const value = await response.json();
        return value && typeof value === 'object' ? value as Record<string, unknown> : {};
    } catch {
        return {};
    }
};

const toRequestError = (response: Response, body: Record<string, unknown>): TripDraftRequestError => new TripDraftRequestError(
    typeof body.code === 'string' ? body.code : `http_${response.status}`,
    typeof body.message === 'string' ? body.message : `Request failed with status ${response.status}.`,
    Array.isArray(body.errors) ? body.errors.filter((entry): entry is string => typeof entry === 'string') : [],
);

/** Reads a draft for the viewer. Counts as a view unless it is only a preload. */
export const fetchTripDraft = async (draftId: string, signal?: AbortSignal, options: { countView?: boolean } = {}): Promise<TripDraftView | null> => {
    if (!isTripDraftId(draftId)) return null;
    const query = options.countView === false ? '' : '?view=1';
    const response = await fetch(`/api/trip-drafts/${draftId}${query}`, { signal, headers: { Accept: 'application/json' } });
    if (response.status === 404) return null;
    const body = await readJson(response);
    if (!response.ok || body.ok !== true || !body.trip || typeof body.trip !== 'object') throw toRequestError(response, body);
    return body as unknown as TripDraftView;
};

export interface PastedTripDraftResult {
    draftId: string;
    url: string;
}

/** Sends JSON an assistant printed (pasted by the traveller) to the draft API. */
export const createTripDraftFromText = async (text: string, signal?: AbortSignal): Promise<PastedTripDraftResult> => {
    let parsed: unknown;
    try {
        parsed = JSON.parse(extractJsonBlock(text));
    } catch {
        throw new TripDraftRequestError('invalid_json', 'invalid_json');
    }
    const response = await fetch('/api/trip-drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-TravelFlow-Draft-Source': 'paste' },
        body: JSON.stringify(parsed),
        signal,
    });
    const body = await readJson(response);
    if (!response.ok || body.ok !== true || typeof body.draftId !== 'string') throw toRequestError(response, body);
    return { draftId: body.draftId, url: String(body.url || '') };
};

/**
 * Assistants usually wrap JSON in a ```json fence and a sentence or two. Take
 * the fenced block when there is one, otherwise the outermost braces.
 */
export const extractJsonBlock = (text: string): string => {
    const fenced = text.match(/```(?:json)?\s*\n([\s\S]*?)```/i);
    if (fenced) return fenced[1].trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    return start >= 0 && end > start ? text.slice(start, end + 1) : text.trim();
};

/** The traveller's own copy of a draft: a fresh trip that remembers where it came from. */
export const buildTripFromDraft = (
    draft: Pick<TripDraftView, 'draftId' | 'trip'>,
    options: { now?: number; tripExpirationDays?: number | null } = {},
): ITrip => {
    const now = options.now ?? Date.now();
    return {
        ...draft.trip,
        id: generateTripId(),
        createdAt: now,
        updatedAt: now,
        isFavorite: false,
        isExample: false,
        status: 'active',
        tripExpiresAt: resolveTripExpiryFromEntitlements(now, undefined, options.tripExpirationDays),
        sourceKind: 'external_draft',
        sourceTemplateId: draft.draftId,
        exampleTemplateId: undefined,
        exampleTemplateCountries: undefined,
    };
};

/** The trip this account already saved from the draft, so a second save opens it instead of duplicating. */
export const findMyTripDraftClaim = async (draftId: string): Promise<string | null> => {
    if (!supabase) return null;
    const { data, error } = await supabase.rpc('get_my_trip_draft_claim', { p_draft_id: draftId });
    if (error) throw new TripDraftRequestError('claim_lookup_failed', error.message || 'claim_lookup_failed');
    const row = Array.isArray(data) ? data[0] : data;
    return row && typeof row.trip_id === 'string' ? row.trip_id : null;
};

export type TripDraftClaimCode = 'claimed' | 'already_claimed' | 'not_authenticated' | 'account_required' | 'draft_not_found' | 'trip_not_found' | 'unavailable';

/** Links a saved trip to its draft for conversion tracking. Never blocks the save itself. */
export const recordTripDraftClaim = async (draftId: string, tripId: string): Promise<{ code: TripDraftClaimCode; tripId: string | null }> => {
    if (!supabase) return { code: 'unavailable', tripId: null };
    const { data, error } = await supabase.rpc('claim_trip_draft', { p_draft_id: draftId, p_trip_id: tripId });
    if (error) return { code: 'unavailable', tripId: null };
    const row = Array.isArray(data) ? data[0] : data;
    return {
        code: (typeof row?.code === 'string' ? row.code : 'unavailable') as TripDraftClaimCode,
        tripId: typeof row?.trip_id === 'string' ? row.trip_id : null,
    };
};
