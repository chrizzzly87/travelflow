// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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

    await user.click(screen.getByRole('tab', { name: 'Inputs + textareas' }));

    await waitFor(() => {
      expect(mocks.trackEvent).toHaveBeenCalledWith('admin__design_playground_component_group--view', {
        group_id: 'inputs',
      });
    });

    await user.click(screen.getByRole('tab', { name: 'Country select + calendar' }));

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

    const dialogTabs = screen.getAllByRole('tab', { name: 'Dialogs + drawers + modals' });
    await user.click(dialogTabs[dialogTabs.length - 1]);

    const confirmButtons = await screen.findAllByRole('button', { name: 'Open confirm dialog (danger)' });
    await user.click(confirmButtons[confirmButtons.length - 1]);
    expect(mocks.confirmDialog).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Hard delete trip',
      tone: 'danger',
    }));

    const promptButtons = screen.getAllByRole('button', { name: 'Open prompt dialog (URL + validate)' });
    await user.click(promptButtons[promptButtons.length - 1]);
    expect(mocks.promptDialog).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Insert Link',
      inputType: 'url',
    }));
  }, 25000);

  it('demos the admin workspace primitives on their own tab', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    class ResizeObserverMock {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
    Object.assign(globalThis, { ResizeObserver: ResizeObserverMock });

    render(React.createElement(AdminDesignSystemPlaygroundPage));

    const adminTabs = screen.getAllByRole('tab', { name: 'Admin workspace' });
    await user.click(adminTabs[adminTabs.length - 1]);

    await waitFor(() => {
      expect(mocks.trackEvent).toHaveBeenCalledWith('admin__design_playground_component_group--view', {
        group_id: 'admin',
      });
    });
    expect(screen.getByText('Total users')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Recent trips' })).toBeTruthy();
    for (const tone of ['neutral', 'info', 'success', 'warning', 'danger', 'accent']) {
      expect(screen.getByText(new RegExp(`· ${tone}$`))).toBeTruthy();
    }
    expect(screen.getByText('No trips in this range')).toBeTruthy();
    expect(screen.getByText('The trip list did not load. Reload to try again.')).toBeTruthy();
    expect(screen.getByRole('figure', { name: 'Sample stacked bar chart of daily new and returning users' })).toBeTruthy();
    expect(screen.getByRole('figure', { name: 'Sample area chart of new users per day' })).toBeTruthy();
  }, 25000);

  it('demos the detail sheet, selection bar, pagination and bar list', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    class ResizeObserverMock {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
    Object.assign(globalThis, { ResizeObserver: ResizeObserverMock });

    render(React.createElement(AdminDesignSystemPlaygroundPage));
    const adminTabs = screen.getAllByRole('tab', { name: 'Admin workspace' });
    await user.click(adminTabs[adminTabs.length - 1]);

    expect(screen.getByRole('list', { name: 'Sample bar list of trips per country' })).toBeTruthy();
    expect(screen.getByText('Showing 51–100 of 240 users')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getByText('Showing 101–150 of 240 users')).toBeTruthy();

    // The bulk bar exists only while something is selected.
    expect(screen.queryByRole('region', { name: 'Bulk actions' })).toBeNull();
    await user.click(screen.getByRole('checkbox', { name: 'Select Jonas Weber' }));
    expect(screen.getByRole('region', { name: 'Bulk actions' })).toBeTruthy();
    expect(screen.getByText('1 user selected')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(screen.queryByRole('region', { name: 'Bulk actions' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Open sample detail sheet' }));
    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getAllByRole('heading', { name: 'Mara Lindqvist' }).length).toBeGreaterThan(0);
    expect(within(sheet).getByRole('button', { name: 'Soft-delete user' })).toBeTruthy();
  }, 25000);
});
