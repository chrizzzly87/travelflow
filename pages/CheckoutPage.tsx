import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, CheckCircle, CreditCard, SpinnerGap } from '@phosphor-icons/react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { SiteHeader } from '../components/navigation/SiteHeader';
import { SiteFooter } from '../components/marketing/SiteFooter';
import { ProfileCountryRegionSelect } from '../components/profile/ProfileCountryRegionSelect';
import { Checkbox } from '../components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { showAppToast } from '../components/ui/appToast';
import { PLAN_CATALOG } from '../config/planCatalog';
import { DEFAULT_LOCALE, normalizeLocale } from '../config/locales';
import { buildLocalizedMarketingPath, buildPath } from '../config/routes';
import { useAuth } from '../hooks/useAuth';
import {
    buildBillingCheckoutPath,
    startPaddleCheckoutSession,
    type BillingCheckoutSource,
    type BillingCheckoutTierKey,
} from '../services/billingService';
import {
    appendPaddleCheckoutContext,
    fetchPaddlePublicConfig,
    initializePaddleJs,
    isPaddleTierCheckoutConfigured,
    navigateToPaddleCheckout,
    PADDLE_INLINE_FRAME_TARGET_CLASS,
    readPaddleCheckoutLocationContext,
    type PaddleCheckoutEvent,
    type PaddlePublicConfig,
} from '../services/paddleClient';
import { acceptCurrentTerms } from '../services/authService';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import { updateCurrentUserProfile } from '../services/profileService';
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

