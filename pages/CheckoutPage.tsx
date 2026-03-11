import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowSquareOut, Check, CheckCircle, CreditCard, NotePencil, SpinnerGap, SuitcaseRolling, UserCircle } from '@phosphor-icons/react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { SiteHeader } from '../components/navigation/SiteHeader';
import { SiteFooter } from '../components/marketing/SiteFooter';
import { ProfileCountryRegionSelect } from '../components/profile/ProfileCountryRegionSelect';
import { Checkbox } from '../components/ui/checkbox';
import { showAppToast } from '../components/ui/appToast';
import { PLAN_CATALOG } from '../config/planCatalog';
import { DEFAULT_LOCALE, normalizeLocale } from '../config/locales';
import { buildLocalizedMarketingPath, buildPath } from '../config/routes';
import { useAuth } from '../hooks/useAuth';
import {
    buildBillingCheckoutPath,
    getCurrentSubscriptionSummary,
    getPaddleSubscriptionManagementUrls,
    lookupPaddleDiscount,
    previewPaddleSubscriptionUpgrade,
    applyPaddleSubscriptionUpgrade,
    startPaddleCheckoutSession,
    syncPaddleTransaction,
    type BillingApiError,
    type BillingDiscountLookup,
    type BillingSubscriptionSummary,
    type BillingUpgradePreview,
    type BillingCheckoutSource,
    type BillingCheckoutTierKey,
} from '../services/billingService';
import { resolveBillingTierDecision, resolveEffectiveBillingTierKey } from '../lib/billing/subscriptionState';
import {
    appendPaddleCheckoutContext,
    fetchPaddlePublicConfig,
    initializePaddleJs,
    isPaddleTierCheckoutConfigured,
    navigateToPaddleCheckout,
    openPaddleInlineCheckout,
    PADDLE_INLINE_FRAME_TARGET_CLASS,
    readPaddleCheckoutLocationContext,
    resolveSameOriginPaddleCheckoutPath,
    type PaddleCheckoutEvent,
    type PaddlePublicConfig,
} from '../services/paddleClient';
import { acceptCurrentTerms, getCurrentAccessContext, isSupabaseAuthNotConfiguredError } from '../services/authService';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import { updateCurrentUserProfile } from '../services/profileService';
import { registerTripGenerationCompletionWatch } from '../services/tripGenerationCompletionWatchService';
import { processQueuedTripGenerationAfterAuth } from '../services/tripGenerationQueueService';
import { cn } from '../lib/utils';
import type { AppLanguage } from '../types';

type CheckoutAuthMode = 'login' | 'register';
type CheckoutStepState = 'active' | 'complete' | 'upcoming';

interface CheckoutProfileFormState {
    firstName: string;
    lastName: string;
    country: string;
    city: string;
    preferredLanguage: AppLanguage;
}

interface CheckoutStepSectionProps {
    step: number;
    state: CheckoutStepState;
    title: string;
    children: React.ReactNode;
}

const EMPTY_FORM: CheckoutProfileFormState = {
    firstName: '',
    lastName: '',
    country: '',
    city: '',
    preferredLanguage: 'en',
};

const PAID_TIER_ORDER: BillingCheckoutTierKey[] = ['tier_mid', 'tier_premium'];

const asDisplayCount = (value: number | null, unlimitedLabel: string): string => value === null ? unlimitedLabel : String(value);
const isSafeInternalPath = (value: string | null | undefined): value is string => Boolean(value && value.startsWith('/') && !value.startsWith('//'));
const isPaidTierKey = (value: string | null | undefined): value is BillingCheckoutTierKey => value === 'tier_mid' || value === 'tier_premium';
const asTrimmedString = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const isMissingLinkedSubscriptionError = (error: unknown): boolean =>
    error instanceof Error && error.message.includes('No paid Paddle subscription is linked');
const isExistingSubscriptionCheckoutError = (error: unknown): boolean =>
    Boolean(error && typeof error === 'object' && (((error as BillingApiError).code === 'existing_paid_subscription') || ((error as BillingApiError).code === 'existing_paid_subscription_requires_refresh')));

const checkoutInputClassName = 'mt-1 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 [&:user-invalid]:border-rose-400 [&:user-invalid]:bg-rose-50 [&:user-invalid]:text-rose-900 [&:user-invalid]:focus-visible:ring-rose-200';
const checkoutFieldLabelClassName = 'text-sm font-medium text-slate-700';
const checkoutActionClassName = 'inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';
const checkoutSectionLabelClassName = 'text-xs font-semibold uppercase tracking-[0.14em] text-slate-500';

const normalizeAuthErrorCode = (error: unknown): string => {
    if (!error || typeof error !== 'object') return 'default';
    const typed = error as { code?: unknown; message?: unknown; status?: unknown };
    const rawCode = typeof typed.code === 'string' ? typed.code.trim().toLowerCase() : '';
    if (rawCode) {
        if (rawCode.includes('invalid') && rawCode.includes('credential')) return 'invalid_credentials';
        if (rawCode.includes('email') && rawCode.includes('confirm')) return 'email_not_confirmed';
        if (rawCode.includes('already')) return 'user_already_exists';
        if (rawCode.includes('cancel')) return 'oauth_cancelled';
    }

    const message = typeof typed.message === 'string' ? typed.message.toLowerCase() : '';
    if (message.includes('invalid login credentials')) return 'invalid_credentials';
    if (message.includes('email not confirmed')) return 'email_not_confirmed';
    if (message.includes('already registered')) return 'user_already_exists';
    if (message.includes('cancel')) return 'oauth_cancelled';
    if (typed.status === 400 && message.includes('invalid')) return 'invalid_credentials';
    return 'default';
};

const CheckoutStepSection: React.FC<CheckoutStepSectionProps> = ({ step, state, title, children }) => (
    <section className="border-b border-slate-200 py-8 last:border-b-0 last:pb-0 first:pt-0">
        <div className="flex items-start gap-4">
            <div
                className={cn(
                    'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                    state === 'complete'
                        ? 'bg-accent-50 text-accent-700 ring-1 ring-accent-200'
                        : state === 'active'
                            ? 'border border-slate-900 text-slate-900'
                            : 'border border-slate-300 text-slate-400'
                )}
                aria-hidden="true"
            >
                {state === 'complete' ? <CheckCircle size={28} weight="duotone" aria-hidden="true" /> : step}
            </div>
            <div className="min-w-0 flex-1">
                <h2 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h2>
                <div className="mt-5">{children}</div>
            </div>
        </div>
    </section>
);

