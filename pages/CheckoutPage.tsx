import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ArrowLeft,
    ArrowRight,
    Check,
    CreditCard,
    GlobeHemisphereWest,
    ShieldCheck,
    SpinnerGap,
} from '@phosphor-icons/react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { SiteHeader } from '../components/navigation/SiteHeader';
import { SiteFooter } from '../components/marketing/SiteFooter';
import { ProfileCountryRegionSelect } from '../components/profile/ProfileCountryRegionSelect';
import { FlagIcon } from '../components/flags/FlagIcon';
import { Switch } from '../components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger } from '../components/ui/select';
import { showAppToast } from '../components/ui/appToast';
import { PLAN_CATALOG } from '../config/planCatalog';
import {
    DEFAULT_LOCALE,
    LOCALE_DROPDOWN_ORDER,
    LOCALE_FLAGS,
    LOCALE_LABELS,
    normalizeLocale,
} from '../config/locales';
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
    extractPaddleCheckoutItemName,
    fetchPaddlePublicConfig,
    initializePaddleJs,
    isPaddleTierCheckoutConfigured,
    navigateToPaddleCheckout,
    PADDLE_INLINE_FRAME_TARGET_CLASS,
    readPaddleCheckoutLocationContext,
    type PaddleCheckoutEvent,
    type PaddlePublicConfig,
} from '../services/paddleClient';
import { updateCurrentUserProfile } from '../services/profileService';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import { cn } from '../lib/utils';
import type { AppLanguage } from '../types';

interface CheckoutProfileFormState {
    firstName: string;
    lastName: string;
    bio: string;
    country: string;
    city: string;
    preferredLanguage: AppLanguage;
    publicProfileEnabled: boolean;
    defaultPublicTripVisibility: boolean;
}

const EMPTY_FORM: CheckoutProfileFormState = {
    firstName: '',
    lastName: '',
    bio: '',
    country: '',
    city: '',
    preferredLanguage: 'en',
    publicProfileEnabled: true,
    defaultPublicTripVisibility: true,
};

const PAID_TIER_ORDER: BillingCheckoutTierKey[] = ['tier_mid', 'tier_premium'];
const PROFILE_FIELD_PROGRESS_KEYS: Array<keyof CheckoutProfileFormState> = [
    'firstName',
    'lastName',
    'country',
    'city',
    'preferredLanguage',
    'bio',
];

const clampBio = (value: string): string => value.slice(0, 160);
const asDisplayCount = (value: number | null, unlimitedLabel: string): string => value === null ? unlimitedLabel : String(value);
const isSafeInternalPath = (value: string | null | undefined): value is string => Boolean(value && value.startsWith('/') && !value.startsWith('//'));
const isPaidTierKey = (value: string | null | undefined): value is BillingCheckoutTierKey => value === 'tier_mid' || value === 'tier_premium';
const checkoutInputClassName = 'h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';
const checkoutTextareaClassName = 'min-h-28 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';
const checkoutSectionLabelClassName = 'text-xs font-semibold uppercase tracking-[0.14em] text-slate-500';
const checkoutActionClassName = 'inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

