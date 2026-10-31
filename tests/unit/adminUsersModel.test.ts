import { describe, expect, it } from 'vitest';
import type { AdminUserRecord } from '../../services/adminService';
import {
  countUserQueues,
  isTripExpiryInputUnchanged,
  matchesUserQueue,
  resolveAppliedUserQueue,
  resolveUserLifecycleStatus,
  toDateTimeInputValue,
} from '../../components/admin/adminUsersModel';

const makeUser = (overrides: Partial<AdminUserRecord> = {}): AdminUserRecord => ({
  user_id: 'user-1',
  email: 'user@example.com',
  auth_provider: 'email',
  auth_providers: ['email'],
  is_anonymous: false,
  activation_status: 'activated',
  account_status: 'active',
  last_sign_in_at: '2026-10-01T10:00:00Z',
  system_role: 'user',
  tier_key: 'tier_free',
  entitlements_override: null,
  total_trips: 1,
  active_trips: 1,
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-10-01T10:00:00Z',
  ...overrides,
});

describe('components/admin/adminUsersModel', () => {
  describe('resolveUserLifecycleStatus', () => {
    it('reads a healthy activated account as Active', () => {
      expect(resolveUserLifecycleStatus(makeUser())).toMatchObject({ key: 'active', label: 'Active', tone: 'success' });
    });

    it('lets account state win over activation', () => {
      const invitedButDeleted = makeUser({ account_status: 'deleted', activation_status: 'invited', last_sign_in_at: null });
      expect(resolveUserLifecycleStatus(invitedButDeleted).key).toBe('deleted');
      expect(resolveUserLifecycleStatus(makeUser({ account_status: 'disabled' })).label).toBe('Suspended');
    });

    it('labels invited, pending and guest accounts', () => {
      expect(resolveUserLifecycleStatus(makeUser({ activation_status: 'invited', last_sign_in_at: null })).label).toBe('Invited');
      expect(resolveUserLifecycleStatus(makeUser({ activation_status: 'pending', email: null, last_sign_in_at: null })).label).toBe('Pending activation');
      expect(resolveUserLifecycleStatus(makeUser({ is_anonymous: true })).label).toBe('Guest');
    });

    it('ranks accounts that need attention before healthy ones', () => {
      const ranks = [
        makeUser({ account_status: 'deleted' }),
        makeUser({ account_status: 'disabled' }),
        makeUser({ activation_status: 'pending', email: null, last_sign_in_at: null }),
        makeUser(),
      ].map((user) => resolveUserLifecycleStatus(user).rank);
      expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
    });
  });

  describe('work queues', () => {
    const invited = makeUser({ user_id: 'invited', activation_status: 'invited', last_sign_in_at: null });
    const pastDue = makeUser({ user_id: 'past-due', provider_status: 'past_due', subscription_status: 'past_due' });
    const empty = makeUser({
      user_id: 'empty',
      email: null,
      auth_provider: null,
      auth_providers: [],
      activation_status: 'pending',
      last_sign_in_at: null,
      total_trips: 0,
      active_trips: 0,
    });

    it('counts each queue from the users in scope', () => {
      expect(countUserQueues([makeUser(), invited, pastDue, empty])).toEqual({
        awaiting_activation: 2,
        subscriptions_at_risk: 1,
        empty_accounts: 1,
      });
    });

    it('matches only the accounts a queue is about', () => {
      expect(matchesUserQueue(invited, 'awaiting_activation')).toBe(true);
      expect(matchesUserQueue(makeUser(), 'awaiting_activation')).toBe(false);
      expect(matchesUserQueue(pastDue, 'subscriptions_at_risk')).toBe(true);
      expect(matchesUserQueue(empty, 'empty_accounts')).toBe(true);
      expect(matchesUserQueue(invited, 'empty_accounts')).toBe(false);
    });

    it('recognises an applied queue only when the filters match it exactly', () => {
      expect(resolveAppliedUserQueue({ activation: ['pending', 'invited'], subscription: [], trips: [] }, false)).toBe('awaiting_activation');
      expect(resolveAppliedUserQueue({ activation: ['invited'], subscription: [], trips: [] }, false)).toBeNull();
      expect(resolveAppliedUserQueue({ activation: ['invited', 'pending'], subscription: [], trips: [] }, true)).toBeNull();
      expect(resolveAppliedUserQueue({ activation: [], subscription: [], trips: ['no_trips_no_profile'] }, false)).toBe('empty_accounts');
      expect(resolveAppliedUserQueue({ activation: [], subscription: [], trips: [] }, false)).toBeNull();
    });
  });

  describe('dates', () => {
    it('treats an untouched trip-expiry input as unchanged', () => {
      const stored = '2026-11-02T09:30:00.000Z';
      expect(isTripExpiryInputUnchanged(toDateTimeInputValue(stored), stored)).toBe(true);
      expect(isTripExpiryInputUnchanged('', null)).toBe(true);
      expect(isTripExpiryInputUnchanged('2026-11-03T09:30', stored)).toBe(false);
      expect(isTripExpiryInputUnchanged('', stored)).toBe(false);
    });
  });
});
