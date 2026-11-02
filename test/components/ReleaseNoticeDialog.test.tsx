// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  readLocalStorageItem: vi.fn(),
  writeLocalStorageItem: vi.fn(),
  getLatestInAppRelease: vi.fn(),
}));

vi.mock('../../services/browserStorageService', () => ({
  readLocalStorageItem: mocks.readLocalStorageItem,
  writeLocalStorageItem: mocks.writeLocalStorageItem,
}));

vi.mock('../../services/latestInAppRelease', () => ({
  getLatestInAppRelease: mocks.getLatestInAppRelease,
}));

vi.mock('@/app/navigation', () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    React.createElement('a', { href: to, ...props }, children)
  ),
}));

import { ReleaseNoticeDialog } from '../../components/ReleaseNoticeDialog';

const RELEASE = {
  id: 'release-1',
  version: 'v1.2.3',
  title: 'Smoother trip planning',
  summary: 'A short summary.',
  publishedAt: '2026-10-20T10:00:00Z',
  items: [],
};

describe('components/ReleaseNoticeDialog', () => {
  beforeEach(() => {
    mocks.readLocalStorageItem.mockReturnValue(null);
    mocks.getLatestInAppRelease.mockReturnValue(RELEASE);
  });

  it('renders as a labelled modal dialog with the dismiss action focused', async () => {
    render(<ReleaseNoticeDialog enabled />);

    const dialog = screen.getByRole('dialog', { name: 'Smoother trip planning' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Dismiss' })).toHaveFocus();
    });
  });

  it('dismisses the release on Escape and remembers it', async () => {
    render(<ReleaseNoticeDialog enabled />);
    const dialog = screen.getByRole('dialog');

    fireEvent.keyDown(dialog, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(mocks.writeLocalStorageItem).toHaveBeenCalledWith('tf_release_notice_dismissed_release_id', 'release-1');
  });

  it('stays closed once the release was dismissed', () => {
    mocks.readLocalStorageItem.mockReturnValue('release-1');
    render(<ReleaseNoticeDialog enabled />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
