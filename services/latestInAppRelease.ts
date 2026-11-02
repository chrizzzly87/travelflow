/**
 * The single release the in-app notice may show, without the release history.
 *
 * `releaseNotesService.ts` bundles every file in `content/updates/` through an
 * eager `import.meta.glob` — 204 notes, a 444 KB chunk. The trip view renders
 * `ReleaseNoticeDialog` on every visit, so opening a trip used to download the
 * whole history to decide whether one notice was due.
 *
 * The JSON is emitted by `scripts/generate-latest-in-app-release.mjs`;
 * `tests/unit/latestInAppRelease.test.ts` fails if it drifts from what the full
 * service resolves.
 */
import latestInAppReleaseJson from '../data/latestInAppRelease.generated.json';
import { isReleaseInsideAnnouncementWindow, type ReleaseNote } from './releaseNotesFormat';

const LATEST_NOTIFIABLE_RELEASE =
  (latestInAppReleaseJson as { release?: ReleaseNote | null }).release ?? null;

/**
 * The release to announce in-app right now, or null when there is none and when
 * the newest one has aged out of its announcement window.
 */
export const getLatestInAppRelease = (now = Date.now()): ReleaseNote | null => {
  if (!LATEST_NOTIFIABLE_RELEASE) return null;
  if (!isReleaseInsideAnnouncementWindow(LATEST_NOTIFIABLE_RELEASE, now)) return null;
  return LATEST_NOTIFIABLE_RELEASE;
};
