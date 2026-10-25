import { describe, expect, it } from 'vitest';

import {
  adminBillingStatusClassName,
  buildAdminBillingMrrHeadline,
  extractAdminBillingWebhookSubscriptionId,
  filterAdminBillingWebhookEvents,
  formatAdminBillingRelativeTime,
  resolveAdminBillingWebhookStatusKey,
  sliceAdminBillingPage,
  buildAdminBillingAtRiskChartData,
  buildAdminBillingCurrentMrrCards,
  buildAdminBillingMrrByTierChartData,
  buildAdminBillingStatusMixChartData,
  buildAdminBillingTierMixChartData,
  filterAdminBillingSubscriptionsByRange,
  filterAdminBillingWebhookEventsByRange,
  formatAdminBillingAmount,
  humanizeAdminBillingStatus,
  isAdminBillingGraceActive,
  isAdminBillingSubscriptionActive,
  normalizeAdminBillingStatus,
  resolveAdminBillingStatusTone,
  summarizeAdminBilling,
} from '../../services/adminBillingPresentation';
import type { AdminBillingSubscriptionRecord, AdminBillingWebhookEventRecord } from '../../services/adminService';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW_MS = Date.now();
const NOW_ISO = new Date(NOW_MS).toISOString();
const futureIso = (days: number): string => new Date(NOW_MS + days * DAY_MS).toISOString();

const subscription = (overrides: Partial<AdminBillingSubscriptionRecord>): AdminBillingSubscriptionRecord => ({
  user_id: '00000000-0000-0000-0000-000000000001',
  email: 'traveler@example.com',
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
  updated_at: '2026-03-08T09:00:00.000Z',
  ...overrides,
});

const event = (overrides: Partial<AdminBillingWebhookEventRecord>): AdminBillingWebhookEventRecord => ({
  event_id: 'evt_123',
  provider: 'paddle',
  event_type: 'subscription.updated',
  occurred_at: '2026-03-08T09:00:00.000Z',
  user_id: '00000000-0000-0000-0000-000000000001',
  user_email: 'traveler@example.com',
  status: 'processed',
  error_message: null,
  payload: { ok: true },
  processed_at: '2026-03-08T09:01:00.000Z',
  created_at: '2026-03-08T09:01:00.000Z',
  ...overrides,
});

describe('services/adminBillingPresentation', () => {
  it('formats minor-unit currency amounts for the admin billing tables', () => {
    expect(formatAdminBillingAmount(900, 'USD', 'en-US')).toBe('$9.00');
    expect(formatAdminBillingAmount(null, 'USD', 'en-US')).toBe('—');
  });

  it('treats future grace windows as access-active', () => {
    const record = subscription({
      provider_status: 'canceled',
      subscription_status: 'inactive',
      grace_ends_at: futureIso(2),
    });

    expect(isAdminBillingGraceActive(record, NOW_MS)).toBe(true);
    expect(isAdminBillingSubscriptionActive(record, NOW_MS)).toBe(true);
  });

  it('summarizes active, grace, failed, and unlinked billing rows', () => {
    const summary = summarizeAdminBilling(
      [
        subscription({ user_id: '00000000-0000-0000-0000-000000000001' }),
        subscription({
          user_id: '00000000-0000-0000-0000-000000000002',
          provider_status: 'canceled',
          subscription_status: 'inactive',
          grace_ends_at: futureIso(3),
        }),
      ],
      [
        event({ event_id: 'evt_ok', status: 'processed' }),
        event({ event_id: 'evt_failed', status: 'failed', user_id: null, user_email: null }),
      ],
      NOW_MS,
    );

    expect(summary).toEqual({
      totalSubscriptions: 2,
      activeSubscriptions: 2,
      graceSubscriptions: 1,
      canceledSubscriptions: 1,
      failedWebhookEvents: 1,
      unlinkedWebhookEvents: 1,
    });
  });

  it('filters subscriptions and events by the requested admin date range', () => {
    expect(filterAdminBillingSubscriptionsByRange([
      subscription({ updated_at: NOW_ISO }),
      subscription({
        user_id: '00000000-0000-0000-0000-000000000002',
        updated_at: new Date(NOW_MS - 180 * DAY_MS).toISOString(),
      }),
    ], '30d')).toHaveLength(1);

    expect(filterAdminBillingWebhookEventsByRange([
      event({ occurred_at: NOW_ISO }),
      event({
        event_id: 'evt_old',
        occurred_at: new Date(NOW_MS - 180 * DAY_MS).toISOString(),
      }),
    ], '30d')).toHaveLength(1);
  });

  it('maps billing statuses to stable admin tones and classes', () => {
    expect(resolveAdminBillingStatusTone('active')).toBe('accent');
    expect(resolveAdminBillingStatusTone('failed')).toBe('danger');
    expect(resolveAdminBillingStatusTone('processed')).toBe('accent');
    expect(adminBillingStatusClassName('accent')).toContain('border-accent-200');
  });

  it('normalizes billing status aliases and empty states for admin surfaces', () => {
    expect(normalizeAdminBillingStatus('cancelled')).toBe('canceled');
    expect(normalizeAdminBillingStatus(null, 'past_due')).toBe('past_due');
    expect(normalizeAdminBillingStatus(null, null)).toBe('none');
    expect(humanizeAdminBillingStatus('past_due')).toBe('Past due');
    expect(humanizeAdminBillingStatus('none')).toBe('No subscription');
  });

  it('builds dashboard chart data and MRR cards from aggregate RPC rows', () => {
    const dashboard = {
      active_subscriptions: 4,
      scheduled_cancellations: 1,
      grace_subscriptions: 1,
      failed_webhook_events: 1,
      current_mrr_by_currency: [
        { currency: 'USD', amount: 2800, subscriptions: 3 },
      ],
      current_mrr_by_tier: [
        { tier_key: 'tier_mid', currency: 'USD', amount: 900, subscriptions: 1 },
        { tier_key: 'tier_premium', currency: 'USD', amount: 1900, subscriptions: 2 },
      ],
      subscription_mix: [
        { tier_key: 'tier_mid', count: 1 },
        { tier_key: 'tier_premium', count: 2 },
      ],
      status_mix: [
        { status: 'active', count: 3 },
        { status: 'past_due', count: 1 },
      ],
      at_risk_revenue: [
        { status: 'past_due', currency: 'USD', amount: 900, subscriptions: 1 },
      ],
    };

    expect(buildAdminBillingCurrentMrrCards(dashboard as any, 'en-US')).toEqual([
      {
        currency: 'USD',
        amountMinor: 2800,
        amountLabel: '$28.00',
        subscriptions: 3,
      },
    ]);
    expect(buildAdminBillingTierMixChartData(dashboard as any)).toEqual([
      { tier: 'Explorer', count: 1 },
      { tier: 'Globetrotter', count: 2 },
    ]);
    expect(buildAdminBillingStatusMixChartData(dashboard as any)).toEqual([
      { status: 'Active', count: 3 },
      { status: 'Past due', count: 1 },
    ]);
    expect(buildAdminBillingMrrByTierChartData(dashboard as any)).toEqual([
      { label: 'Explorer · USD', amount: 9 },
      { label: 'Globetrotter · USD', amount: 19 },
    ]);
    expect(buildAdminBillingAtRiskChartData(dashboard as any)).toEqual([
      { label: 'Past due · USD', amount: 9 },
    ]);
  });
});

