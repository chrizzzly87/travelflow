// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({
  trackEvent: vi.fn(),
  showAppToast: vi.fn(() => 'toast-id'),
  confirmDialog: vi.fn(async () => true),
  promptDialog: vi.fn(async () => 'https://example.com'),
}));

vi.mock('../../../components/admin/AdminShell', () => ({
  AdminShell: ({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) => (
    React.createElement(
      'div',
      null,
      React.createElement('h1', null, title),
      description ? React.createElement('p', null, description) : null,
      children,
    )
  ),
}));

vi.mock('../../../services/analyticsService', () => ({
  trackEvent: mocks.trackEvent,
  getAnalyticsDebugAttributes: () => ({}),
}));

vi.mock('../../../components/ui/appToast', () => ({
  showAppToast: mocks.showAppToast,
}));

vi.mock('../../../components/AppDialogProvider', () => ({
  useAppDialog: () => ({
    confirm: mocks.confirmDialog,
    prompt: mocks.promptDialog,
  }),
}));

import { AdminDesignSystemPlaygroundPage } from '../../../pages/AdminDesignSystemPlaygroundPage';

describe('pages/AdminDesignSystemPlaygroundPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tracks open and component-group view events', async () => {
    const user = userEvent.setup();

    render(React.createElement(AdminDesignSystemPlaygroundPage));

    expect(mocks.trackEvent).toHaveBeenCalledWith('admin__design_playground--open');
    expect(mocks.trackEvent).toHaveBeenCalledWith('admin__design_playground_component_group--view', {
      group_id: 'buttons',
    });

    await user.click(screen.getByRole('tab', { name: 'Inputs + Textareas' }));

    await waitFor(() => {
      expect(mocks.trackEvent).toHaveBeenCalledWith('admin__design_playground_component_group--view', {
        group_id: 'inputs',
      });
    });

    await user.click(screen.getByRole('tab', { name: 'Country Select + Calendar' }));

    await waitFor(() => {
      expect(mocks.trackEvent).toHaveBeenCalledWith('admin__design_playground_component_group--view', {
        group_id: 'travel_inputs',
      });
    });
  });

  it('triggers the selected notification scenario through showAppToast', async () => {
    const user = userEvent.setup();

    render(React.createElement(AdminDesignSystemPlaygroundPage));

    const triggerButtons = screen.getAllByRole('button', { name: 'Trigger toast' });
    await user.click(triggerButtons[0]);

    expect(mocks.trackEvent).toHaveBeenCalledWith('admin__design_playground_toast--trigger', {
      scenario_id: 'trip_archived',
    });
    expect(mocks.showAppToast).toHaveBeenCalledWith(expect.objectContaining({
      tone: 'remove',
      title: 'Trip archived',
    }));

    const genericErrorButtons = screen.getAllByRole('button', { name: 'Generic error' });
    await user.click(genericErrorButtons[0]);

    expect(mocks.trackEvent).toHaveBeenCalledWith('admin__design_playground_toast--trigger', {
      scenario_id: 'generic_error',
    });
    expect(mocks.showAppToast).toHaveBeenCalledWith(expect.objectContaining({
      tone: 'error',
      title: 'Action failed',
    }));
  });

  it('triggers shared app confirm/prompt dialog samples', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });

    render(React.createElement(AdminDesignSystemPlaygroundPage));

    const dialogTabs = screen.getAllByRole('tab', { name: 'Dialogs + Drawers + Modals' });
    await user.click(dialogTabs[dialogTabs.length - 1]);

    const confirmButtons = await screen.findAllByRole('button', { name: 'Open Confirm Dialog (Danger)' });
    await user.click(confirmButtons[confirmButtons.length - 1]);
    expect(mocks.confirmDialog).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Hard delete trip',
      tone: 'danger',
    }));

    const promptButtons = screen.getAllByRole('button', { name: 'Open Prompt Dialog (URL + Validate)' });
    await user.click(promptButtons[promptButtons.length - 1]);
    expect(mocks.promptDialog).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Insert Link',
      inputType: 'url',
    }));
  }, 25000);
});
