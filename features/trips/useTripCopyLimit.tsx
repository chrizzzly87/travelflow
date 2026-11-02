import React, { useCallback } from 'react';
import { Check } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useAppDialog } from '../../components/AppDialogProvider';
import { useAuth } from '../../hooks/useAuth';
import { useLocation, useNavigate } from '../../app/navigation';
import { PLAN_CATALOG } from '../../config/planCatalog';
import { trackEvent } from '../../services/analyticsService';
import { buildBillingCheckoutPath } from '../../services/billingService';

/** Shared copy quota interaction; route presenters own source/provenance only. */
export function useTripCopyLimit(source: 'shared_trip' | 'example_trip' | 'trip_draft') {
    const { access } = useAuth();
    const { confirm: confirmDialog } = useAppDialog();
    const { t } = useTranslation(['common', 'pricing']);
    const routeLocation = useLocation();
    const navigate = useNavigate();
    const resolveTierHighlights = useCallback((tierKey: 'tier_mid' | 'tier_premium') => {
        const tier = PLAN_CATALOG[tierKey];
        const unlimitedLabel = t('shared.unlimited', { ns: 'pricing' });
        const noExpiryLabel = t('shared.noExpiry', { ns: 'pricing' });
        const enabledLabel = t('shared.enabled', { ns: 'pricing' });
        const disabledLabel = t('shared.disabled', { ns: 'pricing' });
        const interpolationValues = {
            maxActiveTripsLabel: tier.entitlements.maxActiveTrips === null
                ? unlimitedLabel
                : String(tier.entitlements.maxActiveTrips),
            maxTotalTripsLabel: tier.entitlements.maxTotalTrips === null
                ? unlimitedLabel
                : String(tier.entitlements.maxTotalTrips),
            tripExpirationLabel: tier.entitlements.tripExpirationDays === null
                ? noExpiryLabel
                : t('shared.days', { ns: 'pricing', count: tier.entitlements.tripExpirationDays }),
            sharingLabel: tier.entitlements.canShare ? enabledLabel : disabledLabel,
            editableSharesLabel: tier.entitlements.canCreateEditableShares ? enabledLabel : disabledLabel,
            proCreationLabel: tier.entitlements.canCreateProTrips ? enabledLabel : disabledLabel,
        };
        return [0, 2, 4].map((index) => t(`tiers.${tier.publicSlug}.features.${index}`, {
            ns: 'pricing',
            ...interpolationValues,
        }));
    }, [t]);

    const handleTripLimitReached = useCallback(async (limit: { activeTripCount: number; maxTripCount: number }) => {
        const currentTierKey = access?.tierKey === 'tier_mid' || access?.tierKey === 'tier_premium'
            ? access.tierKey
            : 'tier_free';
        const upgradeTierKey = currentTierKey === 'tier_mid' ? 'tier_premium' : 'tier_mid';
        const currentTier = PLAN_CATALOG[currentTierKey];
        const upgradeTier = PLAN_CATALOG[upgradeTierKey];
        const currentPath = `${routeLocation.pathname}${routeLocation.search}${routeLocation.hash}`;

        trackEvent('trip_limit__dialog--view', {
            source,
            current_tier: currentTierKey,
            target_tier: upgradeTierKey,
            active_trip_count: limit.activeTripCount,
            max_trip_count: limit.maxTripCount,
        });

        const shouldUpgrade = await confirmDialog({
            title: `${currentTier.publicName} -> ${upgradeTier.publicName}`,
            message: (
                <div className="space-y-3">
                    <div className="rounded-xl border border-border bg-card p-4">
                        <div className="flex items-end justify-between gap-3">
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                    {currentTier.publicName}
                                </p>
                                <p className="mt-1 text-sm font-semibold text-foreground">
                                    {limit.activeTripCount} / {limit.maxTripCount}
                                </p>
                            </div>
                            <div className="text-right text-sm text-muted-foreground">
                                ${currentTier.monthlyPriceUsd}{t('shared.perMonth', { ns: 'pricing' })}
                            </div>
                        </div>
                    </div>
                    <div className="rounded-xl border border-accent-200 bg-accent-50/70 p-4 dark:bg-accent-400/12 dark:border-accent-400/30">
                        <div className="flex items-end justify-between gap-3">
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-700 dark:text-accent-200">
                                    {upgradeTier.publicName}
                                </p>
                                <p className="mt-1 text-sm font-semibold text-foreground">
                                    ${upgradeTier.monthlyPriceUsd}{t('shared.perMonth', { ns: 'pricing' })}
                                </p>
                            </div>
                        </div>
                        <ul className="mt-3 space-y-2">
                            {resolveTierHighlights(upgradeTierKey).map((feature) => (
                                <li key={feature} className="flex items-start gap-2 text-sm leading-6 text-foreground">
                                    <Check size={14} weight="bold" className="mt-1 shrink-0 text-accent-600 dark:text-accent-300" />
                                    <span>{feature}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            ),
            confirmLabel: t(`tiers.${upgradeTier.publicSlug}.cta`, { ns: 'pricing' }),
            cancelLabel: t('buttons.done', { ns: 'common' }),
        });

        if (!shouldUpgrade) {
            trackEvent('trip_limit__dialog--dismiss', {
                source,
                current_tier: currentTierKey,
                target_tier: upgradeTierKey,
            });
            return;
        }

        trackEvent('trip_limit__dialog--upgrade', {
            source,
            current_tier: currentTierKey,
            target_tier: upgradeTierKey,
        });

        navigate(buildBillingCheckoutPath({
            tierKey: upgradeTierKey,
            source: `${source}_limit_dialog`,
            returnTo: currentPath,
        }));
    }, [access?.tierKey, confirmDialog, routeLocation.hash, routeLocation.pathname, routeLocation.search, navigate, resolveTierHighlights, t, source]);

    return handleTripLimitReached;
}
