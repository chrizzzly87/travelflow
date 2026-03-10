import type { PlanTierKey } from '../../types';

export type ManagedBillingStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'paused'
  | 'canceled'
  | 'inactive'
  | 'none'
  | 'unknown';

export type BillingTierAction =
  | 'acquire'
  | 'current'
  | 'upgrade'
  | 'downgrade'
  | 'manage';

export interface BillingSubscriptionLike {
  provider_subscription_id?: string | null;
  providerSubscriptionId?: string | null;
  provider_status?: string | null;
  providerStatus?: string | null;
  status?: string | null;
  cancel_at?: string | null;
  cancelAt?: string | null;
  canceled_at?: string | null;
  canceledAt?: string | null;
  grace_ends_at?: string | null;
  graceEndsAt?: string | null;
}

export interface BillingTierDecision {
  action: BillingTierAction;
  status: ManagedBillingStatus;
  currentTierKey: PlanTierKey;
  targetTierKey: Extract<PlanTierKey, 'tier_mid' | 'tier_premium'>;
  reason:
    | 'free_acquisition'
    | 'same_paid_tier'
    | 'upgrade_available'
    | 'downgrade_requires_management'
    | 'blocked_status'
    | 'scheduled_cancel'
    | 'missing_subscription'
    | 'no_paid_subscription';
}

const PAID_TIER_ORDER: Array<Extract<PlanTierKey, 'tier_mid' | 'tier_premium'>> = ['tier_mid', 'tier_premium'];

export const normalizeManagedBillingStatus = (
  providerStatus?: string | null,
  subscriptionStatus?: string | null,
): ManagedBillingStatus => {
  const normalized = (providerStatus || subscriptionStatus || '').trim().toLowerCase();
  if (!normalized) return 'none';
  if (normalized === 'active') return 'active';
  if (normalized === 'trialing') return 'trialing';
  if (normalized === 'past_due') return 'past_due';
  if (normalized === 'paused') return 'paused';
  if (normalized === 'canceled' || normalized === 'cancelled') return 'canceled';
  if (normalized === 'inactive') return 'inactive';
  return 'unknown';
};

const readProviderSubscriptionId = (subscription: BillingSubscriptionLike | null | undefined): string | null => {
  const value = subscription?.providerSubscriptionId ?? subscription?.provider_subscription_id ?? null;
  return typeof value === 'string' && value.trim() ? value : null;
};

export const comparePaidTierOrder = (
  currentTierKey: Extract<PlanTierKey, 'tier_mid' | 'tier_premium'>,
  targetTierKey: Extract<PlanTierKey, 'tier_mid' | 'tier_premium'>,
): number => {
  return PAID_TIER_ORDER.indexOf(targetTierKey) - PAID_TIER_ORDER.indexOf(currentTierKey);
};

const isScheduledCancel = (subscription: BillingSubscriptionLike, nowMs: number): boolean => {
  const cancelAt = subscription.cancelAt ?? subscription.cancel_at ?? '';
  const cancelAtMs = Date.parse(cancelAt);
  return Number.isFinite(cancelAtMs) && cancelAtMs > nowMs;
};

const hasManageablePaidSubscription = (
  subscription: BillingSubscriptionLike | null | undefined,
  normalizedStatus: ManagedBillingStatus,
): boolean => {
  return Boolean(readProviderSubscriptionId(subscription)) && normalizedStatus !== 'none';
};

export const resolveBillingTierDecision = ({
  currentTierKey,
  targetTierKey,
  subscription,
  nowMs = Date.now(),
}: {
  currentTierKey: PlanTierKey;
  targetTierKey: Extract<PlanTierKey, 'tier_mid' | 'tier_premium'>;
  subscription?: BillingSubscriptionLike | null;
  nowMs?: number;
}): BillingTierDecision => {
  const status = normalizeManagedBillingStatus(
    subscription?.providerStatus ?? subscription?.provider_status,
    subscription?.status,
  );

  if (currentTierKey === 'tier_free') {
    if (!hasManageablePaidSubscription(subscription, status)) {
      return {
        action: 'acquire',
        status,
        currentTierKey,
        targetTierKey,
        reason: 'free_acquisition',
      };
    }

    return {
      action: 'manage',
      status,
      currentTierKey,
      targetTierKey,
      reason: 'missing_subscription',
    };
  }

  if (!hasManageablePaidSubscription(subscription, status)) {
    return {
      action: 'manage',
      status,
      currentTierKey,
      targetTierKey,
      reason: 'missing_subscription',
    };
  }

  if (isScheduledCancel(subscription || {}, nowMs)) {
    return {
      action: 'manage',
      status,
      currentTierKey,
      targetTierKey,
      reason: 'scheduled_cancel',
    };
  }

  if (status === 'past_due' || status === 'paused' || status === 'canceled' || status === 'inactive' || status === 'unknown') {
    return {
      action: 'manage',
      status,
      currentTierKey,
      targetTierKey,
      reason: 'blocked_status',
    };
  }

  if (currentTierKey === targetTierKey) {
    return {
      action: 'current',
      status,
      currentTierKey,
      targetTierKey,
      reason: 'same_paid_tier',
    };
  }

  const direction = comparePaidTierOrder(currentTierKey, targetTierKey);
  if (direction > 0) {
    return {
      action: 'upgrade',
      status,
      currentTierKey,
      targetTierKey,
      reason: 'upgrade_available',
    };
  }

  return {
    action: 'manage',
    status,
    currentTierKey,
    targetTierKey,
    reason: 'downgrade_requires_management',
  };
};
