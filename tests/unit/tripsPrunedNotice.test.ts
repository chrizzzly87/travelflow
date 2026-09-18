// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import React from 'react';
import { useTripsPrunedNoticeBootstrap } from '../../app/bootstrap/useTripsPrunedNoticeBootstrap';
import { TRIPS_PRUNED_EVENT } from '../../services/storageService';

/**
 * The pruned-storage toast used a single key holding an ICU plural block. With
 * `i18next-icu` unregistered, that reached the user as raw `{count, plural, …}`
 * source. The copy now lives in explicit `*One` / `*Many` keys, and the hook
 * picks the variant itself.
 */
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}|${JSON.stringify(options)}` : key,
    i18n: { language: 'en' },
  }),
}));

const showAppToastMock = vi.fn();
vi.mock('../../components/ui/appToast', () => ({
  showAppToast: (...args: unknown[]) => showAppToastMock(...args),
}));

const Harness = () => {
  useTripsPrunedNoticeBootstrap();
  return null;
};

const emitPruned = (prunedCount: number) => {
  window.dispatchEvent(new CustomEvent(TRIPS_PRUNED_EVENT, { detail: { prunedCount } }));
};

// Vitest is not configured with automatic RTL cleanup in this repo.
afterEach(() => {
  cleanup();
  showAppToastMock.mockReset();
});

describe('useTripsPrunedNoticeBootstrap', () => {
  it('uses the singular key when exactly one trip was pruned', () => {
    render(React.createElement(Harness));
    emitPruned(1);

    expect(showAppToastMock).toHaveBeenCalledTimes(1);
    expect(showAppToastMock.mock.calls[0][0].description).toBe(
      'storageNotice.tripsPrunedDescriptionOne|{"count":1}',
    );
  });

  it('uses the plural key when several trips were pruned', () => {
    render(React.createElement(Harness));
    emitPruned(4);

    expect(showAppToastMock.mock.calls[0][0].description).toBe(
      'storageNotice.tripsPrunedDescriptionMany|{"count":4}',
    );
  });

  it('never references the removed ICU plural key', () => {
    render(React.createElement(Harness));
    emitPruned(3);

    expect(showAppToastMock.mock.calls[0][0].description).not.toContain(
      'storageNotice.tripsPrunedDescription|',
    );
  });

  it('stays quiet when nothing was pruned', () => {
    render(React.createElement(Harness));
    emitPruned(0);

    expect(showAppToastMock).not.toHaveBeenCalled();
  });
});
