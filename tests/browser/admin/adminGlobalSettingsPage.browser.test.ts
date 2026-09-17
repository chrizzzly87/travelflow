// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({
  refreshPublicAiRuntimeSettings: vi.fn(),
  updateAppRuntimeSettings: vi.fn(),
}));

vi.mock('../../../components/admin/AdminShell', () => ({
  AdminShell: ({ title, actions, children }: {
    title: string;
    actions?: React.ReactNode;
    children: React.ReactNode;
  }) => React.createElement('section', null,
    React.createElement('h1', null, title),
    actions,
    children),
}));

vi.mock('../../../services/aiRuntimeSettingsService', async () => {
  const actual = await vi.importActual<typeof import('../../../services/aiRuntimeSettingsService')>(
    '../../../services/aiRuntimeSettingsService',
  );
  return {
    ...actual,
    refreshPublicAiRuntimeSettings: mocks.refreshPublicAiRuntimeSettings,
    updateAppRuntimeSettings: mocks.updateAppRuntimeSettings,
  };
});

const settings = {
  defaultModelId: 'openrouter:google/gemini-3.8-flash',
  approvedOpenRouterModels: ['google/gemini-3.8-flash'],
  modelMaxAgeMonths: 3,
  showOlderModels: false,
  tripAgentEnabled: true,
  tripAgentAdminPreview: true,
  mapDefaultStyle: 'standard' as const,
  mapRuntimePreset: 'google_all' as const,
  plannerBetaOpen: true,
  updatedAt: '2026-09-08T10:01:07Z',
};

const renderPage = async () => {
  const { AdminGlobalSettingsPage } = await import('../../../pages/AdminGlobalSettingsPage');
  const result = render(React.createElement(AdminGlobalSettingsPage));
  await screen.findByRole('heading', { level: 2, name: 'Trip Agent' });
  return result;
};

describe('AdminGlobalSettingsPage', () => {
  beforeEach(() => {
    mocks.refreshPublicAiRuntimeSettings.mockResolvedValue(settings);
    mocks.updateAppRuntimeSettings.mockResolvedValue(settings);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('puts each product area on its own card', async () => {
    const { container } = await renderPage();

    const titles = Array.from(container.querySelectorAll('[data-slot="settings-card"] h2'))
      .map((heading) => heading.textContent);
    expect(titles).toEqual(['Trip Agent', 'Planner', 'AI model', 'Map']);
  });

  it('names the chat switches after the chat they gate', async () => {
    await renderPage();
    expect(screen.getByRole('switch', { name: 'Open to everyone' })).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Administrator preview' })).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Planner beta' })).toBeTruthy();
  });

  it('keeps the save disabled until something actually changes', async () => {
    await renderPage();
    const save = screen.getByRole('button', { name: 'Save changes' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    await userEvent.click(screen.getByRole('switch', { name: 'Open to everyone' }));
    await waitFor(() => expect(save.disabled).toBe(false));
  });

  it('offers a discard that puts the loaded values back', async () => {
    await renderPage();
    const save = screen.getByRole('button', { name: 'Save changes' }) as HTMLButtonElement;
    expect(screen.queryByRole('button', { name: 'Discard' })).toBeNull();

    await userEvent.click(screen.getByRole('switch', { name: 'Planner beta' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Discard' }));

    await waitFor(() => expect(save.disabled).toBe(true));
    expect(mocks.updateAppRuntimeSettings).not.toHaveBeenCalled();
  });

  it('sends only the settings it was given, with the toggled value', async () => {
    await renderPage();
    await userEvent.click(screen.getByRole('switch', { name: 'Planner beta' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(mocks.updateAppRuntimeSettings).toHaveBeenCalledTimes(1));
    expect(mocks.updateAppRuntimeSettings.mock.calls[0][0]).toMatchObject({
      plannerBetaOpen: false,
      tripAgentEnabled: true,
      mapRuntimePreset: 'google_all',
    });
  });

  it('picks a model through the searchable dialog instead of a text field', async () => {
    await renderPage();
    // The stored default is shown on the trigger, not in an editable input.
    expect(screen.queryByDisplayValue('openrouter:google/gemini-3.8-flash')).toBeNull();

    await userEvent.click(screen.getByText('openrouter:google/gemini-3.8-flash'));
    const search = await screen.findByPlaceholderText('Search a provider or model…');
    await userEvent.type(search, 'claude');

    const results = await screen.findAllByRole('button');
    const claude = results.find((button) => /claude/i.test(button.textContent || ''));
    expect(claude).toBeTruthy();
  });
});
