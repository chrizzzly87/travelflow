import { describe, expect, it } from 'vitest';

import {
  buildTripWorkspaceSearch,
  readTripWorkspacePresentation,
} from '../../components/tripview/tripWorkspacePresentation';

describe('trip workspace presentation URL state', () => {
  it('keeps the established planner as the default', () => {
    expect(readTripWorkspacePresentation('')).toBe('classic');
    expect(readTripWorkspacePresentation('?workspace=unknown')).toBe('classic');
  });

  it('recognizes additive modular workspace views', () => {
    expect(readTripWorkspacePresentation('?workspace=overview')).toBe('overview');
    expect(readTripWorkspacePresentation('?workspace=schedule')).toBe('schedule');
  });

  it('updates only the workspace parameter', () => {
    expect(buildTripWorkspaceSearch('?mode=print&foo=bar', 'schedule')).toBe('?mode=print&foo=bar&workspace=schedule');
    expect(buildTripWorkspaceSearch('?foo=bar&workspace=schedule', 'overview')).toBe('?foo=bar&workspace=overview');
    expect(buildTripWorkspaceSearch('?foo=bar&workspace=schedule', 'classic')).toBe('?foo=bar');
  });
});