describe('webhook triage helpers', () => {
  it('normalizes the delivery status used for filters and counts', () => {
    expect(resolveAdminBillingWebhookStatusKey({ status: ' Failed ' })).toBe('failed');
    expect(resolveAdminBillingWebhookStatusKey({ status: '' })).toBe('unknown');
  });

  it('filters events by status and by whether they resolved to a user', () => {
    const records = [
      event({ event_id: 'a', status: 'failed' }),
      event({ event_id: 'b', status: 'failed', user_id: null }),
      event({ event_id: 'c', status: 'processed', user_id: null }),
    ];
    expect(filterAdminBillingWebhookEvents(records, { statuses: [], links: [] }).map((r) => r.event_id)).toEqual(['a', 'b', 'c']);
    expect(filterAdminBillingWebhookEvents(records, { statuses: ['failed'], links: [] }).map((r) => r.event_id)).toEqual(['a', 'b']);
    expect(filterAdminBillingWebhookEvents(records, { statuses: [], links: ['unlinked'] }).map((r) => r.event_id)).toEqual(['b', 'c']);
    expect(filterAdminBillingWebhookEvents(records, { statuses: ['failed'], links: ['unlinked'] }).map((r) => r.event_id)).toEqual(['b']);
  });

  it('finds the Paddle subscription a webhook payload is about', () => {
    expect(extractAdminBillingWebhookSubscriptionId(event({ payload: { data: { id: 'sub_01abc' } } }))).toBe('sub_01abc');
    expect(extractAdminBillingWebhookSubscriptionId(event({ payload: { data: { id: 'txn_1', subscription_id: 'sub_9' } } }))).toBe('sub_9');
    expect(extractAdminBillingWebhookSubscriptionId(event({ payload: { data: { id: 'txn_1' } } }))).toBeNull();
    expect(extractAdminBillingWebhookSubscriptionId(event({ payload: null }))).toBeNull();
  });
});

describe('formatAdminBillingRelativeTime', () => {
  const now = Date.parse('2026-10-24T12:00:00.000Z');
  it('formats past and future timestamps in the nearest unit', () => {
    expect(formatAdminBillingRelativeTime('2026-10-24T09:00:00.000Z', now)).toBe('3 hours ago');
    expect(formatAdminBillingRelativeTime('2026-10-23T12:00:00.000Z', now)).toBe('yesterday');
    expect(formatAdminBillingRelativeTime('2026-11-07T12:00:00.000Z', now)).toBe('in 2 weeks');
  });
  it('shows a dash for missing or invalid values', () => {
    expect(formatAdminBillingRelativeTime(null, now)).toBe('—');
    expect(formatAdminBillingRelativeTime('nope', now)).toBe('—');
  });
});

describe('sliceAdminBillingPage', () => {
  const items = Array.from({ length: 30 }, (_, index) => index);
  it('returns the requested page', () => {
    expect(sliceAdminBillingPage(items, 2, 25)).toEqual({ items: [25, 26, 27, 28, 29], page: 2 });
  });
  it('clamps a page that a filter change left out of range', () => {
    expect(sliceAdminBillingPage(items, 9, 25).page).toBe(2);
    expect(sliceAdminBillingPage([], 3, 25)).toEqual({ items: [], page: 1 });
  });
});

describe('buildAdminBillingMrrHeadline', () => {
  it('leads with the largest currency and names the others', () => {
    expect(buildAdminBillingMrrHeadline([
      { currency: 'USD', amountLabel: '$28.00', subscriptions: 3 },
      { currency: 'EUR', amountLabel: '€9.00', subscriptions: 1 },
    ])).toEqual({ value: '$28.00', subscriptions: 4, otherCurrencies: ['€9.00'] });
  });
  it('falls back to a dash without revenue', () => {
    expect(buildAdminBillingMrrHeadline([])).toEqual({ value: '—', subscriptions: 0, otherCurrencies: [] });
  });
});
