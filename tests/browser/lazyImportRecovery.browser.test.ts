// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  trackEvent: vi.fn(),
}));

vi.mock('../../services/analyticsService', () => ({
  trackEvent: mocks.trackEvent,
}));

import { isRecoverableLazyImportError } from '../../services/lazyImportRecovery';

describe('services/lazyImportRecovery', () => {
  beforeEach(() => {
    sessionStorage.clear();
    mocks.trackEvent.mockReset();
  });

  it('treats MIME type lazy-import failures as recoverable', () => {
    expect(
      isRecoverableLazyImportError(new TypeError("'text/html' is not a valid JavaScript MIME type."))
    ).toBe(true);
  });
});
