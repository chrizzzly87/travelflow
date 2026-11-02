// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  publish: vi.fn(),
  setCurrent: vi.fn(),
  confirm: vi.fn(async () => true),
  trackEvent: vi.fn(),
}));

vi.mock('../../../components/admin/AdminShell', () => ({
  AdminShell: ({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) => (
    React.createElement('section', null, React.createElement('h1', null, title), actions, children)
  ),
}));
vi.mock('../../../components/AppDialogProvider', () => ({
  useAppDialog: () => ({ confirm: mocks.confirm, prompt: vi.fn() }),
}));
vi.mock('../../../services/analyticsService', () => ({
  trackEvent: mocks.trackEvent,
  getAnalyticsDebugAttributes: () => ({}),
}));
vi.mock('../../../services/adminService', () => ({
  adminListTermsVersions: mocks.list,
  adminPublishTermsVersion: mocks.publish,
  adminSetCurrentTermsVersion: mocks.setCurrent,
}));

import { AdminLegalTermsPage } from '../../../pages/AdminLegalTermsPage';

const version = (overrides: Record<string, unknown>) => ({
  version: '2026-03-03',
  title: 'AGB',
  summary: 'First version',
  bindingLocale: 'de',
  lastUpdated: '2026-03-03',
  effectiveAt: '2026-03-03T10:00:00Z',
  requiresReaccept: true,
  isCurrent: false,
  contentDe: '# AGB',
  contentEn: '# Terms',
  createdAt: '2026-03-03T10:00:00Z',
  createdBy: null,
  ...overrides,
});

describe('AdminLegalTermsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue([
      version({ version: '2026-04-01', isCurrent: true, requiresReaccept: false, contentDe: '# AGB live' }),
      version({}),
    ]);
    mocks.publish.mockImplementation(async (input: { version: string; requiresReaccept: boolean }) => (
      version({ version: input.version, requiresReaccept: input.requiresReaccept, isCurrent: true })
    ));
    mocks.setCurrent.mockImplementation(async (id: string, options: { requiresReaccept: boolean }) => (
      version({ version: id, requiresReaccept: options.requiresReaccept, isCurrent: true })
    ));
  });

  it('lays the page out as draft, edit, rollout and publish, with history below', async () => {
    render(React.createElement(AdminLegalTermsPage));

    expect(await screen.findByRole('region', { name: 'Live terms' })).toHaveTextContent('2026-04-01');
    expect(screen.getByText(/Started from 2026-04-01 \(live\)/)).toBeTruthy();
    const headings = screen.getAllByRole('heading').map((heading) => heading.textContent);
    expect(headings.indexOf('1. Edit the text')).toBeLessThan(headings.indexOf('3. Choose the rollout and publish'));
    expect(headings.indexOf('3. Choose the rollout and publish')).toBeLessThan(headings.indexOf('Version history'));
    expect((screen.getByLabelText('German binding text') as HTMLTextAreaElement).value).toBe('# AGB live');
    // New drafts default to the stricter rollout.
    expect((screen.getByRole('radio', { name: /Require re-acceptance/ }) as HTMLInputElement).checked).toBe(true);
  });

  it('confirms before publishing and publishes the version it showed', async () => {
    const user = userEvent.setup();
    render(React.createElement(AdminLegalTermsPage));
    await screen.findByRole('region', { name: 'Live terms' });

    await user.click(screen.getByRole('radio', { name: /Inform only/ }));
    const shown = screen.getByText(/^Publishes /).textContent || '';
    await user.click(screen.getByRole('button', { name: 'Publish version' }));

    expect(mocks.confirm).toHaveBeenCalledWith(expect.objectContaining({ tone: 'default', confirmLabel: 'Publish' }));
    await waitFor(() => expect(mocks.publish).toHaveBeenCalledTimes(1));
    const input = mocks.publish.mock.calls[0][0];
    expect(input.requiresReaccept).toBe(false);
    expect(shown).toContain(input.version);
  });

  it('does nothing when the publish confirmation is cancelled', async () => {
    mocks.confirm.mockResolvedValueOnce(false);
    const user = userEvent.setup();
    render(React.createElement(AdminLegalTermsPage));
    await screen.findByRole('region', { name: 'Live terms' });

    await user.click(screen.getByRole('button', { name: 'Publish version' }));
    expect(mocks.confirm).toHaveBeenCalledWith(expect.objectContaining({ tone: 'danger' }));
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('keeps "make current" reachable from a history row menu', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(React.createElement(AdminLegalTermsPage));
    await screen.findByRole('region', { name: 'Live terms' });

    await user.click(screen.getByRole('button', { name: 'Open actions for version 2026-03-03' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Make current, inform only' }));

    await waitFor(() => expect(mocks.setCurrent).toHaveBeenCalledWith('2026-03-03', { requiresReaccept: false }));
  });

  it('asks before an edited draft is replaced by another version', async () => {
    mocks.confirm.mockResolvedValueOnce(false);
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(React.createElement(AdminLegalTermsPage));
    const editor = await screen.findByLabelText('German binding text');

    await user.type(editor, ' edited');
    expect(screen.getByRole('button', { name: 'Discard edits' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Open actions for version 2026-03-03' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Start a draft from this version' }));

    expect(mocks.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Discard your edits?' }));
    expect((screen.getByLabelText('German binding text') as HTMLTextAreaElement).value).toBe('# AGB live edited');
  });
});
