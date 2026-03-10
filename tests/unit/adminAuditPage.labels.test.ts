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
});
