/**
 * Holds a trip card's map preview steady while the trip is still being edited.
 *
 * A preview URL is a content address: change a city, a colour or a transport
 * mode and the URL changes, which is what makes the CDN copy correct. It also
 * means a trip that is being worked on produces a new picture for every state
 * anyone looks at, and each unrendered state costs a static render plus up to
 * eight Directions calls.
 *
 * So the card does not follow the trip immediately. It keeps showing the
 * preview it already knows until the trip has been quiet for
 * `TRIP_MAP_PREVIEW_SETTLE_MS`, then adopts the new one. A burst of edits
 * collapses into a single render of where the trip landed instead of one
 * render per intermediate state.
 *
 * The trade is deliberate: for a few minutes after an edit, the thumbnail on
 * the card can be one state behind. The trip's own map is live and unaffected;
 * this is the card image only.
 *
 * The record is per device, because holding a preview back requires knowing
 * the previous one, and only a viewer who has already seen this trip knows it.
 * Somebody opening the trip for the first time renders the current state —
 * there is nothing else they could show.
 */

const STORAGE_KEY = 'tf_trip_map_preview_settle_v1';

/** How long a trip must go unchanged before its card adopts the new picture. */
export const TRIP_MAP_PREVIEW_SETTLE_MS = 5 * 60 * 1000;

/** Bound on remembered trips; the oldest-seen entries are dropped first. */
const MAX_ENTRIES = 200;

interface SettleEntry {
  /** The preview URL this device is currently showing for the trip. */
  url: string;
  /** `trip.updatedAt` at the time that URL was adopted. */
  adoptedForUpdatedAt: number;
  /** Last time the entry was read or written, used to evict cold trips. */
  lastSeenAt: number;
}

type SettleStore = Record<string, SettleEntry>;

const isSettleEntry = (value: unknown): value is SettleEntry => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SettleEntry>;
  return typeof candidate.url === 'string'
    && candidate.url.length > 0
    && Number.isFinite(candidate.adoptedForUpdatedAt)
    && Number.isFinite(candidate.lastSeenAt);
};

const readStore = (): SettleStore => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return Object.entries(parsed as Record<string, unknown>).reduce<SettleStore>((store, [tripId, entry]) => {
      if (isSettleEntry(entry)) store[tripId] = entry;
      return store;
    }, {});
  } catch {
    // Private mode, blocked storage, corrupted JSON: fall back to "no memory",
    // which renders the current state rather than failing the card.
    return {};
  }
};

const writeStore = (store: SettleStore): void => {
  if (typeof window === 'undefined') return;
  try {
    const entries = Object.entries(store);
    const bounded = entries.length <= MAX_ENTRIES
      ? entries
      : entries
        .sort(([, a], [, b]) => b.lastSeenAt - a.lastSeenAt)
        .slice(0, MAX_ENTRIES);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(bounded)));
  } catch {
    // A full or blocked quota costs the settle memory, not the preview.
  }
};

export interface SettleTripMapPreviewInput {
  tripId: string;
  /** `trip.updatedAt` — the shared timestamp of the trip's last change. */
  updatedAt: number;
  /** The preview URL for the trip as it stands right now. */
  freshUrl: string | null;
  now?: number;
  settleMs?: number;
}

export interface SettleTripMapPreviewResult {
  /** The URL the card should load. */
  url: string | null;
  /** True when a newer picture exists but is being held back. */
  isHeldBack: boolean;
}

/**
 * Decides which preview URL a card shows, and remembers the decision.
 *
 * Pure apart from the storage read/write, and both the clock and the window
 * are injectable so the rule can be tested without waiting five minutes.
 */
export const resolveSettledTripMapPreviewUrl = (
  input: SettleTripMapPreviewInput,
): SettleTripMapPreviewResult => {
  const { tripId, updatedAt, freshUrl } = input;
  const now = input.now ?? Date.now();
  const settleMs = input.settleMs ?? TRIP_MAP_PREVIEW_SETTLE_MS;

  if (!freshUrl || !tripId) return { url: freshUrl, isHeldBack: false };

  const store = readStore();
  const existing = store[tripId];

  const adopt = (): SettleTripMapPreviewResult => {
    store[tripId] = {
      url: freshUrl,
      adoptedForUpdatedAt: Number.isFinite(updatedAt) ? updatedAt : now,
      lastSeenAt: now,
    };
    writeStore(store);
    return { url: freshUrl, isHeldBack: false };
  };

  // Never seen here: there is no older picture to hold on to.
  if (!existing) return adopt();

  // Unchanged: the common path, and the one the CDN cache is built for.
  if (existing.url === freshUrl) {
    store[tripId] = { ...existing, lastSeenAt: now };
    writeStore(store);
    return { url: existing.url, isHeldBack: false };
  }

  // A trip edited before this device last looked has already settled; holding
  // it back would only show a picture that is stale by more than the window.
  const quietFor = Number.isFinite(updatedAt) ? now - updatedAt : Number.POSITIVE_INFINITY;
  if (quietFor >= settleMs) return adopt();

  store[tripId] = { ...existing, lastSeenAt: now };
  writeStore(store);
  return { url: existing.url, isHeldBack: true };
};

/** Drops the remembered preview for a trip (used when a trip is deleted). */
export const forgetSettledTripMapPreview = (tripId: string): void => {
  const store = readStore();
  if (!store[tripId]) return;
  delete store[tripId];
  writeStore(store);
};
