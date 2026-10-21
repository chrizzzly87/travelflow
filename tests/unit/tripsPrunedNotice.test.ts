// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import React from 'react';
import { useTripsPrunedNoticeBootstrap } from '../../app/bootstrap/useTripsPrunedNoticeBootstrap';
import { TRIPS_PRUNED_EVENT } from '../../services/storageService';

/**
 * The pruned-storage toast used a single key holding an ICU plural block. With
 * `i18next-icu` unregistered, that reached the user as raw `{count, plural, …}`
 * source. The copy now uses i18next native plural suffix keys, so the hook
 * passes `count` and i18next resolves the CLDR category via Intl.PluralRules.
 *
 * Which form each locale actually renders is covered by
 * tests/unit/storageNoticePlurals.test.ts against the real locale files.
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
  it('passes count to the base key so i18next can pick the plural form', () => {
    render(React.createElement(Harness));
    emitPruned(1);

    expect(showAppToastMock).toHaveBeenCalledTimes(1);
    expect(showAppToastMock.mock.calls[0][0].description).toBe(
      'storageNotice.tripsPrunedDescription|{"count":1}',
    );
  });

  it('passes the real count through for several pruned trips', () => {
    render(React.createElement(Harness));
    emitPruned(4);

    expect(showAppToastMock.mock.calls[0][0].description).toBe(
      'storageNotice.tripsPrunedDescription|{"count":4}',
    );
  });

  it('does not hand-pick a plural variant in the caller', () => {
    render(React.createElement(Harness));
    emitPruned(3);

    const description = showAppToastMock.mock.calls[0][0].description as string;
    expect(description).not.toMatch(/tripsPrunedDescription(One|Many|_)/);
  });

  it('stays quiet when nothing was pruned', () => {
    render(React.createElement(Harness));
    emitPruned(0);

    expect(showAppToastMock).not.toHaveBeenCalled();
  });
});
