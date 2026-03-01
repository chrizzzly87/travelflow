// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  auth: {
    isAdmin: false,
  },
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
  ReleasePill: ({ item }: { item: { typeLabel: string } }) => React.createElement('span', null, item.typeLabel),
}));

vi.mock('../../services/releaseNotesService', async () => {
  const actual = await vi.importActual<typeof import('../../services/releaseNotesService')>('../../services/releaseNotesService');
  return {
    ...actual,
    getPublishedReleaseNotes: mocks.getPublishedReleaseNotes,
  };
});

vi.mock('../../services/browserStorageService', () => ({
  readLocalStorageItem: mocks.readLocalStorageItem,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

import { UpdatesPage } from '../../pages/UpdatesPage';

describe('pages/UpdatesPage internal release visibility', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.auth.isAdmin = false;
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

  it('hides private release items for non-admin viewers by default', () => {
    render(React.createElement(UpdatesPage));

    expect(screen.getByText('Public item')).toBeInTheDocument();
    expect(screen.queryByText('Private item')).toBeNull();
    expect(screen.queryByText('Internal view enabled. Hidden release items are visible.')).toBeNull();
  });

  it('shows private release items for authenticated admins', () => {
    mocks.auth.isAdmin = true;

    render(React.createElement(UpdatesPage));

    expect(screen.getByText('Public item')).toBeInTheDocument();
    expect(screen.getByText('Private item')).toBeInTheDocument();
    expect(screen.getByText('Internal view enabled. Hidden release items are visible.')).toBeInTheDocument();
  });
});