export const CheckoutPage: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation(['pricing', 'profile', 'auth']);
    const {
        session,
        access,
        isAuthenticated,
        isLoading: isAuthLoading,
        profile,
        isProfileLoading,
        refreshAccess,
        refreshProfile,
        loginWithPassword,
        registerWithPassword,
    } = useAuth();

    const [form, setForm] = useState<CheckoutProfileFormState>(EMPTY_FORM);
    const [checkoutErrorMessage, setCheckoutErrorMessage] = useState<string | null>(null);
    const [authMode, setAuthMode] = useState<CheckoutAuthMode>('login');
    const [authEmail, setAuthEmail] = useState('');
    const [authPassword, setAuthPassword] = useState('');
    const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);
    const [authInfoMessage, setAuthInfoMessage] = useState<string | null>(null);
    const [showAuthSupportMessage, setShowAuthSupportMessage] = useState(false);
    const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
    const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
    const [paddlePublicConfig, setPaddlePublicConfig] = useState<PaddlePublicConfig | null>(null);
    const [isInlineCheckoutLoading, setIsInlineCheckoutLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isAutoAcceptingSignupTerms, setIsAutoAcceptingSignupTerms] = useState(false);
    const [hasHydratedForm, setHasHydratedForm] = useState(false);
    const [isTravelerDetailsEditing, setIsTravelerDetailsEditing] = useState(false);
    const [isTravelerDetailsSaving, setIsTravelerDetailsSaving] = useState(false);
    const [checkoutCompleted, setCheckoutCompleted] = useState(false);
    const [completedFlowMode, setCompletedFlowMode] = useState<'acquisition' | 'upgrade' | null>(null);
    const [postPaymentSyncState, setPostPaymentSyncState] = useState<'idle' | 'syncing' | 'synced' | 'delayed'>('idle');
    const [postPaymentTripId, setPostPaymentTripId] = useState<string | null>(null);
    const [postPaymentClaimState, setPostPaymentClaimState] = useState<'idle' | 'processing' | 'ready' | 'error'>('idle');
    const [postPaymentClaimErrorMessage, setPostPaymentClaimErrorMessage] = useState<string | null>(null);
    const [subscriptionSummary, setSubscriptionSummary] = useState<BillingSubscriptionSummary | null>(null);
    const [isSubscriptionSummaryLoading, setIsSubscriptionSummaryLoading] = useState(false);
    const [upgradePreview, setUpgradePreview] = useState<BillingUpgradePreview | null>(null);
    const [isUpgradePreviewLoading, setIsUpgradePreviewLoading] = useState(false);
    const [isUpgradeSubmitting, setIsUpgradeSubmitting] = useState(false);
    const [isBillingManagementLoading, setIsBillingManagementLoading] = useState(false);
    const [discountLookup, setDiscountLookup] = useState<BillingDiscountLookup | null>(null);
    const [discountInput, setDiscountInput] = useState('');
    const inlineCheckoutSectionRef = useRef<HTMLDivElement | null>(null);
    const claimProcessingRequestIdRef = useRef<string | null>(null);
    const autoStartedCheckoutKeyRef = useRef<string | null>(null);
    const travelerDetailsInitializedRef = useRef(false);
    const openedInlineTransactionRef = useRef<string | null>(null);
    const billingRepairAttemptedRef = useRef(false);

    const activeLocale = useMemo(
        () => normalizeLocale(i18n.resolvedLanguage ?? i18n.language ?? DEFAULT_LOCALE),
        [i18n.language, i18n.resolvedLanguage],
    );
    const checkoutLocationContext = useMemo(
        () => readPaddleCheckoutLocationContext(location.search),
        [location.search],
    );
    const selectedTierKey = isPaidTierKey(checkoutLocationContext.tierKey)
        ? checkoutLocationContext.tierKey
        : 'tier_mid';
    const selectedTier = PLAN_CATALOG[selectedTierKey];
    const source = (checkoutLocationContext.source || 'checkout_page') as BillingCheckoutSource | string;
    const isEligibleAccount = isAuthenticated && access?.isAnonymous !== true;
    const currentPaidTierKey = resolveEffectiveBillingTierKey({
        currentTierKey: access?.tierKey === 'tier_mid' || access?.tierKey === 'tier_premium'
            ? access.tierKey
            : 'tier_free',
        subscription: subscriptionSummary,
        priceIds: paddlePublicConfig?.priceIds,
    });
    const billingDecision = useMemo(() => (
        isEligibleAccount
            ? resolveBillingTierDecision({
                currentTierKey: currentPaidTierKey,
                targetTierKey: selectedTierKey,
                subscription: subscriptionSummary,
            })
            : null
    ), [currentPaidTierKey, isEligibleAccount, selectedTierKey, subscriptionSummary]);
    const isUpgradeFlow = Boolean(isEligibleAccount && currentPaidTierKey !== 'tier_free' && billingDecision?.action === 'upgrade');
    const isCurrentPlanFlow = Boolean(isEligibleAccount && currentPaidTierKey !== 'tier_free' && billingDecision?.action === 'current');
    const isManageOnlyFlow = Boolean(isEligibleAccount && currentPaidTierKey !== 'tier_free' && billingDecision?.action === 'manage');
    const hasInlineCheckout = Boolean(checkoutLocationContext.transactionId);
    const supportsSelectedTier = isPaddleTierCheckoutConfigured(paddlePublicConfig, selectedTierKey);
    const fromTripCheckout = source === 'trip_paywall_strip' || source === 'trip_paywall_overlay';
    const fallbackReturnTo = checkoutLocationContext.tripId
        ? buildPath('tripDetail', { tripId: checkoutLocationContext.tripId })
        : buildPath('pricing');
    const returnToPath = isSafeInternalPath(checkoutLocationContext.returnTo)
        ? checkoutLocationContext.returnTo
        : fallbackReturnTo;
    const backLabel = fromTripCheckout
        ? t('checkout.backToTrip', { ns: 'pricing' })
        : t('checkout.backToPricing', { ns: 'pricing' });
    const currentStep = hasInlineCheckout ? 3 : isEligibleAccount ? 2 : 1;
    const accountEmail = asTrimmedString(session?.user?.email);
    const travelerDetailsValid = Boolean(
        form.firstName.trim()
        && form.lastName.trim()
        && form.country.trim()
        && form.city.trim()
    );
    const travelerDetailsLocked = isEligibleAccount && travelerDetailsValid && !isTravelerDetailsEditing;
    const hasPendingSignupTermsAcceptance = new URLSearchParams(location.search).get('signup_accept_terms') === '1';
    const checkoutRedirectTo = typeof window !== 'undefined'
        ? window.location.href
        : `${location.pathname}${location.search}${location.hash}`;
    const termsPath = useMemo(() => buildLocalizedMarketingPath('terms', activeLocale), [activeLocale]);
    const privacyPath = useMemo(() => buildLocalizedMarketingPath('privacy', activeLocale), [activeLocale]);
    const contactPath = useMemo(() => buildLocalizedMarketingPath('contact', activeLocale), [activeLocale]);
    const unlimitedLabel = t('shared.unlimited', { ns: 'pricing' });
    const noExpiryLabel = t('shared.noExpiry', { ns: 'pricing' });
    const enabledLabel = t('shared.enabled', { ns: 'pricing' });
    const disabledLabel = t('shared.disabled', { ns: 'pricing' });
    const profileActionPath = buildPath('profileSettings');
    const createTripPath = buildPath('createTrip');

    const loadSubscriptionSummaryWithRetry = useCallback(async (): Promise<BillingSubscriptionSummary | null> => {
        for (let attempt = 0; attempt < 3; attempt += 1) {
            const summary = await getCurrentSubscriptionSummary();
            if (summary) {
                return summary;
            }
            if (attempt < 2) {
                await new Promise((resolve) => window.setTimeout(resolve, 250 * (attempt + 1)));
            }
        }
        return null;
    }, []);

    const resolveTierFeatures = useCallback((tierKey: BillingCheckoutTierKey) => {
        const tier = PLAN_CATALOG[tierKey];
        const interpolationValues = {
            maxActiveTripsLabel: asDisplayCount(tier.entitlements.maxActiveTrips, unlimitedLabel),
            maxTotalTripsLabel: asDisplayCount(tier.entitlements.maxTotalTrips, unlimitedLabel),
            tripExpirationLabel: tier.entitlements.tripExpirationDays === null
                ? noExpiryLabel
                : t('shared.days', { ns: 'pricing', count: tier.entitlements.tripExpirationDays }),
            sharingLabel: tier.entitlements.canShare ? enabledLabel : disabledLabel,
            editableSharesLabel: tier.entitlements.canCreateEditableShares ? enabledLabel : disabledLabel,
            proCreationLabel: tier.entitlements.canCreateProTrips ? enabledLabel : disabledLabel,
        };
        const featureTemplates = t(`tiers.${tier.publicSlug}.features`, {
            ns: 'pricing',
            returnObjects: true,
        }) as unknown;
        return Array.isArray(featureTemplates)
            ? featureTemplates.map((_, index) => t(`tiers.${tier.publicSlug}.features.${index}`, {
                ns: 'pricing',
                ...interpolationValues,
            }))
            : [];
    }, [disabledLabel, enabledLabel, noExpiryLabel, t, unlimitedLabel]);

    useEffect(() => {
        setForm({
            firstName: profile?.firstName || '',
            lastName: profile?.lastName || '',
            country: profile?.country || '',
            city: profile?.city || '',
            preferredLanguage: normalizeLocale(profile?.preferredLanguage || activeLocale),
        });
        setHasHydratedForm(true);
    }, [activeLocale, profile]);

    useEffect(() => {
        if (isEligibleAccount) return;
        if (authEmail.trim()) return;
        const fallbackEmail = accountEmail || asTrimmedString(access?.email) || '';
        if (!fallbackEmail) return;
        setAuthEmail(fallbackEmail);
    }, [access?.email, accountEmail, authEmail, isEligibleAccount]);

    useEffect(() => {
        travelerDetailsInitializedRef.current = false;
        autoStartedCheckoutKeyRef.current = null;
    }, [checkoutLocationContext.claimId, checkoutLocationContext.tripId, selectedTierKey, session?.user?.id, source]);

    useEffect(() => {
        if (!hasHydratedForm || !isEligibleAccount || travelerDetailsInitializedRef.current) return;
        setIsTravelerDetailsEditing(!travelerDetailsValid);
        travelerDetailsInitializedRef.current = true;
    }, [hasHydratedForm, isEligibleAccount, travelerDetailsValid]);

    useEffect(() => {
        setDiscountInput(checkoutLocationContext.discountCode || '');
    }, [checkoutLocationContext.discountCode]);

    useEffect(() => {
        let cancelled = false;
        void fetchPaddlePublicConfig()
            .then((config) => {
                if (cancelled) return;
                setPaddlePublicConfig(config);
            })
            .catch((error) => {
                if (cancelled) return;
                console.error('Failed to load Paddle public config for checkout.', error);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!isEligibleAccount) {
            setSubscriptionSummary(null);
            setIsSubscriptionSummaryLoading(false);
            billingRepairAttemptedRef.current = false;
            return;
        }

        let cancelled = false;
        setIsSubscriptionSummaryLoading(true);
        void (async () => {
            let summary = await loadSubscriptionSummaryWithRetry();
            if (!summary && !billingRepairAttemptedRef.current) {
                billingRepairAttemptedRef.current = true;
                try {
                    await getPaddleSubscriptionManagementUrls();
                    await refreshAccess();
                    summary = await loadSubscriptionSummaryWithRetry();
                } catch (error) {
                    if (!cancelled && !isMissingLinkedSubscriptionError(error)) {
                        console.warn('Checkout billing summary repair failed.', error);
                    }
                }
            }
            if (cancelled) return;
            setSubscriptionSummary(summary);
        })()
            .catch((error) => {
                if (cancelled) return;
                console.warn('Failed to load current subscription summary on checkout.', error);
                setSubscriptionSummary(null);
            })
            .finally(() => {
                if (!cancelled) {
                    setIsSubscriptionSummaryLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [checkoutCompleted, isEligibleAccount, loadSubscriptionSummaryWithRetry, refreshAccess]);

    useEffect(() => {
        trackEvent('checkout__page--view', {
            tier: selectedTierKey,
            source,
            has_claim: Boolean(checkoutLocationContext.claimId),
            transaction_present: hasInlineCheckout,
            authenticated: isEligibleAccount,
        });
    }, [checkoutLocationContext.claimId, hasInlineCheckout, isEligibleAccount, selectedTierKey, source]);

    useEffect(() => {
        if (!isEligibleAccount) return;
        setAuthErrorMessage(null);
        setAuthInfoMessage(null);
    }, [isEligibleAccount]);

    useEffect(() => {
        setCheckoutCompleted(false);
        setCompletedFlowMode(null);
        setPostPaymentSyncState('idle');
        setPostPaymentTripId(null);
        setPostPaymentClaimState('idle');
        setPostPaymentClaimErrorMessage(null);
        claimProcessingRequestIdRef.current = null;
        if (!checkoutLocationContext.transactionId) {
            openedInlineTransactionRef.current = null;
        }
    }, [checkoutLocationContext.transactionId]);

    useEffect(() => {
        if (!hasPendingSignupTermsAcceptance || !isEligibleAccount || isAuthLoading || !access) return;

        const cleanedParams = new URLSearchParams(location.search);
        cleanedParams.delete('signup_accept_terms');
        const cleanedSearch = cleanedParams.toString();
        const cleanedTarget = `${location.pathname}${cleanedSearch ? `?${cleanedSearch}` : ''}${location.hash || ''}`;

        if (!access.termsAcceptanceRequired) {
            navigate(cleanedTarget, { replace: true });
            return;
        }

        let cancelled = false;
        setIsAutoAcceptingSignupTerms(true);
        setCheckoutErrorMessage(null);

        void acceptCurrentTerms({
            locale: activeLocale,
            source: 'signup_checkout_email_confirmation',
        }).then(async ({ error }) => {
            if (cancelled) return;
            if (error) {
                setCheckoutErrorMessage(error.message || t('checkout.errorConfig', { ns: 'pricing' }));
                return;
            }
            try {
                await refreshAccess();
            } catch (refreshError) {
                if (!cancelled) {
                    console.warn('Checkout terms refresh failed after confirmation redirect.', refreshError);
                }
            }
            if (cancelled) return;
            navigate(cleanedTarget, { replace: true });
        }).finally(() => {
            if (!cancelled) {
                setIsAutoAcceptingSignupTerms(false);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [
        access,
        activeLocale,
        hasPendingSignupTermsAcceptance,
        isAuthLoading,
        isEligibleAccount,
        location.hash,
        location.pathname,
        location.search,
        navigate,
        refreshAccess,
        t,
    ]);

    const handlePaddleCheckoutEvent = useCallback((event: PaddleCheckoutEvent) => {
        if (typeof event.name === 'string' && event.name.startsWith('checkout.')) {
            setIsInlineCheckoutLoading(false);
        }
        if (event.name === 'checkout.completed') {
            setCheckoutCompleted(true);
            setCompletedFlowMode('acquisition');
            setPostPaymentSyncState('idle');
            setPostPaymentClaimErrorMessage(null);
            showAppToast({
                tone: 'success',
                title: t('checkout.paymentCompletedTitle', { ns: 'pricing' }),
                description: t('checkout.paymentCompletedDescription', { ns: 'pricing' }),
            });
        }
    }, [t]);

    useEffect(() => {
        if (!checkoutCompleted || completedFlowMode !== 'acquisition' || !isEligibleAccount || postPaymentSyncState !== 'idle') {
            return;
        }

        let cancelled = false;
        setPostPaymentSyncState('syncing');

        const run = async () => {
            for (let attempt = 0; attempt < 6; attempt += 1) {
                if (cancelled) return;

                if (checkoutLocationContext.transactionId && attempt < 4) {
                    try {
                        await syncPaddleTransaction(checkoutLocationContext.transactionId);
                    } catch (error) {
                        if (!cancelled) {
                            console.warn('Checkout post-payment transaction sync failed.', error);
                        }
                    }
                }

                if (attempt === 0 || attempt === 2) {
                    try {
                        await getPaddleSubscriptionManagementUrls();
                    } catch (error) {
                        if (!cancelled) {
                            console.warn('Checkout post-payment Paddle sync fallback failed.', error);
                        }
                    }
                }

                try {
                    await refreshAccess();
                } catch (error) {
                    if (!cancelled) {
                        console.warn('Checkout post-payment access refresh failed.', error);
                    }
                }

                try {
                    const refreshedSummary = await getCurrentSubscriptionSummary();
                    if (!cancelled) {
                        setSubscriptionSummary(refreshedSummary);
                    }
                } catch (error) {
                    if (!cancelled) {
                        console.warn('Checkout post-payment subscription refresh failed.', error);
                    }
                }

                try {
                    const refreshedAccess = await getCurrentAccessContext();
                    if (!cancelled && refreshedAccess.tierKey === selectedTierKey) {
                        setPostPaymentSyncState('synced');
                        return;
                    }
                } catch (error) {
                    if (!cancelled) {
                        console.warn('Checkout post-payment access snapshot failed.', error);
                    }
                }

                await new Promise((resolve) => window.setTimeout(resolve, attempt < 2 ? 900 : 1600));
            }

            if (!cancelled) {
                setPostPaymentSyncState('delayed');
            }
        };

        void run();
        return () => {
            cancelled = true;
        };
    }, [checkoutCompleted, checkoutLocationContext.transactionId, completedFlowMode, isEligibleAccount, postPaymentSyncState, refreshAccess, selectedTierKey]);

    useEffect(() => {
        const claimId = checkoutLocationContext.claimId;
        const canProcessClaim = completedFlowMode === 'upgrade' || postPaymentSyncState === 'synced';
        if (!checkoutCompleted || !claimId || !isEligibleAccount || !canProcessClaim) {
            return;
        }
        if (claimProcessingRequestIdRef.current === claimId) {
            return;
        }

        let cancelled = false;
        claimProcessingRequestIdRef.current = claimId;
        setPostPaymentClaimState('processing');
        setPostPaymentClaimErrorMessage(null);

        trackEvent('checkout__claim_trip--start', {
            tier: selectedTierKey,
            source,
        });

        void processQueuedTripGenerationAfterAuth(claimId)
            .then((result) => {
                if (cancelled) return;
                registerTripGenerationCompletionWatch(result.tripId, 'checkout_payment_completed');
                setPostPaymentTripId(result.tripId);
                setPostPaymentClaimState('ready');
                trackEvent('checkout__claim_trip--success', {
                    tier: selectedTierKey,
                    source,
                });
            })
            .catch((error) => {
                if (cancelled) return;
                const message = error instanceof Error
                    ? error.message
                    : t('checkout.successClaimError', { ns: 'pricing' });
                setPostPaymentClaimState('error');
                setPostPaymentClaimErrorMessage(message);
                trackEvent('checkout__claim_trip--failed', {
                    tier: selectedTierKey,
                    source,
                });
            });

        return () => {
            cancelled = true;
        };
    }, [checkoutCompleted, checkoutLocationContext.claimId, completedFlowMode, isEligibleAccount, postPaymentSyncState, selectedTierKey, source, t]);

    useEffect(() => {
        const transactionId = checkoutLocationContext.transactionId;
        if (!transactionId || !hasInlineCheckout || !paddlePublicConfig || paddlePublicConfig.issues.length > 0) return;
        if (openedInlineTransactionRef.current === transactionId) return;

        let cancelled = false;
        setIsInlineCheckoutLoading(true);

        void initializePaddleJs({
            environment: paddlePublicConfig.environment,
            eventCallback: handlePaddleCheckoutEvent,
            locale: activeLocale,
        }).then((ready) => {
            if (cancelled) return;
            if (!ready) {
                setIsInlineCheckoutLoading(false);
                setCheckoutErrorMessage(t('checkout.errorConfig', { ns: 'pricing' }));
                return;
            }

            const opened = openPaddleInlineCheckout({
                transactionId,
                customerEmail: accountEmail || authEmail,
                discountCode: checkoutLocationContext.discountCode,
            });

            if (!opened) {
                setIsInlineCheckoutLoading(false);
                setCheckoutErrorMessage(t('checkout.errorConfig', { ns: 'pricing' }));
                return;
            }

            openedInlineTransactionRef.current = transactionId;
            setCheckoutErrorMessage((current) => (
                current === t('checkout.errorConfig', { ns: 'pricing' }) ? null : current
            ));
        });

        return () => {
            cancelled = true;
        };
    }, [
        accountEmail,
        activeLocale,
        authEmail,
        checkoutLocationContext.discountCode,
        checkoutLocationContext.transactionId,
        handlePaddleCheckoutEvent,
        hasInlineCheckout,
        paddlePublicConfig,
        t,
    ]);

    useEffect(() => {
        if (!isUpgradeFlow) {
            setUpgradePreview(null);
            setIsUpgradePreviewLoading(false);
            return;
        }

        let cancelled = false;
        setIsUpgradePreviewLoading(true);
        setCheckoutErrorMessage(null);
        void previewPaddleSubscriptionUpgrade(selectedTierKey)
            .then((preview) => {
                if (cancelled) return;
                setUpgradePreview(preview);
            })
            .catch((error) => {
                if (cancelled) return;
                setUpgradePreview(null);
                setCheckoutErrorMessage(error instanceof Error ? error.message : t('checkout.errorConfig', { ns: 'pricing' }));
            })
            .finally(() => {
                if (!cancelled) {
                    setIsUpgradePreviewLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [isUpgradeFlow, selectedTierKey, t]);

    useEffect(() => {
        const discountCode = checkoutLocationContext.discountCode;
        if (!discountCode || !supportsSelectedTier) {
            setDiscountLookup(null);
            return;
        }

        let cancelled = false;
        void lookupPaddleDiscount(discountCode, selectedTierKey)
            .then((lookup) => {
                if (!cancelled) {
                    setDiscountLookup(lookup);
                }
            })
            .catch((error) => {
                if (!cancelled) {
                    console.warn('Checkout discount lookup failed.', error);
                    setDiscountLookup(null);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [checkoutLocationContext.discountCode, selectedTierKey, supportsSelectedTier]);

    useEffect(() => {
        if (!hasInlineCheckout || !inlineCheckoutSectionRef.current) return;
        if (typeof inlineCheckoutSectionRef.current.scrollIntoView === 'function') {
            inlineCheckoutSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [hasInlineCheckout]);

    const profileDraftDirty = useMemo(() => {
        if (!profile) {
            return Object.entries(form).some(([key, value]) => value !== EMPTY_FORM[key as keyof CheckoutProfileFormState]);
        }
        return (
            form.firstName !== (profile.firstName || '')
            || form.lastName !== (profile.lastName || '')
            || form.country !== (profile.country || '')
            || form.city !== (profile.city || '')
            || form.preferredLanguage !== normalizeLocale(profile.preferredLanguage || activeLocale)
        );
    }, [activeLocale, form, profile]);

    const planFeatures = resolveTierFeatures(selectedTierKey);
    const discountSavingsLabel = discountLookup?.estimate
        ? new Intl.NumberFormat(activeLocale, {
            style: 'currency',
            currency: discountLookup.estimate.currencyCode || 'USD',
        }).format((discountLookup.estimate.savingsAmount || 0) / 100)
        : null;
    const discountCheckoutTotalLabel = discountLookup?.estimate
        ? new Intl.NumberFormat(activeLocale, {
            style: 'currency',
            currency: discountLookup.estimate.currencyCode || 'USD',
        }).format((discountLookup.estimate.discountedAmount || 0) / 100)
        : null;
    const checkoutButtonLabel = hasInlineCheckout
        ? t('checkout.refreshPayment', { ns: 'pricing' })
        : t('checkout.continueToPayment', { ns: 'pricing' });
    const shouldShowPostPaymentTripAction = Boolean(postPaymentTripId);
    const shouldShowProfileAction = !checkoutLocationContext.claimId;
    const shouldShowTripReturnAction = !postPaymentTripId
        && Boolean(checkoutLocationContext.claimId)
        && isSafeInternalPath(returnToPath)
        && returnToPath !== buildPath('pricing');
    const shouldShowAcquisitionFlow = !isUpgradeFlow && !isCurrentPlanFlow && !isManageOnlyFlow;
    const currentPaidTierName = currentPaidTierKey !== 'tier_free'
        ? t(`tiers.${PLAN_CATALOG[currentPaidTierKey].publicSlug}.name`, { ns: 'pricing' })
        : null;
    const autoCheckoutKey = `${selectedTierKey}:${source}:${checkoutLocationContext.claimId || ''}:${checkoutLocationContext.tripId || ''}:${checkoutLocationContext.discountCode || ''}:${session?.user?.id || 'guest'}`;

    const completedPanel = checkoutCompleted ? (
        <div ref={inlineCheckoutSectionRef} className="space-y-5">
            <div className="rounded-2xl bg-emerald-50 px-6 py-6 shadow-sm ring-1 ring-emerald-100">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
                    {t('checkout.successEyebrow', { ns: 'pricing' })}
                </p>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
                    {completedFlowMode === 'upgrade'
                        ? t('checkout.upgradeCompletedTitle', { ns: 'pricing' })
                        : t('checkout.paymentCompletedTitle', { ns: 'pricing' })}
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">
                    {completedFlowMode === 'upgrade'
                        ? t('checkout.upgradeCompletedDescription', { ns: 'pricing' })
                        : t('checkout.successDescription', { ns: 'pricing' })}
                </p>

                {completedFlowMode === 'acquisition' && postPaymentSyncState === 'syncing' ? (
                    <div className="mt-5 flex items-center gap-3 rounded-xl bg-white/80 px-4 py-3 text-sm text-slate-700 ring-1 ring-emerald-100">
                        <SpinnerGap size={16} className="animate-spin text-accent-600" />
                        <span>{t('checkout.paymentSyncingMessage', { ns: 'pricing' })}</span>
                    </div>
                ) : null}

                {completedFlowMode === 'acquisition' && postPaymentSyncState === 'delayed' ? (
                    <div className="mt-5 border-s-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        <p className="font-semibold">{t('checkout.paymentSyncDelayedTitle', { ns: 'pricing' })}</p>
                        <p className="mt-1">{t('checkout.paymentSyncDelayedDescription', { ns: 'pricing' })}</p>
                    </div>
                ) : null}

                {completedFlowMode === 'acquisition' && postPaymentSyncState === 'synced' ? (
                    <div className="mt-5 rounded-xl bg-white/80 px-4 py-3 text-sm text-slate-700 ring-1 ring-emerald-100">
                        <span className="font-semibold text-emerald-800">{t('checkout.paymentSyncReadyTitle', { ns: 'pricing' })}</span>{' '}
                        {t('checkout.paymentSyncReadyDescription', { ns: 'pricing' })}
                    </div>
                ) : null}

                {postPaymentClaimState === 'processing' ? (
                    <div className="mt-5 flex items-center gap-3 rounded-xl bg-white/80 px-4 py-3 text-sm text-slate-700 ring-1 ring-emerald-100">
                        <SpinnerGap size={16} className="animate-spin text-accent-600" />
                        <span>{t('checkout.successClaimProcessing', { ns: 'pricing' })}</span>
                    </div>
                ) : null}

                {postPaymentClaimState === 'error' && postPaymentClaimErrorMessage ? (
                    <div className="mt-5 border-s-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        <p className="font-semibold">{t('checkout.successClaimNeedsAttention', { ns: 'pricing' })}</p>
                        <p className="mt-1">{postPaymentClaimErrorMessage}</p>
                    </div>
                ) : null}

                <div className="mt-6 flex flex-wrap gap-3">
                    {shouldShowPostPaymentTripAction ? (
                        <Link
                            to={buildPath('tripDetail', { tripId: postPaymentTripId! })}
                            className={cn(checkoutActionClassName, 'bg-accent-600 text-white hover:bg-accent-700')}
                            onClick={() => trackEvent('checkout__success_cta--trip', { tier: selectedTierKey, source })}
                            {...getAnalyticsDebugAttributes('checkout__success_cta--trip')}
                        >
                            <ArrowSquareOut size={18} weight="duotone" />
                            {t('checkout.successOpenTrip', { ns: 'pricing' })}
                        </Link>
                    ) : null}

                    {shouldShowTripReturnAction ? (
                        <Link
                            to={returnToPath}
                            className={cn(checkoutActionClassName, 'border border-slate-300 bg-white text-slate-900 hover:bg-slate-50')}
                            onClick={() => trackEvent('checkout__success_cta--return_trip', { tier: selectedTierKey, source })}
                            {...getAnalyticsDebugAttributes('checkout__success_cta--return_trip')}
                        >
                            <ArrowSquareOut size={18} weight="duotone" />
                            {t('checkout.successReturnToTrip', { ns: 'pricing' })}
                        </Link>
                    ) : null}

                    <Link
                        to={createTripPath}
                        className={cn(checkoutActionClassName, shouldShowPostPaymentTripAction ? 'border border-slate-300 bg-white text-slate-900 hover:bg-slate-50' : 'bg-accent-600 text-white hover:bg-accent-700')}
                        onClick={() => trackEvent('checkout__success_cta--create_trip', { tier: selectedTierKey, source })}
                        {...getAnalyticsDebugAttributes('checkout__success_cta--create_trip')}
                    >
                        <SuitcaseRolling size={18} weight="duotone" />
                        {t('checkout.successCreateTrip', { ns: 'pricing' })}
                    </Link>

                    {shouldShowProfileAction ? (
                        <Link
                            to={profileActionPath}
                            className={cn(checkoutActionClassName, 'border border-slate-300 bg-white text-slate-900 hover:bg-slate-50')}
                            onClick={() => trackEvent('checkout__success_cta--profile', { tier: selectedTierKey, source })}
                            {...getAnalyticsDebugAttributes('checkout__success_cta--profile')}
                        >
                            <UserCircle size={18} weight="duotone" />
                            {t('checkout.successOpenProfile', { ns: 'pricing' })}
                        </Link>
                    ) : null}
                </div>
            </div>
        </div>
    ) : null;

    const setField = <K extends keyof CheckoutProfileFormState>(key: K, value: CheckoutProfileFormState[K]) => {
        setForm((current) => ({ ...current, [key]: value }));
        if (checkoutErrorMessage) {
            setCheckoutErrorMessage(null);
        }
    };

    const persistTravelerDetails = useCallback(async ({ showToast = false }: { showToast?: boolean } = {}): Promise<boolean> => {
        if (!travelerDetailsValid) {
            setCheckoutErrorMessage(t('settings.errors.required', { ns: 'profile' }));
            return false;
        }

        setCheckoutErrorMessage(null);
        setIsTravelerDetailsSaving(true);

        try {
            if (profileDraftDirty) {
                await updateCurrentUserProfile({
                    firstName: form.firstName,
                    lastName: form.lastName,
                    username: profile?.usernameDisplay || profile?.username || '',
                    usernameDisplay: profile?.usernameDisplay || profile?.username || '',
                    bio: profile?.bio || '',
                    gender: profile?.gender || '',
                    country: form.country,
                    city: form.city,
                    preferredLanguage: form.preferredLanguage,
                    publicProfileEnabled: profile?.publicProfileEnabled !== false,
                    defaultPublicTripVisibility: profile?.defaultPublicTripVisibility !== false,
                    markOnboardingComplete: false,
                });
                await refreshProfile();
            }

            setIsTravelerDetailsEditing(false);

            if (showToast) {
                showAppToast({
                    tone: 'success',
                    title: t('checkout.travelerDetailsSavedTitle', { ns: 'pricing' }),
                    description: t('checkout.travelerDetailsSavedDescription', { ns: 'pricing' }),
                });
            }

            return true;
        } catch (error) {
            const message = error instanceof Error ? error.message : t('checkout.errorConfig', { ns: 'pricing' });
            setCheckoutErrorMessage(message);
            return false;
        } finally {
            setIsTravelerDetailsSaving(false);
        }
    }, [
        form.city,
        form.country,
        form.firstName,
        form.lastName,
        form.preferredLanguage,
        profile?.bio,
        profile?.defaultPublicTripVisibility,
        profile?.gender,
        profile?.publicProfileEnabled,
        profile?.username,
        profile?.usernameDisplay,
        profileDraftDirty,
        refreshProfile,
        t,
        travelerDetailsValid,
    ]);

    const repairBillingState = useCallback(async (): Promise<BillingSubscriptionSummary | null> => {
        try {
            await getPaddleSubscriptionManagementUrls();
        } catch (error) {
            if (!isMissingLinkedSubscriptionError(error)) {
                throw error;
            }
        }

        for (let attempt = 0; attempt < 3; attempt += 1) {
            try {
                await refreshAccess();
            } catch (error) {
                console.warn('Checkout billing access refresh failed.', error);
            }

            try {
                await refreshProfile();
            } catch (error) {
                console.warn('Checkout billing profile refresh failed.', error);
            }

            const refreshedSummary = await loadSubscriptionSummaryWithRetry();
            if (refreshedSummary) {
                setSubscriptionSummary(refreshedSummary);
                return refreshedSummary;
            }

            if (attempt < 2) {
                await new Promise((resolve) => window.setTimeout(resolve, 300 * (attempt + 1)));
            }
        }

        return subscriptionSummary;
    }, [loadSubscriptionSummaryWithRetry, refreshAccess, refreshProfile, subscriptionSummary]);

    const handleEditTravelerDetails = useCallback(() => {
        setCheckoutErrorMessage(null);
        setIsTravelerDetailsEditing(true);
        autoStartedCheckoutKeyRef.current = null;
        trackEvent('checkout__traveler_details--edit', {
            tier: selectedTierKey,
            source,
        });
        if (hasInlineCheckout) {
            navigate(buildBillingCheckoutPath({
                tierKey: selectedTierKey,
                source,
                claimId: checkoutLocationContext.claimId,
                returnTo: returnToPath,
                tripId: checkoutLocationContext.tripId,
                discountCode: checkoutLocationContext.discountCode,
            }), { replace: true });
        }
    }, [checkoutLocationContext.claimId, checkoutLocationContext.discountCode, checkoutLocationContext.tripId, hasInlineCheckout, navigate, returnToPath, selectedTierKey, source]);

    const handleSaveTravelerDetails = useCallback(async () => {
        trackEvent('checkout__traveler_details--save', {
            tier: selectedTierKey,
            source,
        });
        await persistTravelerDetails({ showToast: true });
    }, [persistTravelerDetails, selectedTierKey, source]);

    const handlePlanChange = (nextTierKey: string) => {
        if (!isPaidTierKey(nextTierKey) || nextTierKey === selectedTierKey) return;
        trackEvent(`checkout__plan--${PLAN_CATALOG[nextTierKey].publicSlug}`, { source });
        navigate(buildBillingCheckoutPath({
            tierKey: nextTierKey,
            source,
            claimId: checkoutLocationContext.claimId,
            returnTo: returnToPath,
            tripId: checkoutLocationContext.tripId,
            discountCode: checkoutLocationContext.discountCode,
        }));
    };

    const handleApplyVoucher = useCallback(() => {
        const normalized = discountInput.trim().toUpperCase();
        trackEvent(normalized ? 'checkout__voucher--apply' : 'checkout__voucher--clear', {
            code: normalized || null,
            tier: selectedTierKey,
            source,
        });
        navigate(buildBillingCheckoutPath({
            tierKey: selectedTierKey,
            source,
            claimId: checkoutLocationContext.claimId,
            returnTo: returnToPath,
            tripId: checkoutLocationContext.tripId,
            discountCode: normalized || null,
        }));
    }, [checkoutLocationContext.claimId, checkoutLocationContext.tripId, discountInput, navigate, returnToPath, selectedTierKey, source]);

    const handleClearVoucher = useCallback(() => {
        setDiscountInput('');
        trackEvent('checkout__voucher--clear', {
            tier: selectedTierKey,
            source,
        });
        navigate(buildBillingCheckoutPath({
            tierKey: selectedTierKey,
            source,
            claimId: checkoutLocationContext.claimId,
            returnTo: returnToPath,
            tripId: checkoutLocationContext.tripId,
        }));
    }, [checkoutLocationContext.claimId, checkoutLocationContext.tripId, navigate, returnToPath, selectedTierKey, source]);

    const handleAuthModeChange = (nextMode: CheckoutAuthMode) => {
        setAuthMode(nextMode);
        setAuthErrorMessage(null);
        setAuthInfoMessage(null);
        setShowAuthSupportMessage(false);
        if (nextMode === 'login') {
            setHasAcceptedTerms(false);
        }
        trackEvent(`checkout__auth_tab--${nextMode}`, {
            tier: selectedTierKey,
            source,
        });
    };

    const handleAccountSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (isAuthSubmitting || isAuthLoading) return;

        const trimmedEmail = authEmail.trim();
        const trimmedPassword = authPassword.trim();

        if (!trimmedEmail || !trimmedPassword) {
            setAuthErrorMessage(t('errors.default', { ns: 'auth' }));
            return;
        }
        if (authMode === 'register' && !hasAcceptedTerms) {
            setAuthErrorMessage(t('errors.terms_required', { ns: 'auth' }));
            return;
        }

        setAuthErrorMessage(null);
        setAuthInfoMessage(null);
        setShowAuthSupportMessage(false);
        setIsAuthSubmitting(true);

        try {
            if (authMode === 'login') {
                const response = await loginWithPassword(trimmedEmail, trimmedPassword);
                if (response.error) {
                    const errorCode = normalizeAuthErrorCode(response.error);
                    setAuthErrorMessage(t(`errors.${errorCode}`, { ns: 'auth', defaultValue: t('errors.default', { ns: 'auth' }) }));
                    return;
                }
                return;
            }

            const response = await registerWithPassword(trimmedEmail, trimmedPassword, {
                emailRedirectTo: (() => {
                    if (typeof window === 'undefined') return checkoutRedirectTo;
                    const redirectUrl = new URL(checkoutRedirectTo);
                    redirectUrl.searchParams.set('signup_accept_terms', '1');
                    return redirectUrl.toString();
                })(),
            });
            if (response.error) {
                const errorCode = normalizeAuthErrorCode(response.error);
                if (errorCode === 'user_already_exists') {
                    setAuthMode('login');
                    setAuthPassword('');
                    setAuthErrorMessage(null);
                    setAuthInfoMessage(t('errors.user_already_exists', { ns: 'auth', defaultValue: t('errors.default', { ns: 'auth' }) }));
                    return;
                }
                setAuthErrorMessage(t(`errors.${errorCode}`, { ns: 'auth', defaultValue: t('errors.default', { ns: 'auth' }) }));
                return;
            }
            if (!response.data.session) {
                setAuthInfoMessage(t('states.emailConfirmationSent', { ns: 'auth' }));
                return;
            }

            const acceptance = await acceptCurrentTerms({
                locale: activeLocale,
                source: 'signup_checkout_page',
            });
            if (acceptance.error) {
                setAuthInfoMessage(t('states.termsAcceptancePending', { ns: 'auth' }));
            }
        } catch (error) {
            if (isSupabaseAuthNotConfiguredError(error)) {
                setShowAuthSupportMessage(true);
                setAuthErrorMessage(null);
                setAuthInfoMessage(null);
            } else {
                setAuthErrorMessage(t('errors.default', { ns: 'auth' }));
            }
        } finally {
            setIsAuthSubmitting(false);
        }
    };

    const handleContinueToPayment = useCallback(async () => {
        if (isSubmitting) return;
        if (!paddlePublicConfig || paddlePublicConfig.issues.length > 0) {
            setCheckoutErrorMessage(t('checkout.errorConfig', { ns: 'pricing' }));
            return;
        }
        if (!supportsSelectedTier) {
            setCheckoutErrorMessage(t('checkout.errorTierUnavailable', { ns: 'pricing' }));
            return;
        }

        trackEvent('checkout__payment--start', {
            tier: selectedTierKey,
            source,
            from_trip: fromTripCheckout,
        });

        setCheckoutErrorMessage(null);
        setIsSubmitting(true);

        try {
            setCheckoutCompleted(false);
            setCompletedFlowMode(null);
            setPostPaymentTripId(null);
            setPostPaymentClaimState('idle');
            setPostPaymentClaimErrorMessage(null);
            claimProcessingRequestIdRef.current = null;
            const detailsSaved = await persistTravelerDetails({ showToast: false });
            if (!detailsSaved) {
                return;
            }

            const sessionPayload = await startPaddleCheckoutSession({
                tierKey: selectedTierKey,
                source,
                claimId: checkoutLocationContext.claimId,
                returnTo: returnToPath,
                tripId: checkoutLocationContext.tripId,
                discountCode: checkoutLocationContext.discountCode,
            });

            const checkoutUrl = appendPaddleCheckoutContext(sessionPayload.checkoutUrl, {
                tierKey: selectedTierKey,
                source,
                claimId: checkoutLocationContext.claimId,
                returnTo: returnToPath,
                tripId: checkoutLocationContext.tripId,
                discountCode: checkoutLocationContext.discountCode,
            });
            const sameOriginCheckoutPath = resolveSameOriginPaddleCheckoutPath(checkoutUrl);
            if (sameOriginCheckoutPath) {
                navigate(sameOriginCheckoutPath);
                return;
            }
            navigateToPaddleCheckout(checkoutUrl);
        } catch (error) {
            if (isExistingSubscriptionCheckoutError(error)) {
                try {
                    await repairBillingState();
                    setCheckoutErrorMessage(null);
                    return;
                } catch (repairError) {
                    console.warn('Checkout billing repair after existing-subscription guard failed.', repairError);
                }
            }
            const message = error instanceof Error ? error.message : t('checkout.errorConfig', { ns: 'pricing' });
            setCheckoutErrorMessage(message);
            showAppToast({
                tone: 'warning',
                title: t('checkout.errorTitle', { ns: 'pricing' }),
                description: message,
            });
        } finally {
            setIsSubmitting(false);
        }
    }, [
        checkoutLocationContext.claimId,
        checkoutLocationContext.discountCode,
        checkoutLocationContext.tripId,
        navigate,
        paddlePublicConfig,
        profile?.bio,
        profile?.defaultPublicTripVisibility,
        profile?.gender,
        profile?.publicProfileEnabled,
        profile?.username,
        profile?.usernameDisplay,
        profileDraftDirty,
        refreshProfile,
        returnToPath,
        selectedTierKey,
        source,
        supportsSelectedTier,
        t,
        fromTripCheckout,
        persistTravelerDetails,
        repairBillingState,
    ]);

    useEffect(() => {
        if (
            !shouldShowAcquisitionFlow
            || !isEligibleAccount
            || !hasHydratedForm
            || !travelerDetailsLocked
            || hasInlineCheckout
            || checkoutCompleted
            || isSubmitting
            || isTravelerDetailsSaving
            || isAutoAcceptingSignupTerms
            || isAuthLoading
            || isProfileLoading
            || !supportsSelectedTier
            || !paddlePublicConfig
            || paddlePublicConfig.issues.length > 0
        ) {
            return;
        }

        if (autoStartedCheckoutKeyRef.current === autoCheckoutKey) {
            return;
        }

        autoStartedCheckoutKeyRef.current = autoCheckoutKey;
        void handleContinueToPayment();
    }, [
        autoCheckoutKey,
        checkoutCompleted,
        handleContinueToPayment,
        hasHydratedForm,
        hasInlineCheckout,
        isAuthLoading,
        isAutoAcceptingSignupTerms,
        isEligibleAccount,
        isProfileLoading,
        isSubmitting,
        isTravelerDetailsSaving,
        paddlePublicConfig,
        shouldShowAcquisitionFlow,
        supportsSelectedTier,
        travelerDetailsLocked,
    ]);

    const handleOpenBillingManagement = useCallback(async (target: 'manage' | 'cancel' = 'manage') => {
        if (isBillingManagementLoading) return;
        setIsBillingManagementLoading(true);
        try {
            const managementUrls = await getPaddleSubscriptionManagementUrls();
            const destination = target === 'cancel'
                ? managementUrls.cancelUrl || managementUrls.updatePaymentMethodUrl
                : managementUrls.updatePaymentMethodUrl || managementUrls.cancelUrl;

            if (!destination) {
                throw new Error(t('checkout.manageBillingUnavailable', { ns: 'pricing' }));
            }

            trackEvent(target === 'cancel' ? 'checkout__manage_billing--cancel' : 'checkout__manage_billing--open', {
                tier: selectedTierKey,
                source,
            });
            window.location.assign(destination);
        } catch (error) {
            const message = error instanceof Error ? error.message : t('checkout.manageBillingUnavailable', { ns: 'pricing' });
            setCheckoutErrorMessage(message);
            showAppToast({
                tone: 'warning',
                title: t('checkout.errorTitle', { ns: 'pricing' }),
                description: message,
            });
        } finally {
            setIsBillingManagementLoading(false);
        }
    }, [isBillingManagementLoading, selectedTierKey, source, t]);

    const handleApplyUpgrade = useCallback(async () => {
        if (isUpgradeSubmitting) return;
        setCheckoutErrorMessage(null);
        setIsUpgradeSubmitting(true);

        try {
            setCheckoutCompleted(false);
            const result = await applyPaddleSubscriptionUpgrade({
                tierKey: selectedTierKey,
                source,
                claimId: checkoutLocationContext.claimId,
                returnTo: returnToPath,
                tripId: checkoutLocationContext.tripId,
            });
            setUpgradePreview((current) => current ? {
                ...current,
                targetTierKey: result.targetTierKey,
                recurringAmount: result.recurringAmount,
                recurringCurrency: result.recurringCurrency,
            } : current);
            setCheckoutCompleted(true);
            setCompletedFlowMode('upgrade');
            await refreshAccess();
            await refreshProfile();
            showAppToast({
                tone: 'success',
                title: t('checkout.upgradeCompletedTitle', { ns: 'pricing' }),
                description: t('checkout.upgradeCompletedDescription', { ns: 'pricing' }),
            });
            trackEvent('checkout__upgrade--success', {
                from_tier: currentPaidTierKey,
                to_tier: selectedTierKey,
                source,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : t('checkout.errorConfig', { ns: 'pricing' });
            setCheckoutErrorMessage(message);
            showAppToast({
                tone: 'warning',
                title: t('checkout.errorTitle', { ns: 'pricing' }),
                description: message,
            });
            trackEvent('checkout__upgrade--failed', {
                from_tier: currentPaidTierKey,
                to_tier: selectedTierKey,
                source,
            });
        } finally {
            setIsUpgradeSubmitting(false);
        }
    }, [
        checkoutLocationContext.claimId,
        checkoutLocationContext.tripId,
        currentPaidTierKey,
        isUpgradeSubmitting,
        refreshAccess,
        refreshProfile,
        returnToPath,
        selectedTierKey,
        source,
        t,
    ]);

    return (
        <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
            <SiteHeader hideCreateTrip />
            <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-5 pb-16 pt-8 md:px-8 md:pt-10">
                <div className="border-b border-slate-200 pb-6">
                    <Link
                        to={returnToPath}
                        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
                        onClick={() => trackEvent(fromTripCheckout ? 'checkout__return--trip' : 'checkout__return--pricing', { tier: selectedTierKey })}
                    >
                        <ArrowLeft size={14} weight="bold" />
                        {backLabel}
                    </Link>

                    <div className="mt-6 flex flex-col gap-3">
                        {fromTripCheckout ? (
                            <p className={checkoutSectionLabelClassName}>{t('checkout.tripEntryDescription', { ns: 'pricing' })}</p>
                        ) : null}
                        <h1
                            className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl"
                            style={{ fontFamily: 'var(--tf-font-heading)' }}
                        >
                            {t('checkout.eyebrow', { ns: 'pricing' })}
                        </h1>
                        <p className="text-sm text-slate-600">
                            {t(`tiers.${selectedTier.publicSlug}.name`, { ns: 'pricing' })} · ${selectedTier.monthlyPriceUsd}{t('shared.perMonth', { ns: 'pricing' })}
                        </p>
                    </div>
                </div>

                <section className="mt-8 grid gap-10 xl:gap-16 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_440px] lg:items-start">
                    <div className="order-1 min-w-0">
                        {paddlePublicConfig?.issues.length ? (
                            <div className="mb-6 border-s-4 border-rose-500 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                                <p className="font-semibold">{t('checkout.errorTitle', { ns: 'pricing' })}</p>
                                <p className="mt-1">{t('checkout.errorConfig', { ns: 'pricing' })}</p>
                            </div>
                        ) : null}

                        {shouldShowAcquisitionFlow ? (
                        <>
                        <CheckoutStepSection
                            step={1}
                            state={currentStep > 1 ? 'complete' : 'active'}
                            title={t('checkout.accountTitle', { ns: 'pricing' })}
                        >
                            {!isEligibleAccount ? (
                                <div className="w-full max-w-4xl space-y-6">
                                    <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
                                        <button
                                            type="button"
                                            onClick={() => handleAuthModeChange('login')}
                                            className={cn(
                                                'inline-flex h-9 items-center rounded-md px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2',
                                                authMode === 'login' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-900'
                                            )}
                                            {...getAnalyticsDebugAttributes('checkout__auth_tab--login')}
                                        >
                                            {t('tabs.login', { ns: 'auth' })}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleAuthModeChange('register')}
                                            className={cn(
                                                'inline-flex h-9 items-center rounded-md px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2',
                                                authMode === 'register' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-900'
                                            )}
                                            {...getAnalyticsDebugAttributes('checkout__auth_tab--register')}
                                        >
                                            {t('tabs.register', { ns: 'auth' })}
                                        </button>
                                    </div>

                                    <form className="space-y-4" onSubmit={handleAccountSubmit}>
                                        <p className="text-sm text-slate-600">{t('checkout.accountDescription', { ns: 'pricing' })}</p>

                                        <div className="grid gap-4 md:grid-cols-2">
                                            <label className="block">
                                                <span className={checkoutFieldLabelClassName}>{t('labels.email', { ns: 'auth' })}</span>
                                                <input
                                                    name="email"
                                                    type="email"
                                                    autoComplete={authMode === 'login' ? 'username' : 'email'}
                                                    inputMode="email"
                                                    autoCapitalize="none"
                                                    autoCorrect="off"
                                                    spellCheck={false}
                                                    value={authEmail}
                                                    onChange={(event) => setAuthEmail(event.target.value)}
                                                    required
                                                    className={checkoutInputClassName}
                                                />
                                            </label>
                                            <label className="block">
                                                <span className={checkoutFieldLabelClassName}>{t('labels.password', { ns: 'auth' })}</span>
                                                <input
                                                    name="password"
                                                    type="password"
                                                    autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                                                    value={authPassword}
                                                    onChange={(event) => setAuthPassword(event.target.value)}
                                                    required
                                                    minLength={8}
                                                    className={checkoutInputClassName}
                                                />
                                            </label>
                                        </div>

                                        {authMode === 'register' ? (
                                            <label className="flex items-start gap-3 text-sm text-slate-700">
                                                <Checkbox
                                                    checked={hasAcceptedTerms}
                                                    onCheckedChange={(checked) => setHasAcceptedTerms(checked === true)}
                                                    aria-label={t('errors.terms_required', { ns: 'auth' })}
                                                    className="mt-1"
                                                />
                                                <span className="leading-6">
                                                    {t('copy.termsConsentPrefix', { ns: 'auth' })}{' '}
                                                    <Link className="font-semibold text-accent-700 hover:underline" to={termsPath} target="_blank" rel="noreferrer">
                                                        {t('copy.termsConsentTerms', { ns: 'auth' })}
                                                    </Link>{' '}
                                                    {t('copy.termsConsentJoiner', { ns: 'auth' })}{' '}
                                                    <Link className="font-semibold text-accent-700 hover:underline" to={privacyPath} target="_blank" rel="noreferrer">
                                                        {t('copy.termsConsentPrivacy', { ns: 'auth' })}
                                                    </Link>
                                                    .
                                                </span>
                                            </label>
                                        ) : null}

                                        {showAuthSupportMessage ? (
                                            <div className="border-s-4 border-rose-500 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                                                <p className="font-semibold">{t('errors.auth_unavailable_title', { ns: 'auth' })}</p>
                                                <p className="mt-1">{t('errors.auth_unavailable_body', { ns: 'auth' })}</p>
                                                <Link
                                                    className="mt-3 inline-flex font-semibold text-rose-900 underline underline-offset-4"
                                                    to={contactPath}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    onClick={() => trackEvent('checkout__auth_config_error--contact', { source, tier: selectedTierKey })}
                                                    {...getAnalyticsDebugAttributes('checkout__auth_config_error--contact', { source, tier: selectedTierKey })}
                                                >
                                                    {t('actions.contactSupport', { ns: 'auth' })}
                                                </Link>
                                            </div>
                                        ) : authErrorMessage ? (
                                            <div className="border-s-4 border-rose-500 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                                                {authErrorMessage}
                                            </div>
                                        ) : null}
                                        {authInfoMessage ? (
                                            <div className="border-s-4 border-emerald-500 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                                                {authInfoMessage}
                                            </div>
                                        ) : null}

                                        <button
                                            type="submit"
                                            disabled={isAuthSubmitting || isAuthLoading}
                                            className={cn(checkoutActionClassName, 'w-full bg-accent-600 text-white hover:bg-accent-700 sm:w-auto')}
                                            {...getAnalyticsDebugAttributes(`checkout__auth--${authMode}`)}
                                        >
                                            {isAuthSubmitting ? <SpinnerGap size={16} className="animate-spin" /> : null}
                                            {isAuthSubmitting
                                                ? t('actions.submitting', { ns: 'auth' })
                                                : authMode === 'login'
                                                    ? t('actions.submitLogin', { ns: 'auth' })
                                                    : t('actions.submitRegister', { ns: 'auth' })}
                                        </button>
                                    </form>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-1 text-sm text-slate-700">
                                    <p className="font-medium text-slate-900">{accountEmail || '—'}</p>
                                    <p>{t('checkout.accountReadyDescription', { ns: 'pricing', email: accountEmail || '—' })}</p>
                                </div>
                            )}
                        </CheckoutStepSection>

                        <CheckoutStepSection
                            step={2}
                            state={hasInlineCheckout || travelerDetailsLocked ? 'complete' : isEligibleAccount ? 'active' : 'upcoming'}
                            title={t('checkout.travelerDetailsTitle', { ns: 'pricing' })}
                        >
                            {!isEligibleAccount ? (
                                <p className="text-sm text-slate-500">{t('checkout.detailsLocked', { ns: 'pricing' })}</p>
                            ) : (
                                <div className="w-full max-w-4xl space-y-6">
                                    <div className="flex items-start justify-between gap-4">
                                        <p className="text-sm text-slate-600">
                                            {travelerDetailsLocked
                                                ? t('checkout.travelerDetailsLockedDescription', { ns: 'pricing' })
                                                : t('checkout.travelerDetailsDescription', { ns: 'pricing' })}
                                        </p>
                                        {travelerDetailsLocked ? (
                                            <button
                                                type="button"
                                                onClick={handleEditTravelerDetails}
                                                className="inline-flex items-center gap-1 text-sm font-semibold text-accent-700 transition-colors hover:text-accent-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
                                                {...getAnalyticsDebugAttributes('checkout__traveler_details--edit')}
                                            >
                                                <NotePencil size={16} weight="duotone" />
                                                {t('checkout.travelerDetailsEditCta', { ns: 'pricing' })}
                                            </button>
                                        ) : null}
                                    </div>

                                    {checkoutErrorMessage ? (
                                        <div className="border-s-4 border-rose-500 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                                            {checkoutErrorMessage}
                                        </div>
                                    ) : null}

                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <label className="block">
                                            <span className={checkoutFieldLabelClassName}>{t('settings.fields.firstName', { ns: 'profile' })}</span>
                                            <input
                                                value={form.firstName}
                                                onChange={(event) => setField('firstName', event.target.value)}
                                                autoComplete="given-name"
                                                disabled={travelerDetailsLocked || isTravelerDetailsSaving}
                                                className={checkoutInputClassName}
                                            />
                                        </label>
                                        <label className="block">
                                            <span className={checkoutFieldLabelClassName}>{t('settings.fields.lastName', { ns: 'profile' })}</span>
                                            <input
                                                value={form.lastName}
                                                onChange={(event) => setField('lastName', event.target.value)}
                                                autoComplete="family-name"
                                                disabled={travelerDetailsLocked || isTravelerDetailsSaving}
                                                className={checkoutInputClassName}
                                            />
                                        </label>
                                    </div>

                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div>
                                            <span className={checkoutFieldLabelClassName}>{t('settings.fields.country', { ns: 'profile' })}</span>
                                            <ProfileCountryRegionSelect
                                                value={form.country}
                                                locale={activeLocale}
                                                disabled={travelerDetailsLocked || isSubmitting || isProfileLoading || isTravelerDetailsSaving}
                                                inputClassName="mt-1 rounded-md"
                                                placeholder={t('settings.countryRegionSearchPlaceholder', { ns: 'profile' })}
                                                emptyLabel={t('settings.countryRegionEmpty', { ns: 'profile' })}
                                                toggleLabel={t('settings.countryRegionToggle', { ns: 'profile' })}
                                                onValueChange={(nextCode) => setField('country', nextCode)}
                                            />
                                        </div>
                                        <label className="block">
                                            <span className={checkoutFieldLabelClassName}>{t('settings.fields.city', { ns: 'profile' })}</span>
                                            <input
                                                value={form.city}
                                                onChange={(event) => setField('city', event.target.value)}
                                                autoComplete="address-level2"
                                                disabled={travelerDetailsLocked || isTravelerDetailsSaving}
                                                className={checkoutInputClassName}
                                            />
                                        </label>
                                    </div>

                                    {travelerDetailsLocked ? (
                                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                                            {hasInlineCheckout
                                                ? t('checkout.travelerDetailsPaymentReady', { ns: 'pricing' })
                                                : t('checkout.travelerDetailsAutoContinue', { ns: 'pricing' })}
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap gap-3">
                                            <button
                                                type="button"
                                                disabled={isTravelerDetailsSaving || isSubmitting}
                                                onClick={() => void handleSaveTravelerDetails()}
                                                className={cn(checkoutActionClassName, 'border border-slate-300 bg-white text-slate-900 hover:bg-slate-50')}
                                                {...getAnalyticsDebugAttributes('checkout__traveler_details--save')}
                                            >
                                                {isTravelerDetailsSaving ? <SpinnerGap size={18} className="animate-spin" /> : null}
                                                {t('checkout.travelerDetailsSaveCta', { ns: 'pricing' })}
                                            </button>
                                            <button
                                                type="button"
                                                disabled={isSubmitting || isAutoAcceptingSignupTerms || !hasHydratedForm || isAuthLoading || isProfileLoading || !supportsSelectedTier || isTravelerDetailsSaving}
                                                onClick={() => void handleContinueToPayment()}
                                                className={cn(checkoutActionClassName, 'w-full bg-accent-600 text-white hover:bg-accent-700 sm:w-auto')}
                                                {...getAnalyticsDebugAttributes(hasInlineCheckout ? 'checkout__payment--refresh' : 'checkout__payment--start')}
                                            >
                                                {isSubmitting ? <SpinnerGap size={18} className="animate-spin" /> : <CreditCard size={18} weight="duotone" />}
                                                {checkoutButtonLabel}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </CheckoutStepSection>

                        <CheckoutStepSection
                            step={3}
                            state={hasInlineCheckout ? 'active' : 'upcoming'}
                            title={t('checkout.paymentTitle', { ns: 'pricing' })}
                        >
                            {!hasInlineCheckout ? (
                                <p className="text-sm text-slate-500">{t('checkout.paymentLocked', { ns: 'pricing' })}</p>
                            ) : checkoutCompleted ? (
                                completedPanel
                            ) : (
                                <div ref={inlineCheckoutSectionRef} className="space-y-5">
                                    <div className="relative overflow-hidden rounded-md border border-slate-200 bg-white">
                                        {isInlineCheckoutLoading ? (
                                            <div className="pointer-events-none absolute inset-0 z-10 bg-white/95">
                                                <div className="flex h-full flex-col gap-4 p-6">
                                                    <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                                                        <SpinnerGap size={16} className="animate-spin" />
                                                        {t('checkout.loading', { ns: 'pricing' })}
                                                    </div>
                                                    <div className="h-12 w-full animate-pulse rounded-md bg-slate-100" />
                                                    <div className="h-12 w-full animate-pulse rounded-md bg-slate-100" />
                                                    <div className="h-48 w-full animate-pulse rounded-md bg-slate-100" />
                                                    <div className="mt-auto h-12 w-full animate-pulse rounded-md bg-slate-200" />
                                                </div>
                                            </div>
                                        ) : null}
                                        <div className={`${PADDLE_INLINE_FRAME_TARGET_CLASS} min-h-[680px] w-full`} />
                                    </div>
                                </div>
                            )}
                        </CheckoutStepSection>
                        </>
                        ) : (
                        <div className="space-y-6">
                            {isSubscriptionSummaryLoading ? (
                                <div className="rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-sm">
                                    <div className="inline-flex items-center gap-3 text-sm font-medium text-slate-600">
                                        <SpinnerGap size={18} className="animate-spin" />
                                        {t('checkout.loadingSubscriptionState', { ns: 'pricing' })}
                                    </div>
                                </div>
                            ) : checkoutCompleted ? (
                                completedPanel
                            ) : isUpgradeFlow ? (
                                <CheckoutStepSection
                                    step={1}
                                    state="active"
                                    title={t('checkout.upgradeTitle', { ns: 'pricing' })}
                                >
                                    <div className="max-w-3xl space-y-6">
                                        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
                                            <p className={checkoutSectionLabelClassName}>{t('checkout.upgradeSummaryLabel', { ns: 'pricing' })}</p>
                                            <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
                                                <div>
                                                    <p className="text-sm text-slate-500">
                                                        {t('checkout.upgradeFromTo', {
                                                            ns: 'pricing',
                                                            currentPlan: currentPaidTierName || '—',
                                                            targetPlan: t(`tiers.${selectedTier.publicSlug}.name`, { ns: 'pricing' }),
                                                        })}
                                                    </p>
                                                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                                                        {t('checkout.upgradeReviewTitle', { ns: 'pricing' })}
                                                    </h2>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm text-slate-500">{t('checkout.newRecurringTotal', { ns: 'pricing' })}</p>
                                                    <p className="text-2xl font-semibold text-slate-900">
                                                        {upgradePreview?.recurringAmount !== null && upgradePreview?.recurringAmount !== undefined
                                                            ? `${upgradePreview.recurringCurrency || ''} ${(upgradePreview.recurringAmount / 100).toFixed(2)}`
                                                            : `$${selectedTier.monthlyPriceUsd.toFixed(2)}`}
                                                    </p>
                                                </div>
                                            </div>
                                            <p className="mt-4 text-sm leading-6 text-slate-600">
                                                {upgradePreview?.prorationMessage || t('checkout.upgradePreviewDescription', { ns: 'pricing' })}
                                            </p>
                                            {upgradePreview?.immediateAmount !== null && upgradePreview?.immediateAmount !== undefined ? (
                                                <div className="mt-4 rounded-xl border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-slate-700">
                                                    <span className="font-semibold text-slate-900">{t('checkout.dueNowLabel', { ns: 'pricing' })}</span>{' '}
                                                    {`${upgradePreview.immediateCurrency || ''} ${(upgradePreview.immediateAmount / 100).toFixed(2)}`}
                                                </div>
                                            ) : null}
                                        </div>

                                        {checkoutErrorMessage ? (
                                            <div className="border-s-4 border-rose-500 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                                                {checkoutErrorMessage}
                                            </div>
                                        ) : null}

                                        <div className="flex flex-wrap gap-3">
                                            <button
                                                type="button"
                                                onClick={() => void handleApplyUpgrade()}
                                                disabled={isUpgradeSubmitting || isUpgradePreviewLoading}
                                                className={cn(checkoutActionClassName, 'bg-accent-600 text-white hover:bg-accent-700')}
                                                {...getAnalyticsDebugAttributes('checkout__upgrade--confirm')}
                                            >
                                                {isUpgradeSubmitting ? <SpinnerGap size={18} className="animate-spin" /> : <CreditCard size={18} weight="duotone" />}
                                                {t('checkout.upgradeConfirmCta', { ns: 'pricing' })}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => void handleOpenBillingManagement('manage')}
                                                disabled={isBillingManagementLoading}
                                                className={cn(checkoutActionClassName, 'border border-slate-300 bg-white text-slate-900 hover:bg-slate-50')}
                                                {...getAnalyticsDebugAttributes('checkout__upgrade--manage_billing')}
                                            >
                                                {isBillingManagementLoading ? <SpinnerGap size={18} className="animate-spin" /> : <ArrowSquareOut size={18} weight="duotone" />}
                                                {t('checkout.manageBillingCta', { ns: 'pricing' })}
                                            </button>
                                        </div>
                                    </div>
                                </CheckoutStepSection>
                            ) : (
                                <CheckoutStepSection
                                    step={1}
                                    state="active"
                                    title={isCurrentPlanFlow
                                        ? t('checkout.currentPlanTitle', { ns: 'pricing' })
                                        : t('checkout.manageBillingTitle', { ns: 'pricing' })}
                                >
                                    <div className="max-w-3xl space-y-5">
                                        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
                                            <p className="text-sm leading-6 text-slate-600">
                                                {isCurrentPlanFlow
                                                    ? t('checkout.currentPlanDescription', {
                                                        ns: 'pricing',
                                                        planName: currentPaidTierName || t(`tiers.${selectedTier.publicSlug}.name`, { ns: 'pricing' }),
                                                    })
                                                    : t('checkout.manageBillingDescription', { ns: 'pricing' })}
                                            </p>
                                            {subscriptionSummary?.currentPeriodEnd ? (
                                                <p className="mt-3 text-sm text-slate-500">
                                                    {t('checkout.renewalDateLabel', { ns: 'pricing' })}: {new Date(subscriptionSummary.currentPeriodEnd).toLocaleDateString()}
                                                </p>
                                            ) : null}
                                        </div>

                                        <div className="flex flex-wrap gap-3">
                                            {isCurrentPlanFlow ? (
                                                <button
                                                    type="button"
                                                    disabled
                                                    className={cn(checkoutActionClassName, 'cursor-not-allowed border border-accent-200 bg-accent-50 text-accent-700')}
                                                >
                                                    {t('checkout.currentPlanCta', { ns: 'pricing' })}
                                                </button>
                                            ) : null}
                                            <button
                                                type="button"
                                                onClick={() => void handleOpenBillingManagement('manage')}
                                                disabled={isBillingManagementLoading}
                                                className={cn(checkoutActionClassName, 'bg-accent-600 text-white hover:bg-accent-700')}
                                                {...getAnalyticsDebugAttributes('checkout__manage_billing--cta')}
                                            >
                                                {isBillingManagementLoading ? <SpinnerGap size={18} className="animate-spin" /> : <ArrowSquareOut size={18} weight="duotone" />}
                                                {t('checkout.manageBillingCta', { ns: 'pricing' })}
                                            </button>
                                        </div>
                                    </div>
                                </CheckoutStepSection>
                            )}
                        </div>
                        )}
                    </div>

                    <aside className="order-2 lg:order-2">
                        <div className="lg:sticky lg:top-28">
                            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
                                <section className="space-y-4">
                                <p className={checkoutSectionLabelClassName}>{t('checkout.planSummaryTitle', { ns: 'pricing' })}</p>
                                <div className="border-b border-slate-200">
                                    <div className="-mb-px flex items-center gap-8">
                                        {PAID_TIER_ORDER.map((tierKey) => {
                                            const tier = PLAN_CATALOG[tierKey];
                                            const tierAvailable = isPaddleTierCheckoutConfigured(paddlePublicConfig, tierKey);
                                            const isActive = tierKey === selectedTierKey;
                                            return (
                                                <button
                                                    key={tierKey}
                                                    type="button"
                                                    onClick={() => handlePlanChange(tierKey)}
                                                    disabled={Boolean(paddlePublicConfig) && !tierAvailable}
                                                    className={cn(
                                                        'inline-flex h-11 appearance-none cursor-pointer items-center whitespace-nowrap border-0 border-b-2 bg-transparent px-0 pb-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed',
                                                        isActive
                                                            ? 'border-accent-600 text-accent-700'
                                                            : 'border-transparent text-slate-400 hover:text-slate-900',
                                                        Boolean(paddlePublicConfig) && !tierAvailable ? 'text-slate-300 hover:text-slate-300' : null,
                                                    )}
                                                    aria-pressed={isActive}
                                                    {...getAnalyticsDebugAttributes(`checkout__plan--${tier.publicSlug}`)}
                                                >
                                                    {t(`tiers.${tier.publicSlug}.name`, { ns: 'pricing' })}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="flex items-end justify-between gap-4 border-b border-slate-200 pb-5">
                                    <div>
                                        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{t(`tiers.${selectedTier.publicSlug}.name`, { ns: 'pricing' })}</h2>
                                        <p className="mt-1 text-sm text-slate-600">{t(`tiers.${selectedTier.publicSlug}.description`, { ns: 'pricing' })}</p>
                                    </div>
                                    <div className="shrink-0 text-right">
                                        <div className="text-3xl font-semibold tracking-tight text-slate-900">${selectedTier.monthlyPriceUsd}</div>
                                        <div className="text-sm text-slate-500">{t('shared.perMonth', { ns: 'pricing' })}</div>
                                    </div>
                                </div>
                                </section>

                                <section className="mt-8">
                                    <p className={checkoutSectionLabelClassName}>{t('checkout.whatsIncluded', { ns: 'pricing' })}</p>
                                    <ul className="mt-4 space-y-3">
                                        {planFeatures.map((feature) => (
                                            <li key={feature} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                                                <Check size={16} weight="bold" className="mt-1 shrink-0 text-accent-600" />
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </section>

                                {shouldShowAcquisitionFlow ? (
                                    <section className="mt-8 border-t border-slate-200 pt-4">
                                        <p className={checkoutSectionLabelClassName}>{t('voucher.eyebrow', { ns: 'pricing' })}</p>
                                        <p className="mt-2 text-sm text-slate-600">{t('voucher.description', { ns: 'pricing' })}</p>
                                        <div className="mt-4 flex flex-col gap-3">
                                            <div className="flex gap-3">
                                                <input
                                                    type="text"
                                                    value={discountInput}
                                                    onChange={(event) => setDiscountInput(event.target.value.toUpperCase())}
                                                    placeholder={t('voucher.placeholder', { ns: 'pricing' })}
                                                    autoCapitalize="characters"
                                                    className="h-11 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleApplyVoucher}
                                                    className={cn(checkoutActionClassName, 'shrink-0 bg-accent-600 text-white hover:bg-accent-700')}
                                                    {...getAnalyticsDebugAttributes('checkout__voucher--apply')}
                                                >
                                                    {t('voucher.applyCta', { ns: 'pricing' })}
                                                </button>
                                            </div>
                                            {checkoutLocationContext.discountCode ? (
                                                <button
                                                    type="button"
                                                    onClick={handleClearVoucher}
                                                    className="self-start text-sm font-semibold text-slate-500 transition-colors hover:text-slate-900"
                                                    {...getAnalyticsDebugAttributes('checkout__voucher--clear')}
                                                >
                                                    {t('voucher.clearCta', { ns: 'pricing' })}
                                                </button>
                                            ) : null}
                                        </div>
                                        {discountLookup?.applicableToTier && discountLookup.estimate && discountSavingsLabel && discountCheckoutTotalLabel ? (
                                            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                                                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
                                                    {t('voucher.appliedEyebrow', { ns: 'pricing', code: discountLookup.code })}
                                                </p>
                                                <p className="mt-2 text-sm font-medium text-emerald-900">
                                                    {t('voucher.checkoutSavingsMessage', {
                                                        ns: 'pricing',
                                                        savings: discountSavingsLabel,
                                                        discounted: discountCheckoutTotalLabel,
                                                    })}
                                                </p>
                                            </div>
                                        ) : null}
                                    </section>
                                ) : null}

                                <p className="mt-8 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">
                                    {t('checkout.planSummaryBilling', { ns: 'pricing' })}
                                </p>
                            </div>
                        </div>
                    </aside>
                </section>
            </main>
            <SiteFooter />
        </div>
    );
};
