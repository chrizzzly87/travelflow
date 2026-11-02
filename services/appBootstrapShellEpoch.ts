/**
 * Keeps the bootstrap shell's animations continuous while React remounts it.
 *
 * A single navigation renders the shell several times in a row, each time as a
 * fresh element at a different place in the tree: the route-level Suspense
 * fallback, then the route component's own loading branch, then the inner
 * Suspense fallback for the lazy page. Measured on a trip route, that is three
 * separate DOM nodes inside 43ms. React cannot reuse the DOM across those
 * positions, so every CSS animation on the shell restarts from zero and the
 * placeholder visibly flashes two or three times before the page arrives.
 *
 * The shell therefore reports how long the current *loading episode* has been
 * running and offsets its animations by that much, so a remount picks the
 * animation up where the previous node left it instead of replaying it.
 *
 * An episode ends once no shell has been mounted for EPISODE_GAP_MS, which is
 * long enough to cover a handoff between two boundaries and short enough that
 * the next navigation gets its own entrance.
 */

const EPISODE_GAP_MS = 400;

let episodeStartedAt: number | null = null;
let mountedCount = 0;
let releaseTimer: ReturnType<typeof setTimeout> | undefined;

/** Milliseconds since navigation start; the same clock the shell's CSS uses. */
export const readDocumentTimeMs = (): number => (
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : 0
);

/** How long the current loading episode has been on screen, in milliseconds. */
export const readShellEpochMs = (): number => (
  episodeStartedAt === null ? 0 : Math.max(0, readDocumentTimeMs() - episodeStartedAt)
);

export const registerShellMounted = (): void => {
  if (releaseTimer !== undefined) {
    clearTimeout(releaseTimer);
    releaseTimer = undefined;
  }
  if (episodeStartedAt === null) episodeStartedAt = readDocumentTimeMs();
  mountedCount += 1;
};

export const registerShellUnmounted = (): void => {
  mountedCount = Math.max(0, mountedCount - 1);
  // Another boundary may still be holding a shell; only the last one out ends
  // the episode, and even then not immediately — the next mount is usually a
  // few milliseconds away.
  if (mountedCount > 0) return;
  if (releaseTimer !== undefined) clearTimeout(releaseTimer);
  releaseTimer = setTimeout(() => {
    episodeStartedAt = null;
    releaseTimer = undefined;
  }, EPISODE_GAP_MS);
};

export const resetShellEpochForTests = (): void => {
  if (releaseTimer !== undefined) clearTimeout(releaseTimer);
  releaseTimer = undefined;
  episodeStartedAt = null;
  mountedCount = 0;
};
