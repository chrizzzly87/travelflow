// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  adminGetBillingDashboard: vi.fn(),
  adminListBillingSubscriptions: vi.fn(),
  adminListBillingWebhookEvents: vi.fn(),
  adminReconcilePaddleSubscriptions: vi.fn(),
  confirmDialog: vi.fn(),
  promptDialog: vi.fn(),
  showAppToast: vi.fn(),
}));

vi.mock('../../../components/admin/AdminShell', () => ({
  AdminShell: ({ title, description, actions, children }: { title: string; description?: string; actions?: React.ReactNode; children: React.ReactNode }) => (
    React.createElement(
      'div',
      null,
      React.createElement('h1', null, title),
      description ? React.createElement('p', null, description) : null,
      actions,
      children,
    )
  ),
}));

vi.mock('../../../components/admin/AdminReloadButton', () => ({
  AdminReloadButton: ({ onClick, label }: { onClick: () => void; label: string }) => React.createElement('button', { type: 'button', onClick }, label),
}));

vi.mock('../../../components/AppDialogProvider', () => ({
  useAppDialog: () => ({
    confirm: mocks.confirmDialog,
    prompt: mocks.promptDialog,
  }),
}));

vi.mock('../../../components/ui/appToast', () => ({
  showAppToast: mocks.showAppToast,
}));

vi.mock('../../../components/admin/AdminFilterMenu', () => ({
  AdminFilterMenu: ({ label }: { label: string }) => React.createElement('div', null, label),
}));

vi.mock('../../../components/admin/AdminCountUpNumber', () => ({
  AdminCountUpNumber: ({ value }: { value: number }) => React.createElement('span', null, String(value)),
}));

vi.mock('../../../components/admin/AdminSurfaceCard', () => ({
  AdminSurfaceCard: ({ children }: { children: React.ReactNode }) => React.createElement('section', null, children),
}));

vi.mock('@tremor/react', () => ({
  BarChart: ({ children }: { children?: React.ReactNode }) => React.createElement('div', { 'data-testid': 'tremor-bar-chart' }, children),
  BarList: ({ children }: { children?: React.ReactNode }) => React.createElement('div', { 'data-testid': 'tremor-bar-list' }, children),
  DonutChart: ({ children }: { children?: React.ReactNode }) => React.createElement('div', { 'data-testid': 'tremor-donut-chart' }, children),
  Metric: ({ children }: { children?: React.ReactNode }) => React.createElement('div', null, children),
  Text: ({ children }: { children?: React.ReactNode }) => React.createElement('p', null, children),
  Title: ({ children }: { children?: React.ReactNode }) => React.createElement('h3', null, children),
}));

vi.mock('../../../components/admin/CopyableUuid', () => ({
  CopyableUuid: ({ value }: { value: string }) => React.createElement('span', null, value),
}));

vi.mock('../../../services/adminService', () => ({
  adminGetBillingDashboard: mocks.adminGetBillingDashboard,
  adminListBillingSubscriptions: mocks.adminListBillingSubscriptions,
  adminListBillingWebhookEvents: mocks.adminListBillingWebhookEvents,
  adminReconcilePaddleSubscriptions: mocks.adminReconcilePaddleSubscriptions,
}));

import { AdminBillingPage } from '../../../pages/AdminBillingPage';

const renderPage = () => render(
  React.createElement(
    MemoryRouter,
    { initialEntries: ['/admin/billing'] },
    React.createElement(AdminBillingPage),
  ),
);

