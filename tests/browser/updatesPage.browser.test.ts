// @vitest-environment jsdom
import { renderWithRouter as render } from '@/tests/helpers/renderWithRouter';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  auth: {
    isAdmin: false,
  },
  locale: 'en',
  getPublishedReleaseNotes: vi.fn(),
  readLocalStorageItem: vi.fn(),
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mocks.auth,
}));

vi.mock('../../components/marketing/MarketingLayout', () => ({
  MarketingLayout: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
}));

vi.mock('../../components/marketing/ReleasePill', () => ({
  // ReleasePill also takes a bare typeKey + label now, so the inline "Internal"
  // badge can go through the same component instead of duplicating its markup.
  ReleasePill: ({ item, label }: { item?: { typeLabel: string }; label?: string }) =>
    React.createElement('span', null, item?.typeLabel ?? label ?? ''),
}));

vi.mock('../../services/releaseNotesService', async () => {
  const actual = await vi.importActual<typeof import('../../services/releaseNotesService')>('../../services/releaseNotesService');
  return {
    ...actual,
    locale: 'en',
  getPublishedReleaseNotes: mocks.getPublishedReleaseNotes,
  };
});

vi.mock('../../services/browserStorageService', () => ({
  readLocalStorageItem: mocks.readLocalStorageItem,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: mocks.locale, language: mocks.locale },
  }),
}));

import { UpdatesPage } from '../../pages/UpdatesPage';

describe('pages/UpdatesPage internal release visibility', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.auth.isAdmin = false;
    mocks.locale = 'en';
    mocks.readLocalStorageItem.mockReturnValue(null);
    mocks.getPublishedReleaseNotes.mockReturnValue([
      {
        id: 'rel-1',
        version: 'v1.0.0',
        title: 'Release title',
        date: '2026-03-01',
        summary: '',
        status: 'published',
        publishedAt: '2026-03-01T10:00:00Z',
        notifyInApp: false,
        inAppHours: 24,
        sourcePath: '../content/updates/rel-1.md',
        items: [
          {
            visibleOnWebsite: true,
            typeLabel: 'Improved',
            typeKey: 'improved',
            text: 'Public item',
          },
          {
            visibleOnWebsite: false,
            typeLabel: 'Internal',
            typeKey: 'internal',
            text: 'Private item',
          },
        ],
      },
    ]);
  });

  it('hydrates route-localized release dates identically despite different server and browser defaults', async () => {
    mocks.locale = 'fr';
    let hostLocale = 'en-US';
    const original = Date.prototype.toLocaleDateString;
    vi.spyOn(Date.prototype, 'toLocaleDateString').mockImplementation(function (this: Date, locale, options) {
      return original.call(this, locale ?? hostLocale, options);
    });
    const container = document.createElement('div');
    container.innerHTML = renderToString(React.createElement(UpdatesPage));
    document.body.appendChild(container);
    hostLocale = 'de-DE';
    const onRecoverableError = vi.fn();
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => { root = hydrateRoot(container, React.createElement(UpdatesPage), { onRecoverableError }); });
      expect(onRecoverableError).not.toHaveBeenCalled();
      expect(container).toHaveTextContent('1 mars 2026');
    } finally {
      await act(async () => root?.unmount());
      container.remove();
    }
  });

  it('hides private release items for non-admin viewers by default', async () => {
    await render(React.createElement(UpdatesPage));

    expect(screen.getByText('Public item')).toBeInTheDocument();
    expect(screen.queryByText('Private item')).toBeNull();
    expect(screen.queryByText('Internal view enabled. Hidden release items are visible.')).toBeNull();
  });

  it('shows private release items for authenticated admins', async () => {
    mocks.auth.isAdmin = true;

    await render(React.createElement(UpdatesPage));

    expect(screen.getByText('Public item')).toBeInTheDocument();
    expect(screen.getByText('Private item')).toBeInTheDocument();
    expect(screen.getByText('Internal view enabled. Hidden release items are visible.')).toBeInTheDocument();
  });
});
