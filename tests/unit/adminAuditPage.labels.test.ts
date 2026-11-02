import { describe, expect, it } from 'vitest';
import { __ADMIN_AUDIT_TESTING__ } from '../../pages/AdminAuditPage';

describe('pages/AdminAuditPage labels and grouping', () => {
  it('maps missing labels for audit export and legal terms targets', () => {
    expect(__ADMIN_AUDIT_TESTING__.getActionFilterLabel('admin.audit.export')).toBe('Exported audit replay bundle');
    expect(__ADMIN_AUDIT_TESTING__.getActionFilterLabel('billing.subscription.updated')).toBe('Billing subscription updated');
    expect(__ADMIN_AUDIT_TESTING__.getTargetLabel('legal_terms_version')).toBe('Terms version');
    expect(__ADMIN_AUDIT_TESTING__.getTargetLabel('audit')).toBe('Audit');
    expect(__ADMIN_AUDIT_TESTING__.getTargetLabel('subscription')).toBe('Subscription');
  });

  it('groups related actions into named meta groups', () => {
    expect(__ADMIN_AUDIT_TESTING__.getActionGroupLabel('admin.user.update_profile')).toBe('Admin users');
    expect(__ADMIN_AUDIT_TESTING__.getActionGroupLabel('admin.trip.update')).toBe('Admin trips');
    expect(__ADMIN_AUDIT_TESTING__.getActionGroupLabel('admin.terms.publish')).toBe('Terms & legal');
    expect(__ADMIN_AUDIT_TESTING__.getActionGroupLabel('admin.audit.export')).toBe('Audit & tooling');
    expect(__ADMIN_AUDIT_TESTING__.getActionGroupLabel('billing.subscription.updated')).toBe('Billing & subscriptions');
    expect(__ADMIN_AUDIT_TESTING__.getActionGroupLabel('trip.created')).toBe('User trip actions');
  });

  it('stores an action filter that covers every action as no filter', () => {
    const { normalizeActionFilters } = __ADMIN_AUDIT_TESTING__;
    const all = ['admin.user.invite', 'trip.created', 'trip.updated'];
    expect(normalizeActionFilters([...all], all)).toEqual([]);
    expect(normalizeActionFilters(['trip.updated', 'admin.user.invite', 'trip.created'], all)).toEqual([]);
    expect(normalizeActionFilters(['trip.created'], all)).toEqual(['trip.created']);
    expect(normalizeActionFilters([], all)).toEqual([]);
    // A URL filter for an action not loaded yet is kept as written.
    expect(normalizeActionFilters(['admin.tier.reapply'], [])).toEqual(['admin.tier.reapply']);
  });

  it('formats audit timestamps relative to now', () => {
    const { formatAuditRelativeTime } = __ADMIN_AUDIT_TESTING__;
    const now = Date.parse('2026-10-24T12:00:00.000Z');
    expect(formatAuditRelativeTime('2026-10-24T11:59:40.000Z', now)).toBe('just now');
    expect(formatAuditRelativeTime('2026-10-24T11:15:00.000Z', now)).toBe('45 minutes ago');
    expect(formatAuditRelativeTime('2026-10-24T09:00:00.000Z', now)).toBe('3 hours ago');
    expect(formatAuditRelativeTime('2026-10-23T12:00:00.000Z', now)).toBe('yesterday');
    expect(formatAuditRelativeTime('2026-10-10T12:00:00.000Z', now)).toBe('2 weeks ago');
    expect(formatAuditRelativeTime(null, now)).toBe('—');
    expect(formatAuditRelativeTime('not-a-date', now)).toBe('—');
  });
});