describe('pages/AdminBillingPage', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.adminGetBillingDashboard.mockResolvedValue({
      active_subscriptions: 4,
      scheduled_cancellations: 1,
      grace_subscriptions: 1,
      failed_webhook_events: 1,
      current_mrr_by_currency: [{ currency: 'USD', amount: 2800, subscriptions: 3 }],
      current_mrr_by_tier: [{ tier_key: 'tier_mid', currency: 'USD', amount: 900, subscriptions: 1 }],
      subscription_mix: [{ tier_key: 'tier_mid', count: 1 }],
      status_mix: [{ status: 'active', count: 1 }],
      at_risk_revenue: [{ status: 'past_due', currency: 'USD', amount: 900, subscriptions: 1 }],
    });
    mocks.adminListBillingSubscriptions.mockResolvedValue([
      {
        user_id: '00000000-0000-0000-0000-000000000001',
        email: 'explorer@example.com',
        tier_key: 'tier_mid',
        provider: 'paddle',
        provider_customer_id: 'ctm_123',
        provider_subscription_id: 'sub_123',
        provider_price_id: 'pri_123',
        provider_status: 'active',
        subscription_status: 'active',
        current_period_start: '2026-03-01T00:00:00.000Z',
        current_period_end: '2026-04-01T00:00:00.000Z',
        cancel_at: null,
        canceled_at: null,
        grace_ends_at: null,
        currency: 'USD',
        amount: 900,
        last_event_id: 'evt_123',
        last_event_type: 'subscription.updated',
        last_event_at: '2026-03-08T09:00:00.000Z',
        created_at: '2026-03-01T00:00:00.000Z',
        updated_at: new Date().toISOString(),
      },
    ]);
    mocks.adminListBillingWebhookEvents.mockResolvedValue([
      {
        event_id: 'evt_123',
        provider: 'paddle',
        event_type: 'subscription.updated',
        occurred_at: new Date().toISOString(),
        user_id: '00000000-0000-0000-0000-000000000001',
        user_email: 'explorer@example.com',
        status: 'failed',
        error_message: 'Signature mismatch',
        payload: {},
        processed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      },
    ]);
    mocks.adminReconcilePaddleSubscriptions.mockResolvedValue({
      summary: {
        fetched: 2,
        eligible: 1,
        processed: 1,
        ignored: 0,
        duplicates: 0,
        failed: 0,
        resolvedUsers: 1,
        unresolved: 0,
      },
      results: [],
    });
    mocks.confirmDialog.mockResolvedValue(true);
    mocks.promptDialog.mockResolvedValue('');
    mocks.showAppToast.mockReturnValue('toast-id');
  });

  it('renders subscription and webhook sections with fetched billing data', async () => {
    renderPage();

    await waitFor(() => {
      expect(mocks.adminListBillingSubscriptions).toHaveBeenCalled();
      expect(mocks.adminListBillingWebhookEvents).toHaveBeenCalled();
      expect(mocks.adminGetBillingDashboard).toHaveBeenCalled();
    });

    expect(screen.getByRole('heading', { name: 'Billing' })).toBeInTheDocument();
    expect(screen.getByText('Current MRR by tier')).toBeInTheDocument();
    expect(screen.getByText('At-risk revenue')).toBeInTheDocument();
    expect(screen.getByText('Subscriptions')).toBeInTheDocument();
    expect(screen.getByText('Webhook events')).toBeInTheDocument();
    expect(screen.getAllByText('explorer@example.com')).toHaveLength(2);
    expect(screen.getByText('Signature mismatch')).toBeInTheDocument();
    expect(screen.getByText('Subscription status')).toBeInTheDocument();
    expect(screen.getByText('Webhook status')).toBeInTheDocument();
    expect(screen.getByText('Payload JSON')).toBeInTheDocument();
  });

  it('runs Paddle reconciliation from the billing workspace', async () => {
    const { userEvent } = await import('@testing-library/user-event');
    renderPage();

    await waitFor(() => {
      expect(mocks.adminListBillingSubscriptions).toHaveBeenCalledTimes(1);
      expect(mocks.adminListBillingWebhookEvents).toHaveBeenCalledTimes(1);
    });

    await userEvent.setup().click(screen.getByRole('button', { name: 'Reconcile Paddle' }));

    await waitFor(() => {
      expect(mocks.promptDialog).toHaveBeenCalled();
      expect(mocks.confirmDialog).toHaveBeenCalled();
      expect(mocks.adminReconcilePaddleSubscriptions).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('Latest Paddle reconciliation')).toBeInTheDocument();
    expect(screen.getByText(/Fetched 2 subscriptions and replayed 1 eligible records/i)).toBeInTheDocument();
  });

  it('passes a targeted subscription id into Paddle reconciliation when provided', async () => {
    const { userEvent } = await import('@testing-library/user-event');
    mocks.promptDialog.mockResolvedValue('sub_01kk6fcs5t4f75tddavgjx1rtz');

    renderPage();

    await waitFor(() => {
      expect(mocks.adminListBillingSubscriptions).toHaveBeenCalledTimes(1);
      expect(mocks.adminListBillingWebhookEvents).toHaveBeenCalledTimes(1);
    });

    await userEvent.setup().click(screen.getByRole('button', { name: 'Reconcile Paddle' }));

    await waitFor(() => {
      expect(mocks.adminReconcilePaddleSubscriptions).toHaveBeenCalledWith({
        maxSubscriptions: 1,
        subscriptionId: 'sub_01kk6fcs5t4f75tddavgjx1rtz',
      });
    });

    expect(screen.getByText(/Fetched sub_01kk6fcs5t4f75tddavgjx1rtz and replayed it through the billing sync/i)).toBeInTheDocument();
  });

  it('renders processed webhook sync notes without error styling', async () => {
    mocks.adminListBillingWebhookEvents.mockResolvedValue([
      {
        event_id: 'manual_reconcile_evt_123',
        provider: 'paddle',
        event_type: 'subscription.activated',
        occurred_at: new Date().toISOString(),
        user_id: '00000000-0000-0000-0000-000000000001',
        user_email: 'explorer@example.com',
        status: 'processed',
        error_message: 'Applied subscription lifecycle update (active)',
        payload: {},
        processed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      },
    ]);

    renderPage();

    const note = await screen.findByText('Applied subscription lifecycle update (active)');
    const messageBox = note.parentElement;
    expect(messageBox?.className).toContain('border-accent-200');
    expect(messageBox?.className).not.toContain('border-rose-200');
  });
});