const checkoutInputClassName = 'mt-1 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';
const checkoutFieldLabelClassName = 'text-sm font-medium text-slate-700';
const checkoutActionClassName = 'inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';
const checkoutSectionLabelClassName = 'text-xs font-semibold uppercase tracking-[0.14em] text-slate-500';
const checkoutRailTabTriggerClassName = '!-mb-px !h-auto !flex-none justify-start rounded-none border-b-2 border-transparent px-0 pb-3 pt-0 text-sm font-semibold text-slate-500 after:hidden hover:text-slate-900 data-[state=active]:border-accent-600 data-[state=active]:bg-transparent data-[state=active]:text-accent-700 disabled:text-slate-300';

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
                        ? 'text-accent-600'
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
    const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
    const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
    const [paddlePublicConfig, setPaddlePublicConfig] = useState<PaddlePublicConfig | null>(null);
    const [isInlineCheckoutLoading, setIsInlineCheckoutLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isAutoAcceptingSignupTerms, setIsAutoAcceptingSignupTerms] = useState(false);
    const [hasHydratedForm, setHasHydratedForm] = useState(false);
    const [checkoutCompleted, setCheckoutCompleted] = useState(false);
    const inlineCheckoutSectionRef = useRef<HTMLDivElement | null>(null);

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
    const hasPendingSignupTermsAcceptance = new URLSearchParams(location.search).get('signup_accept_terms') === '1';
    const checkoutRedirectTo = typeof window !== 'undefined'
        ? window.location.href
        : `${location.pathname}${location.search}${location.hash}`;
    const termsPath = useMemo(() => buildLocalizedMarketingPath('terms', activeLocale), [activeLocale]);
    const privacyPath = useMemo(() => buildLocalizedMarketingPath('privacy', activeLocale), [activeLocale]);
    const unlimitedLabel = t('shared.unlimited', { ns: 'pricing' });
    const noExpiryLabel = t('shared.noExpiry', { ns: 'pricing' });
    const enabledLabel = t('shared.enabled', { ns: 'pricing' });
    const disabledLabel = t('shared.disabled', { ns: 'pricing' });

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
            await refreshAccess();
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
            showAppToast({
                tone: 'success',
                title: t('checkout.paymentCompletedTitle', { ns: 'pricing' }),
                description: t('checkout.paymentCompletedDescription', { ns: 'pricing' }),
            });
        }
    }, [t]);

    useEffect(() => {
        if (!hasInlineCheckout || !paddlePublicConfig || paddlePublicConfig.issues.length > 0) return;
        let cancelled = false;
        setIsInlineCheckoutLoading(true);
        void initializePaddleJs({
            environment: paddlePublicConfig.environment,
            eventCallback: handlePaddleCheckoutEvent,
            locale: activeLocale,
        }).then((ready) => {
            if (!ready && !cancelled) {
                setIsInlineCheckoutLoading(false);
                setCheckoutErrorMessage(t('checkout.errorConfig', { ns: 'pricing' }));
            }
        });
        return () => {
            cancelled = true;
        };
    }, [activeLocale, handlePaddleCheckoutEvent, hasInlineCheckout, paddlePublicConfig, t]);

    useEffect(() => {
        if (!hasInlineCheckout || !inlineCheckoutSectionRef.current) return;
        inlineCheckoutSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

    const setField = <K extends keyof CheckoutProfileFormState>(key: K, value: CheckoutProfileFormState[K]) => {
        setForm((current) => ({ ...current, [key]: value }));
        if (checkoutErrorMessage) {
            setCheckoutErrorMessage(null);
        }
    };

    const handlePlanChange = (nextTierKey: string) => {
        if (!isPaidTierKey(nextTierKey) || nextTierKey === selectedTierKey) return;
        trackEvent(`checkout__plan--${PLAN_CATALOG[nextTierKey].publicSlug}`, { source });
        navigate(buildBillingCheckoutPath({
            tierKey: nextTierKey,
            source,
            claimId: checkoutLocationContext.claimId,
            returnTo: returnToPath,
            tripId: checkoutLocationContext.tripId,
        }));
    };

    const handleAuthModeChange = (nextMode: CheckoutAuthMode) => {
        setAuthMode(nextMode);
        setAuthErrorMessage(null);
        setAuthInfoMessage(null);
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
        } finally {
            setIsAuthSubmitting(false);
        }
    };

    const handleContinueToPayment = async () => {
        if (isSubmitting) return;
        if (!form.firstName.trim() || !form.lastName.trim() || !form.country.trim()) {
            setCheckoutErrorMessage(t('settings.errors.required', { ns: 'profile' }));
            return;
        }
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

            const sessionPayload = await startPaddleCheckoutSession({
                tierKey: selectedTierKey,
                source,
                claimId: checkoutLocationContext.claimId,
                returnTo: returnToPath,
                tripId: checkoutLocationContext.tripId,
            });

            navigateToPaddleCheckout(appendPaddleCheckoutContext(sessionPayload.checkoutUrl, {
                tierKey: selectedTierKey,
                source,
                claimId: checkoutLocationContext.claimId,
                returnTo: returnToPath,
                tripId: checkoutLocationContext.tripId,
            }));
        } catch (error) {
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
    };

    return (
        <div className="flex min-h-screen flex-col bg-white text-slate-900">
            <SiteHeader hideCreateTrip />
            <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-16 pt-8 sm:px-6 lg:px-8">
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

                <section className="mt-8 grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
                    <div className="order-1 min-w-0">
                        {paddlePublicConfig?.issues.length ? (
                            <div className="mb-6 border-s-4 border-rose-500 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                                <p className="font-semibold">{t('checkout.errorTitle', { ns: 'pricing' })}</p>
                                <p className="mt-1">{t('checkout.errorConfig', { ns: 'pricing' })}</p>
                            </div>
                        ) : null}

                        <CheckoutStepSection
                            step={1}
                            state={currentStep > 1 ? 'complete' : 'active'}
                            title={t('checkout.accountTitle', { ns: 'pricing' })}
                        >
                            {!isEligibleAccount ? (
                                <div className="max-w-2xl space-y-5">
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

                                        {authErrorMessage ? (
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
                            state={hasInlineCheckout ? 'complete' : isEligibleAccount ? 'active' : 'upcoming'}
                            title={t('checkout.travelerDetailsTitle', { ns: 'pricing' })}
                        >
                            {!isEligibleAccount ? (
                                <p className="text-sm text-slate-500">{t('checkout.detailsLocked', { ns: 'pricing' })}</p>
                            ) : hasInlineCheckout ? (
                                <div className="flex flex-col gap-1 text-sm text-slate-700">
                                    <p className="font-medium text-slate-900">
                                        {[form.firstName, form.lastName].filter(Boolean).join(' ') || '—'}
                                    </p>
                                    <p>{[form.city, form.country].filter(Boolean).join(' · ') || '—'}</p>
                                </div>
                            ) : (
                                <div className="max-w-2xl space-y-5">
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
                                                className={checkoutInputClassName}
                                            />
                                        </label>
                                        <label className="block">
                                            <span className={checkoutFieldLabelClassName}>{t('settings.fields.lastName', { ns: 'profile' })}</span>
                                            <input
                                                value={form.lastName}
                                                onChange={(event) => setField('lastName', event.target.value)}
                                                autoComplete="family-name"
                                                className={checkoutInputClassName}
                                            />
                                        </label>
                                    </div>

                                        {isAutoAcceptingSignupTerms ? (
                                            <div className="border-s-4 border-sky-500 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                                                {t('actions.submitting', { ns: 'auth' })}
                                            </div>
                                        ) : null}

                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <div>
                                                <span className={checkoutFieldLabelClassName}>{t('settings.fields.country', { ns: 'profile' })}</span>
                                                <ProfileCountryRegionSelect
                                                value={form.country}
                                                locale={activeLocale}
                                                disabled={isSubmitting || isProfileLoading}
                                                inputClassName="mt-1 h-11 rounded-md"
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
                                                className={checkoutInputClassName}
                                            />
                                        </label>
                                    </div>

                                        <button
                                            type="button"
                                            disabled={isSubmitting || isAutoAcceptingSignupTerms || !hasHydratedForm || isAuthLoading || isProfileLoading || !supportsSelectedTier}
                                            onClick={() => void handleContinueToPayment()}
                                            className={cn(checkoutActionClassName, 'w-full bg-accent-600 text-white hover:bg-accent-700 sm:w-auto')}
                                            {...getAnalyticsDebugAttributes('checkout__payment--start')}
                                    >
                                        {isSubmitting ? <SpinnerGap size={18} className="animate-spin" /> : <CreditCard size={18} weight="duotone" />}
                                        {t('checkout.continueToPayment', { ns: 'pricing' })}
                                    </button>
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
                                    {checkoutCompleted ? (
                                        <div className="border-s-4 border-emerald-500 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                                            <p className="font-semibold">{t('checkout.paymentCompletedTitle', { ns: 'pricing' })}</p>
                                            <p className="mt-1">{t('checkout.paymentCompletedDescription', { ns: 'pricing' })}</p>
                                        </div>
                                    ) : null}
                                </div>
                            )}
                        </CheckoutStepSection>
                    </div>

                    <aside className="order-2 border-t border-slate-200 pt-8 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
                        <div className="space-y-8 lg:sticky lg:top-24">
                            <section className="space-y-4">
                                <p className={checkoutSectionLabelClassName}>{t('checkout.planSummaryTitle', { ns: 'pricing' })}</p>
                                <Tabs value={selectedTierKey} onValueChange={handlePlanChange} className="gap-4">
                                    <TabsList variant="line" className="h-auto w-full justify-start gap-6 border-b border-slate-200 p-0">
                                        {PAID_TIER_ORDER.map((tierKey) => {
                                            const tier = PLAN_CATALOG[tierKey];
                                            const tierAvailable = isPaddleTierCheckoutConfigured(paddlePublicConfig, tierKey);
                                            return (
                                                <TabsTrigger
                                                    key={tierKey}
                                                    value={tierKey}
                                                    disabled={Boolean(paddlePublicConfig) && !tierAvailable}
                                                    className={checkoutRailTabTriggerClassName}
                                                >
                                                    {t(`tiers.${tier.publicSlug}.name`, { ns: 'pricing' })}
                                                </TabsTrigger>
                                            );
                                        })}
                                    </TabsList>
                                </Tabs>

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

                            <section>
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

                            <p className="border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">
                                {t('checkout.planSummaryBilling', { ns: 'pricing' })}
                            </p>
                        </div>
                    </aside>
                </section>
            </main>
            <SiteFooter />
        </div>
    );
};
