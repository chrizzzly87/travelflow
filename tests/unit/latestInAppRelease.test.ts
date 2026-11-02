import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

import { getLatestInAppRelease as getLatestFromSlimTable } from '../../services/latestInAppRelease';
import {
  getLatestInAppRelease as getLatestFromFullCorpus,
  getPublishedReleaseNotes,
} from '../../services/releaseNotesService';
import { renderLatestInAppRelease } from '../../scripts/generate-latest-in-app-release.mjs';

const generatedPath = path.resolve(__dirname, '../../data/latestInAppRelease.generated.json');

describe('latest in-app release', () => {
  it('stays in sync with content/updates', () => {
    // Regenerating must be a no-op: a stale file means the trip view announces
    // the wrong release, or keeps announcing one that has been superseded.
    expect(fs.readFileSync(generatedPath, 'utf8')).toBe(renderLatestInAppRelease());
  });

  it('resolves the same release the full corpus resolves', () => {
    const newest = getPublishedReleaseNotes().find((note) => note.notifyInApp);
    expect(newest).toBeTruthy();

    // Inside the announcement window both must return that release...
    const insideWindow = Date.parse(newest!.publishedAt) + 60_000;
    expect(getLatestFromSlimTable(insideWindow)).toEqual(getLatestFromFullCorpus(insideWindow));
    expect(getLatestFromSlimTable(insideWindow)?.id).toBe(newest!.id);

    // ...and outside it, both must return nothing.
    const afterWindow = Date.parse(newest!.publishedAt) + (newest!.inAppHours + 1) * 60 * 60 * 1000;
    expect(getLatestFromSlimTable(afterWindow)).toBeNull();
    expect(getLatestFromFullCorpus(afterWindow)).toBeNull();

    // A release that has not been published yet is never announced.
    const beforePublish = Date.parse(newest!.publishedAt) - 60_000;
    expect(getLatestFromSlimTable(beforePublish)).toBeNull();
  });

  it('carries only the one release, not the history', () => {
    const generated = JSON.parse(fs.readFileSync(generatedPath, 'utf8'));
    expect(Object.keys(generated)).toEqual(['_generated', 'release']);
    expect(Array.isArray(generated.release)).toBe(false);
  });
});