export const CheckoutPage: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation(['pricing', 'profile', 'auth']);
    const {
        access,
        isAuthenticated,
        isLoading: isAuthLoading,
        profile,
        isProfileLoading,
        refreshProfile,
    } = useAuth();

    const [form, setForm] = useState<CheckoutProfileFormState>(EMPTY_FORM);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [paddlePublicConfig, setPaddlePublicConfig] = useState<PaddlePublicConfig | null>(null);
    const [inlineCheckoutItemName, setInlineCheckoutItemName] = useState<string | null>(null);
    const [isInlineCheckoutLoading, setIsInlineCheckoutLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
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
    const fallbackReturnTo = checkoutLocationContext.tripId
        ? buildPath('tripDetail', { tripId: checkoutLocationContext.tripId })
        : buildPath('pricing');
    const returnToPath = isSafeInternalPath(checkoutLocationContext.returnTo)
        ? checkoutLocationContext.returnTo
        : fallbackReturnTo;
    const loginTarget = useMemo(() => {
        const query = new URLSearchParams();
        query.set('next', `${location.pathname}${location.search}${location.hash}`);
        if (checkoutLocationContext.claimId) {
            query.set('claim', checkoutLocationContext.claimId);
        }
        return `${buildLocalizedMarketingPath('login', activeLocale)}?${query.toString()}`;
    }, [activeLocale, checkoutLocationContext.claimId, location.hash, location.pathname, location.search]);
    const source = (checkoutLocationContext.source || 'checkout_page') as BillingCheckoutSource | string;
    const isEligibleAccount = isAuthenticated && access?.isAnonymous !== true;
    const supportsSelectedTier = isPaddleTierCheckoutConfigured(paddlePublicConfig, selectedTierKey);
    const hasInlineCheckout = Boolean(checkoutLocationContext.transactionId);
    const progressCount = PROFILE_FIELD_PROGRESS_KEYS.filter((key) => {
        const value = form[key];
        return typeof value === 'string' ? Boolean(value.trim()) : Boolean(value);
    }).length;
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
            bio: clampBio(profile?.bio || ''),
            country: profile?.country || '',
            city: profile?.city || '',
            preferredLanguage: normalizeLocale(profile?.preferredLanguage || activeLocale),
            publicProfileEnabled: profile?.publicProfileEnabled !== false,
            defaultPublicTripVisibility: profile?.defaultPublicTripVisibility !== false,
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

    const handlePaddleCheckoutEvent = useCallback((event: PaddleCheckoutEvent) => {
        const itemName = extractPaddleCheckoutItemName(event);
        if (itemName) {
            setInlineCheckoutItemName(itemName);
        }
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
                setErrorMessage(t('checkout.errorConfig', { ns: 'pricing' }));
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
            return Object.entries(form).some(([key, value]) => {
                const emptyValue = EMPTY_FORM[key as keyof CheckoutProfileFormState];
                return value !== emptyValue;
            });
        }
        return (
            form.firstName !== (profile.firstName || '')
            || form.lastName !== (profile.lastName || '')
            || form.bio !== clampBio(profile.bio || '')
            || form.country !== (profile.country || '')
            || form.city !== (profile.city || '')
            || form.preferredLanguage !== normalizeLocale(profile.preferredLanguage || activeLocale)
            || form.publicProfileEnabled !== (profile.publicProfileEnabled !== false)
            || form.defaultPublicTripVisibility !== (profile.defaultPublicTripVisibility !== false)
        );
    }, [activeLocale, form, profile]);

    const setField = <K extends keyof CheckoutProfileFormState>(key: K, value: CheckoutProfileFormState[K]) => {
        setForm((current) => ({ ...current, [key]: value }));
        if (errorMessage) {
            setErrorMessage(null);
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

    const handleContinueToPayment = async () => {
        if (isSubmitting) return;
        if (!form.firstName.trim() || !form.lastName.trim() || !form.country || !form.city.trim() || !form.preferredLanguage) {
            setErrorMessage(t('settings.errors.required', { ns: 'profile' }));
            return;
        }
        if (!paddlePublicConfig || paddlePublicConfig.issues.length > 0) {
            setErrorMessage(t('checkout.errorConfig', { ns: 'pricing' }));
            return;
        }
        if (!supportsSelectedTier) {
            setErrorMessage(t('checkout.errorTierUnavailable', { ns: 'pricing' }));
            return;
        }

        trackEvent('checkout__payment--start', {
            tier: selectedTierKey,
            source,
            from_trip: source === 'trip_paywall_strip' || source === 'trip_paywall_overlay',
        });
        setErrorMessage(null);
        setIsSubmitting(true);

        try {
            if (profileDraftDirty) {
                trackEvent('checkout__profile--save', {
                    tier: selectedTierKey,
                    source,
                    progress: progressCount,
                });
                await updateCurrentUserProfile({
                    firstName: form.firstName,
                    lastName: form.lastName,
                    username: profile?.usernameDisplay || profile?.username || '',
                    usernameDisplay: profile?.usernameDisplay || profile?.username || '',
                    bio: form.bio,
                    gender: profile?.gender || '',
                    country: form.country,
                    city: form.city,
                    preferredLanguage: form.preferredLanguage,
                    publicProfileEnabled: form.publicProfileEnabled,
                    defaultPublicTripVisibility: form.defaultPublicTripVisibility,
                    markOnboardingComplete: false,
                });
                await refreshProfile();
            }

            const session = await startPaddleCheckoutSession({
                tierKey: selectedTierKey,
                source,
                claimId: checkoutLocationContext.claimId,
                returnTo: returnToPath,
                tripId: checkoutLocationContext.tripId,
            });
            navigateToPaddleCheckout(appendPaddleCheckoutContext(session.checkoutUrl, {
                tierKey: selectedTierKey,
                source,
                claimId: checkoutLocationContext.claimId,
                returnTo: returnToPath,
                tripId: checkoutLocationContext.tripId,
            }));
        } catch (error) {
            const message = error instanceof Error ? error.message : t('checkout.errorConfig', { ns: 'pricing' });
            setErrorMessage(message);
            showAppToast({
                tone: 'warning',
                title: t('checkout.errorTitle', { ns: 'pricing' }),
                description: message,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const frameTitle = inlineCheckoutItemName || t(`tiers.${selectedTier.publicSlug}.name`, { ns: 'pricing' });
    const planFeatures = resolveTierFeatures(selectedTierKey);
    const fromTripCheckout = source === 'trip_paywall_strip' || source === 'trip_paywall_overlay';
    const backLabel = fromTripCheckout
        ? t('checkout.backToTrip', { ns: 'pricing' })
        : t('checkout.backToPricing', { ns: 'pricing' });

    return (
        <div className="flex min-h-screen flex-col bg-white text-slate-900">
            <SiteHeader hideCreateTrip />
            <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-16 pt-8 sm:px-6 lg:px-8">
                <div className="border-b border-slate-200 pb-4">
                    <Link
                        to={returnToPath}
                        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
                        onClick={() => trackEvent(fromTripCheckout ? 'checkout__return--trip' : 'checkout__return--pricing', { tier: selectedTierKey })}
                    >
                        <ArrowLeft size={14} weight="bold" />
                        {backLabel}
                    </Link>
                </div>

                <section className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
                    <div className="order-2 space-y-8 lg:order-1">
                        <header className="border-b border-slate-200 pb-6">
                            <p className={checkoutSectionLabelClassName}>
                                {fromTripCheckout
                                    ? t('checkout.tripEntryDescription', { ns: 'pricing' })
                                    : t(`tiers.${selectedTier.publicSlug}.badge`, { ns: 'pricing' })}
                            </p>
                            <h1
                                className="mt-3 text-3xl font-black tracking-tight text-slate-900 sm:text-[2.5rem]"
                                style={{ fontFamily: 'var(--tf-font-heading)' }}
                            >
                                {t('checkout.eyebrow', { ns: 'pricing' })}
                            </h1>
                            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                                {t('checkout.summaryLead', {
                                    ns: 'pricing',
                                    tierName: t(`tiers.${selectedTier.publicSlug}.name`, { ns: 'pricing' }),
                                })}
                            </p>
                        </header>

                        {paddlePublicConfig?.issues.length ? (
                            <div className="border-s-4 border-rose-500 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                                <p className="font-semibold">{t('checkout.errorTitle', { ns: 'pricing' })}</p>
                                <p className="mt-1">{t('checkout.errorConfig', { ns: 'pricing' })}</p>
                            </div>
                        ) : null}

                        {!isEligibleAccount && !hasInlineCheckout ? (
                            <section className="space-y-5 border-b border-slate-200 pb-8">
                                <div className="space-y-2">
                                    <p className={checkoutSectionLabelClassName}>{t('benefits.title', { ns: 'auth' })}</p>
                                    <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{t('checkout.loginTitle', { ns: 'pricing' })}</h2>
                                    <p className="text-sm leading-6 text-slate-600">{t('checkout.loginDescription', { ns: 'pricing' })}</p>
                                </div>
                                <ul className="divide-y divide-slate-200 border-y border-slate-200 text-sm text-slate-700">
                                        {(t('benefits.items', { ns: 'auth', returnObjects: true }) as string[]).map((item) => (
                                            <li key={item} className="flex items-start gap-3 py-3">
                                                <Check size={16} weight="bold" className="mt-0.5 shrink-0 text-accent-600" />
                                                <span className="leading-6">{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                    <NavLink
                                        to={loginTarget}
                                        onClick={() => trackEvent('checkout__account_gate--login', { tier: selectedTierKey, source, has_claim: Boolean(checkoutLocationContext.claimId) })}
                                        className={cn(checkoutActionClassName, 'w-full bg-accent-600 text-white hover:bg-accent-700')}
                                        {...getAnalyticsDebugAttributes('checkout__account_gate--login')}
                                    >
                                        <GlobeHemisphereWest size={16} weight="duotone" />
                                        {t('checkout.loginCta', { ns: 'pricing' })}
                                    </NavLink>
                            </section>
                        ) : hasInlineCheckout ? (
                            <section ref={inlineCheckoutSectionRef} className="space-y-5">
                                <div className="space-y-2 border-b border-slate-200 pb-6">
                                    <p className={checkoutSectionLabelClassName}>{t('checkout.paymentTitle', { ns: 'pricing' })}</p>
                                    <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{frameTitle}</h2>
                                    <p className="text-sm leading-6 text-slate-600">{t('checkout.paymentDescription', { ns: 'pricing' })}</p>
                                </div>
                                <div className="relative overflow-hidden rounded-md border border-slate-200 bg-white">
                                        {isInlineCheckoutLoading ? (
                                            <div className="pointer-events-none absolute inset-0 z-10 bg-white/95">
                                                <div className="flex h-full flex-col gap-4 p-6">
                                                    <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                                                        <SpinnerGap size={16} className="animate-spin" />
                                                        {t('checkout.loading', { ns: 'pricing' })}
                                                    </div>
                                                    <div className="h-14 w-full animate-pulse rounded-2xl bg-slate-100" />
                                                    <div className="h-14 w-full animate-pulse rounded-2xl bg-slate-100" />
                                                    <div className="h-48 w-full animate-pulse rounded-3xl bg-slate-100" />
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
                            </section>
                        ) : (
                            <section className="space-y-8">
                                <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="space-y-2">
                                        <p className={checkoutSectionLabelClassName}>{t('checkout.travelerDetailsTitle', { ns: 'pricing' })}</p>
                                        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{t('checkout.travelerDetailsHeadline', { ns: 'pricing' })}</h2>
                                        <p className="max-w-2xl text-sm leading-6 text-slate-600">{t('checkout.travelerDetailsDescription', { ns: 'pricing' })}</p>
                                    </div>
                                    <div className="sm:text-right">
                                        <div className={checkoutSectionLabelClassName}>{t('checkout.travelerDetailsProgressLabel', { ns: 'pricing' })}</div>
                                        <div className="mt-1 text-sm font-semibold text-slate-900">{t('checkout.travelerDetailsProgress', { ns: 'pricing', count: progressCount, total: PROFILE_FIELD_PROGRESS_KEYS.length })}</div>
                                    </div>
                                </div>

                                {errorMessage ? (
                                    <div className="border-s-4 border-rose-500 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                                        {errorMessage}
                                    </div>
                                ) : null}

                                <div className="grid gap-6">
                                    <section className="space-y-4">
                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <label className="space-y-1.5">
                                                <span className={checkoutSectionLabelClassName}>{t('settings.fields.firstName', { ns: 'profile' })}</span>
                                                <input
                                                    value={form.firstName}
                                                    onChange={(event) => setField('firstName', event.target.value)}
                                                    className={checkoutInputClassName}
                                                />
                                            </label>
                                            <label className="space-y-1.5">
                                                <span className={checkoutSectionLabelClassName}>{t('settings.fields.lastName', { ns: 'profile' })}</span>
                                                <input
                                                    value={form.lastName}
                                                    onChange={(event) => setField('lastName', event.target.value)}
                                                    className={checkoutInputClassName}
                                                />
                                            </label>
                                        </div>

                                        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.88fr)]">
                                            <div className="space-y-1.5">
                                                <span className={checkoutSectionLabelClassName}>{t('settings.fields.country', { ns: 'profile' })}</span>
                                                <ProfileCountryRegionSelect
                                                    value={form.country}
                                                    locale={activeLocale}
                                                    disabled={isSubmitting || isProfileLoading}
                                                    inputClassName="h-10 rounded-md"
                                                    placeholder={t('settings.countryRegionSearchPlaceholder', { ns: 'profile' })}
                                                    emptyLabel={t('settings.countryRegionEmpty', { ns: 'profile' })}
                                                    toggleLabel={t('settings.countryRegionToggle', { ns: 'profile' })}
                                                    onValueChange={(nextCode) => setField('country', nextCode)}
                                                />
                                            </div>
                                            <label className="space-y-1.5">
                                                <span className={checkoutSectionLabelClassName}>{t('settings.fields.city', { ns: 'profile' })}</span>
                                                <input
                                                    value={form.city}
                                                    onChange={(event) => setField('city', event.target.value)}
                                                    className={checkoutInputClassName}
                                                />
                                            </label>
                                        </div>

                                        <label className="space-y-1.5">
                                            <span className={checkoutSectionLabelClassName}>{t('settings.fields.preferredLanguage', { ns: 'profile' })}</span>
                                            <Select
                                                value={form.preferredLanguage}
                                                onValueChange={(value) => setField('preferredLanguage', value as AppLanguage)}
                                            >
                                                <SelectTrigger className="h-10 w-full rounded-md border-slate-300 text-sm focus:border-accent-400 focus:ring-accent-200">
                                                    <span className="inline-flex items-center gap-2">
                                                        <FlagIcon code={LOCALE_FLAGS[form.preferredLanguage]} size="sm" className="shrink-0" />
                                                        <span>{LOCALE_LABELS[form.preferredLanguage]}</span>
                                                    </span>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {LOCALE_DROPDOWN_ORDER.map((locale) => (
                                                        <SelectItem key={`checkout-language-${locale}`} value={locale} textValue={LOCALE_LABELS[locale]}>
                                                            <span className="inline-flex items-center gap-2">
                                                                <FlagIcon code={LOCALE_FLAGS[locale]} size="sm" className="shrink-0" />
                                                                <span>{LOCALE_LABELS[locale]}</span>
                                                            </span>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </label>

                                        <label className="space-y-1.5">
                                            <span className={checkoutSectionLabelClassName}>{t('settings.fields.bio', { ns: 'profile' })}</span>
                                            <textarea
                                                value={form.bio}
                                                onChange={(event) => setField('bio', clampBio(event.target.value))}
                                                rows={4}
                                                maxLength={160}
                                                className={checkoutTextareaClassName}
                                            />
                                            <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                                                <span>{t('settings.bioHelp', { ns: 'profile' })}</span>
                                                <span>{form.bio.length}/160</span>
                                            </div>
                                        </label>
                                    </section>

                                    <section className="border-t border-slate-200 pt-6">
                                        <div className="space-y-4">
                                            <div className="flex items-start justify-between gap-4 border-b border-slate-200 py-3">
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-900">{t('settings.publicProfileToggleTitle', { ns: 'profile' })}</p>
                                                    <p className="mt-1 text-xs leading-5 text-slate-600">{t('settings.publicProfileToggleDescription', { ns: 'profile' })}</p>
                                                </div>
                                                <Switch
                                                    checked={form.publicProfileEnabled}
                                                    onCheckedChange={(checked) => setField('publicProfileEnabled', Boolean(checked))}
                                                    aria-label={t('settings.publicProfileToggleTitle', { ns: 'profile' })}
                                                />
                                            </div>
                                            <div className="flex items-start justify-between gap-4 border-b border-slate-200 py-3">
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-900">{t('settings.defaultVisibilityToggleTitle', { ns: 'profile' })}</p>
                                                    <p className="mt-1 text-xs leading-5 text-slate-600">{t('settings.defaultVisibilityToggleDescription', { ns: 'profile' })}</p>
                                                </div>
                                                <Switch
                                                    checked={form.defaultPublicTripVisibility}
                                                    onCheckedChange={(checked) => setField('defaultPublicTripVisibility', Boolean(checked))}
                                                    aria-label={t('settings.defaultVisibilityToggleTitle', { ns: 'profile' })}
                                                />
                                            </div>
                                        </div>
                                    </section>

                                    <div className="border-t border-slate-200 pt-6">
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-slate-900">{t('checkout.profileSettingsTitle', { ns: 'pricing' })}</p>
                                            <p className="mt-1 text-xs leading-5 text-slate-600">{t('checkout.profileSettingsDescription', { ns: 'pricing' })}</p>
                                        </div>
                                        <NavLink
                                            to={buildPath('profileSettings')}
                                            className="inline-flex items-center gap-2 text-sm font-semibold text-accent-700 transition-colors hover:text-accent-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
                                            onClick={() => trackEvent('checkout__profile_settings--open', { tier: selectedTierKey, source })}
                                        >
                                            {t('checkout.profileSettingsLink', { ns: 'pricing' })}
                                            <ArrowRight size={14} weight="bold" />
                                        </NavLink>
                                    </div>
                                    </div>

                                    <div className="border-t border-slate-200 pt-6">
                                        <button
                                            type="button"
                                            disabled={isSubmitting || !hasHydratedForm || isAuthLoading || isProfileLoading || !supportsSelectedTier}
                                            onClick={() => void handleContinueToPayment()}
                                            className={cn(checkoutActionClassName, 'w-full bg-accent-600 text-white hover:bg-accent-700')}
                                            {...getAnalyticsDebugAttributes('checkout__payment--start')}
                                        >
                                            {isSubmitting ? <SpinnerGap size={18} className="animate-spin" /> : <CreditCard size={18} weight="duotone" />}
                                            {t('checkout.continueToPayment', { ns: 'pricing' })}
                                        </button>
                                        <p className="mt-3 text-xs leading-5 text-slate-500">{t('checkout.planSummaryBilling', { ns: 'pricing' })}</p>
                                    </div>
                                </div>
                            </section>
                        )}
                    </div>

                    <aside className="order-1 border-b border-slate-200 pb-8 lg:order-2 lg:border-b-0 lg:border-s lg:pb-0 lg:ps-10">
                        <div className="space-y-6 lg:sticky lg:top-24">
                            <div className="border-b border-slate-200 pb-6">
                                <p className={checkoutSectionLabelClassName}>{t('checkout.planSummaryTitle', { ns: 'pricing' })}</p>
                                <Tabs value={selectedTierKey} onValueChange={handlePlanChange} className="mt-3 gap-4">
                                    <TabsList variant="line" className="h-auto w-full justify-start gap-2 p-0">
                                        {PAID_TIER_ORDER.map((tierKey) => {
                                            const tier = PLAN_CATALOG[tierKey];
                                            const tierAvailable = isPaddleTierCheckoutConfigured(paddlePublicConfig, tierKey);
                                            return (
                                                <TabsTrigger
                                                    key={tierKey}
                                                    value={tierKey}
                                                    disabled={Boolean(paddlePublicConfig) && !tierAvailable}
                                                    className="h-10 rounded-md border border-slate-200 px-4 text-sm data-[state=active]:border-slate-300 data-[state=active]:bg-slate-100"
                                                >
                                                    {t(`tiers.${tier.publicSlug}.name`, { ns: 'pricing' })}
                                                </TabsTrigger>
                                            );
                                        })}
                                    </TabsList>
                                </Tabs>
                            </div>

                            <div className="space-y-4 border-b border-slate-200 pb-6">
                                <div className="flex items-end justify-between gap-4">
                                    <div>
                                        <p className={checkoutSectionLabelClassName}>{t(`tiers.${selectedTier.publicSlug}.badge`, { ns: 'pricing' })}</p>
                                        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{t(`tiers.${selectedTier.publicSlug}.name`, { ns: 'pricing' })}</h2>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-3xl font-black tracking-tight text-slate-900">${selectedTier.monthlyPriceUsd}</div>
                                        <div className="text-sm text-slate-500">{t('shared.perMonth', { ns: 'pricing' })}</div>
                                    </div>
                                </div>
                                <ul className="space-y-3 text-sm leading-6 text-slate-600">
                                    <li className="flex items-start gap-3">
                                        <ShieldCheck size={16} weight="duotone" className="mt-1 shrink-0 text-accent-600" />
                                        <span>{t('checkout.planSummaryBilling', { ns: 'pricing' })}</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <Check size={16} weight="bold" className="mt-1 shrink-0 text-accent-600" />
                                        <span>{t('checkout.profileSaveDescription', { ns: 'pricing' })}</span>
                                    </li>
                                    {fromTripCheckout ? (
                                        <li className="flex items-start gap-3">
                                            <ArrowLeft size={16} weight="bold" className="mt-1 shrink-0 text-accent-600" />
                                            <span>{backLabel}</span>
                                        </li>
                                    ) : null}
                                </ul>
                            </div>

                            <div>
                                <p className={checkoutSectionLabelClassName}>{t('checkout.whatsIncluded', { ns: 'pricing' })}</p>
                                <ul className="mt-4 space-y-3">
                                    {planFeatures.map((feature) => (
                                        <li key={feature} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                                            <Check size={16} weight="bold" className="mt-1 shrink-0 text-accent-600" />
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </aside>
                </section>
            </main>
            <SiteFooter />
        </div>
    );
};
