// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  FLOATING_MAP_PREVIEW_STORAGE_KEY,
  readFloatingMapPreviewState,
  writeFloatingMapPreviewState,
} from '../../../components/tripview/floatingMapPreviewState';

describe('components/tripview/floatingMapPreviewState', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('persists and merges floating map preview mode, position, size preset, and orientation', () => {
    const firstWrite = writeFloatingMapPreviewState({
      mode: 'floating',
      position: { x: 120, y: 180 },
      sizePreset: 'lg',
      orientation: 'landscape',
    });
    expect(firstWrite).toBe(true);
    expect(readFloatingMapPreviewState()).toEqual({
      mode: 'floating',
      position: { x: 120, y: 180 },
      sizePreset: 'lg',
      orientation: 'landscape',
    });

    const secondWrite = writeFloatingMapPreviewState({
      mode: 'docked',
    });
    expect(secondWrite).toBe(true);
    expect(readFloatingMapPreviewState()).toEqual({
      mode: 'docked',
      position: { x: 120, y: 180 },
      sizePreset: 'lg',
      orientation: 'landscape',
    });
  });

  it('ignores malformed stored payloads safely', () => {
    window.localStorage.setItem(FLOATING_MAP_PREVIEW_STORAGE_KEY, '{"mode":"broken","position":{"x":"a","y":12}}');
    expect(readFloatingMapPreviewState()).toEqual({});
  });
});
