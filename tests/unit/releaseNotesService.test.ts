import { describe, expect, it } from 'vitest';
import {
  getAllReleaseNotes,
  getLatestInAppRelease,
  getPublishedReleaseNotes,
  getWebsiteVisibleItems,
  groupReleaseItemsByType,
  isReleaseInsideAnnouncementWindow,
} from '../../services/releaseNotesService';

describe('services/releaseNotesService', () => {
  it('loads and sorts release notes by publishedAt desc', () => {
    const notes = getAllReleaseNotes();
    expect(notes.length).toBeGreaterThan(0);

    for (let i = 1; i < notes.length; i += 1) {
      expect(Date.parse(notes[i - 1].publishedAt)).toBeGreaterThanOrEqual(Date.parse(notes[i].publishedAt));
    }
  });

  it('returns only published notes from published accessor', () => {
    const published = getPublishedReleaseNotes();
    expect(published.length).toBeGreaterThan(0);
    expect(published.every((note) => note.status === 'published')).toBe(true);
  });

  it('filters and groups website-visible items', () => {
    const note = getPublishedReleaseNotes()[0];
    const visible = getWebsiteVisibleItems(note);
    expect(visible.every((item) => item.visibleOnWebsite)).toBe(true);

    const grouped = groupReleaseItemsByType(visible);
    const flattened = grouped.flatMap((group) => group.items);
    expect(flattened).toHaveLength(visible.length);
  });

  it('evaluates in-app announcement window correctly', () => {
    const note = getPublishedReleaseNotes()[0];
    const publishedAt = Date.parse(note.publishedAt);

    expect(isReleaseInsideAnnouncementWindow(note, publishedAt + 1)).toBe(true);
    expect(isReleaseInsideAnnouncementWindow(note, publishedAt - 1)).toBe(false);
    expect(isReleaseInsideAnnouncementWindow(note, publishedAt + (note.inAppHours + 1) * 60 * 60 * 1000)).toBe(false);
  });

  it('handles malformed and future release windows safely', () => {
    const malformed = {
      ...getPublishedReleaseNotes()[0],
      publishedAt: 'invalid-date',
    };
    expect(isReleaseInsideAnnouncementWindow(malformed)).toBe(false);

    const future = {
      ...getPublishedReleaseNotes()[0],
      publishedAt: '2099-01-01T00:00:00Z',
    };
    expect(isReleaseInsideAnnouncementWindow(future, Date.parse('2026-01-01T00:00:00Z'))).toBe(false);
  });

  it('returns latest notifiable release only within window', () => {
    const latest = getPublishedReleaseNotes().find((note) => note.notifyInApp);
    if (!latest) {
      expect(getLatestInAppRelease()).toBeNull();
      return;
    }

    const withinWindow = Date.parse(latest.publishedAt) + 60 * 1000;
    expect(getLatestInAppRelease(withinWindow)?.id).toBe(latest.id);

    const outsideWindow = Date.parse(latest.publishedAt) + (latest.inAppHours + 2) * 60 * 60 * 1000;
    expect(getLatestInAppRelease(outsideWindow)).toBeNull();
  });

  it('groups repeated type label/key pairs together', () => {
    const grouped = groupReleaseItemsByType([
      { visibleOnWebsite: true, typeLabel: 'New', typeKey: 'new', text: 'A' },
      { visibleOnWebsite: true, typeLabel: 'New', typeKey: 'new', text: 'B' },
      { visibleOnWebsite: true, typeLabel: 'Fixed', typeKey: 'fixed', text: 'C' },
    ]);

    expect(grouped).toHaveLength(2);
    expect(grouped[0].items).toHaveLength(2);
    expect(grouped[1].items).toHaveLength(1);
  });
});
