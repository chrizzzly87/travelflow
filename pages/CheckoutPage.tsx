import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ArrowLeft,
    ArrowRight,
    Check,
    CreditCard,
    GlobeHemisphereWest,
    ShieldCheck,
    Sparkle,
    SpinnerGap,
    SuitcaseRolling,
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
    const progressCount = useMemo(() => (
        PROFILE_FIELD_PROGRESS_KEYS.filter((key) => {
            const value = form[key];
            return typeof value === 'string' ? Boolean(value.trim()) : Boolean(value);
        }).length
    ), [form]);
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
    const backLabel = source === 'trip_paywall_strip' || source === 'trip_paywall_overlay'
        ? t('checkout.backToTrip', { ns: 'pricing' })
        : t('checkout.backToPricing', { ns: 'pricing' });

    return (
        <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.12),_transparent_30%),linear-gradient(180deg,#f8fafc_0%,#eef4ff_42%,#ffffff_100%)] text-slate-900">
            <SiteHeader hideCreateTrip />
            <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 pb-14 pt-6 sm:px-6 lg:px-8 lg:pt-10">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <Link
                        to={returnToPath}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:text-slate-900"
                        onClick={() => trackEvent(source === 'trip_paywall_strip' || source === 'trip_paywall_overlay' ? 'checkout__return--trip' : 'checkout__return--pricing', { tier: selectedTierKey })}
                    >
                        <ArrowLeft size={14} weight="bold" />
                        {backLabel}
                    </Link>
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
                        <ShieldCheck size={14} weight="duotone" />
                        {t('checkout.eyebrow', { ns: 'pricing' })}
                    </div>
                </div>

                <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
                    <div className="space-y-5">
                        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white/90 shadow-[0_36px_90px_-58px_rgba(15,23,42,0.55)] backdrop-blur">
                            <div className="border-b border-slate-200 bg-[linear-gradient(135deg,rgba(15,23,42,0.98)_0%,rgba(30,41,59,0.98)_46%,rgba(2,132,199,0.95)_100%)] px-5 py-6 text-white sm:px-7 sm:py-7">
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div className="max-w-2xl">
                                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/65">
                                            {source === 'trip_paywall_strip' || source === 'trip_paywall_overlay'
                                                ? t('checkout.tripEntryDescription', { ns: 'pricing' })
                                                : t('checkout.description', { ns: 'pricing' })}
                                        </p>
                                        <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl" style={{ fontFamily: 'var(--tf-font-heading)' }}>
                                            {t('checkout.title', { ns: 'pricing' })}
                                        </h1>
                                        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/78">
                                            {t('checkout.summaryLead', {
                                                ns: 'pricing',
                                                tierName: t(`tiers.${selectedTier.publicSlug}.name`, { ns: 'pricing' }),
                                            })}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-end shadow-inner shadow-black/5">
                                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/65">{t(`tiers.${selectedTier.publicSlug}.badge`, { ns: 'pricing' })}</div>
                                        <div className="mt-2 text-4xl font-black tracking-tight">${selectedTier.monthlyPriceUsd}</div>
                                        <div className="text-sm font-medium text-white/70">{t('shared.perMonth', { ns: 'pricing' })}</div>
                                    </div>
                                </div>
                                <div className="mt-6">
                                    <Tabs value={selectedTierKey} onValueChange={handlePlanChange} className="gap-4">
                                        <TabsList className="h-auto rounded-2xl bg-white/10 p-1.5 backdrop-blur">
                                            {PAID_TIER_ORDER.map((tierKey) => {
                                                const tier = PLAN_CATALOG[tierKey];
                                                const tierAvailable = isPaddleTierCheckoutConfigured(paddlePublicConfig, tierKey);
                                                return (
                                                    <TabsTrigger
                                                        key={tierKey}
                                                        value={tierKey}
                                                        disabled={Boolean(paddlePublicConfig) && !tierAvailable}
                                                        className="rounded-xl px-4 py-2.5 text-sm data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
                                                    >
                                                        {t(`tiers.${tier.publicSlug}.name`, { ns: 'pricing' })}
                                                    </TabsTrigger>
                                                );
                                            })}
                                        </TabsList>
                                    </Tabs>
                                </div>
                            </div>

                            <div className="grid gap-4 px-5 py-5 sm:px-7 sm:py-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(260px,0.75fr)]">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t('checkout.whatsIncluded', { ns: 'pricing' })}</p>
                                    <ul className="mt-4 space-y-3">
                                        {planFeatures.map((feature) => (
                                            <li key={feature} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-700">
                                                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent-700">
                                                    <Check size={14} weight="bold" />
                                                </span>
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="space-y-3">
                                    <article className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                        <div className="flex items-center gap-3">
                                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white">
                                                <CreditCard size={18} weight="duotone" />
                                            </span>
                                            <div>
                                                <p className="text-sm font-semibold text-slate-900">{t('checkout.planSummaryTitle', { ns: 'pricing' })}</p>
                                                <p className="text-xs leading-5 text-slate-600">{t('checkout.planSummaryBilling', { ns: 'pricing' })}</p>
                                            </div>
                                        </div>
                                    </article>
                                    <article className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                        <div className="flex items-center gap-3">
                                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                                                <ShieldCheck size={18} weight="duotone" />
                                            </span>
                                            <div>
                                                <p className="text-sm font-semibold text-slate-900">{t('checkout.planSummaryMerchant', { ns: 'pricing' })}</p>
                                                <p className="text-xs leading-5 text-slate-600">{t('checkout.planSummarySupport', { ns: 'pricing' })}</p>
                                            </div>
                                        </div>
                                    </article>
                                    <article className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                        <div className="flex items-center gap-3">
                                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                                                <SuitcaseRolling size={18} weight="duotone" />
                                            </span>
                                            <div>
                                                <p className="text-sm font-semibold text-slate-900">{t('checkout.profileSaveTitle', { ns: 'pricing' })}</p>
                                                <p className="text-xs leading-5 text-slate-600">{t('checkout.profileSaveDescription', { ns: 'pricing' })}</p>
                                            </div>
                                        </div>
                                    </article>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-5">
                        {paddlePublicConfig?.issues.length ? (
                            <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-900 shadow-sm">
                                <p className="font-semibold">{t('checkout.errorTitle', { ns: 'pricing' })}</p>
                                <p className="mt-1">{t('checkout.errorConfig', { ns: 'pricing' })}</p>
                            </div>
                        ) : null}

                        {!isEligibleAccount && !hasInlineCheckout ? (
                            <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_80px_-55px_rgba(15,23,42,0.5)]">
                                <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
                                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t('benefits.title', { ns: 'auth' })}</p>
                                    <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">{t('checkout.loginTitle', { ns: 'pricing' })}</h2>
                                    <p className="mt-2 text-sm leading-6 text-slate-600">{t('checkout.loginDescription', { ns: 'pricing' })}</p>
                                </div>
                                <div className="space-y-4 px-5 py-5 sm:px-6">
                                    <ul className="space-y-2 text-sm text-slate-700">
                                        {(t('benefits.items', { ns: 'auth', returnObjects: true }) as string[]).map((item) => (
                                            <li key={item} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                                <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent-100 text-accent-700">
                                                    <Sparkle size={14} weight="duotone" />
                                                </span>
                                                <span>{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                    <NavLink
                                        to={loginTarget}
                                        onClick={() => trackEvent('checkout__account_gate--login', { tier: selectedTierKey, source, has_claim: Boolean(checkoutLocationContext.claimId) })}
                                        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
                                        {...getAnalyticsDebugAttributes('checkout__account_gate--login')}
                                    >
                                        <GlobeHemisphereWest size={16} weight="duotone" />
                                        {t('checkout.loginCta', { ns: 'pricing' })}
                                    </NavLink>
                                </div>
                            </div>
                        ) : hasInlineCheckout ? (
                            <div
                                ref={inlineCheckoutSectionRef}
                                className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_36px_90px_-58px_rgba(15,23,42,0.55)]"
                            >
                                <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
                                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t('checkout.paymentTitle', { ns: 'pricing' })}</p>
                                    <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">{frameTitle}</h2>
                                    <p className="mt-2 text-sm leading-6 text-slate-600">{t('checkout.paymentDescription', { ns: 'pricing' })}</p>
                                </div>
                                <div className="bg-slate-50/70 p-3 sm:p-4">
                                    <div className="relative overflow-hidden rounded-[24px] border border-slate-200 bg-white p-2 shadow-[0_18px_48px_-36px_rgba(15,23,42,0.5)]">
                                        {isInlineCheckoutLoading ? (
                                            <div className="pointer-events-none absolute inset-0 z-10 bg-white/90 backdrop-blur-sm">
                                                <div className="flex h-full flex-col gap-4 p-6">
                                                    <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                                                        <SpinnerGap size={16} className="animate-spin" />
                                                        {t('checkout.loading', { ns: 'pricing' })}
                                                    </div>
                                                    <div className="h-14 w-full animate-pulse rounded-2xl bg-slate-100" />
                                                    <div className="h-14 w-full animate-pulse rounded-2xl bg-slate-100" />
                                                    <div className="h-48 w-full animate-pulse rounded-3xl bg-slate-100" />
                                                    <div className="mt-auto h-12 w-full animate-pulse rounded-2xl bg-slate-200" />
                                                </div>
                                            </div>
                                        ) : null}
                                        <div className={`${PADDLE_INLINE_FRAME_TARGET_CLASS} min-h-[680px] w-full`} />
                                    </div>
                                </div>
                                {checkoutCompleted ? (
                                    <div className="border-t border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900 sm:px-6">
                                        <p className="font-semibold">{t('checkout.paymentCompletedTitle', { ns: 'pricing' })}</p>
                                        <p className="mt-1">{t('checkout.paymentCompletedDescription', { ns: 'pricing' })}</p>
                                    </div>
                                ) : null}
                            </div>
                        ) : (
                            <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_36px_90px_-58px_rgba(15,23,42,0.55)]">
                                <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t('checkout.travelerDetailsTitle', { ns: 'pricing' })}</p>
                                            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">{t('checkout.travelerDetailsHeadline', { ns: 'pricing' })}</h2>
                                            <p className="mt-2 text-sm leading-6 text-slate-600">{t('checkout.travelerDetailsDescription', { ns: 'pricing' })}</p>
                                        </div>
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-right">
                                            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t('checkout.travelerDetailsProgressLabel', { ns: 'pricing' })}</div>
                                            <div className="mt-1 text-lg font-black tracking-tight text-slate-900">{t('checkout.travelerDetailsProgress', { ns: 'pricing', count: progressCount, total: PROFILE_FIELD_PROGRESS_KEYS.length })}</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-5 px-5 py-5 sm:px-6">
                                    {errorMessage ? (
                                        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                                            {errorMessage}
                                        </div>
                                    ) : null}

                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <label className="space-y-1.5">
                                            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t('settings.fields.firstName', { ns: 'profile' })}</span>
                                            <input
                                                value={form.firstName}
                                                onChange={(event) => setField('firstName', event.target.value)}
                                                className="h-11 w-full rounded-2xl border border-slate-300 px-3 text-sm outline-none transition-colors focus:border-accent-400 focus:ring-2 focus:ring-accent-200"
                                            />
                                        </label>
                                        <label className="space-y-1.5">
                                            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t('settings.fields.lastName', { ns: 'profile' })}</span>
                                            <input
                                                value={form.lastName}
                                                onChange={(event) => setField('lastName', event.target.value)}
                                                className="h-11 w-full rounded-2xl border border-slate-300 px-3 text-sm outline-none transition-colors focus:border-accent-400 focus:ring-2 focus:ring-accent-200"
                                            />
                                        </label>
                                    </div>

                                    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.88fr)]">
                                        <div className="space-y-1.5">
                                            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t('settings.fields.country', { ns: 'profile' })}</span>
                                            <ProfileCountryRegionSelect
                                                value={form.country}
                                                locale={activeLocale}
                                                disabled={isSubmitting || isProfileLoading}
                                                inputClassName="h-11 rounded-2xl"
                                                placeholder={t('settings.countryRegionSearchPlaceholder', { ns: 'profile' })}
                                                emptyLabel={t('settings.countryRegionEmpty', { ns: 'profile' })}
                                                toggleLabel={t('settings.countryRegionToggle', { ns: 'profile' })}
                                                onValueChange={(nextCode) => setField('country', nextCode)}
                                            />
                                        </div>
                                        <label className="space-y-1.5">
                                            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t('settings.fields.city', { ns: 'profile' })}</span>
                                            <input
                                                value={form.city}
                                                onChange={(event) => setField('city', event.target.value)}
                                                className="h-11 w-full rounded-2xl border border-slate-300 px-3 text-sm outline-none transition-colors focus:border-accent-400 focus:ring-2 focus:ring-accent-200"
                                            />
                                        </label>
                                    </div>

                                    <label className="space-y-1.5">
                                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t('settings.fields.preferredLanguage', { ns: 'profile' })}</span>
                                        <Select
                                            value={form.preferredLanguage}
                                            onValueChange={(value) => setField('preferredLanguage', value as AppLanguage)}
                                        >
                                            <SelectTrigger className="h-11 w-full rounded-2xl border-slate-300 text-sm focus:border-accent-400 focus:ring-accent-200">
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
                                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t('settings.fields.bio', { ns: 'profile' })}</span>
                                        <textarea
                                            value={form.bio}
                                            onChange={(event) => setField('bio', clampBio(event.target.value))}
                                            rows={4}
                                            maxLength={160}
                                            className="w-full rounded-[22px] border border-slate-300 px-3 py-3 text-sm outline-none transition-colors focus:border-accent-400 focus:ring-2 focus:ring-accent-200"
                                        />
                                        <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                                            <span>{t('settings.bioHelp', { ns: 'profile' })}</span>
                                            <span>{form.bio.length}/160</span>
                                        </div>
                                    </label>

                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <article className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                            <div className="flex items-center justify-between gap-4">
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
                                        </article>
                                        <article className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                            <div className="flex items-center justify-between gap-4">
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
                                        </article>
                                    </div>

                                    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-slate-900">{t('checkout.profileSettingsTitle', { ns: 'pricing' })}</p>
                                            <p className="mt-1 text-xs leading-5 text-slate-600">{t('checkout.profileSettingsDescription', { ns: 'pricing' })}</p>
                                        </div>
                                        <NavLink
                                            to={buildPath('profileSettings')}
                                            className="inline-flex items-center gap-2 text-sm font-semibold text-accent-700 transition-colors hover:text-accent-800"
                                            onClick={() => trackEvent('checkout__profile_settings--open', { tier: selectedTierKey, source })}
                                        >
                                            {t('checkout.profileSettingsLink', { ns: 'pricing' })}
                                            <ArrowRight size={14} weight="bold" />
                                        </NavLink>
                                    </div>

                                    <button
                                        type="button"
                                        disabled={isSubmitting || !hasHydratedForm || isAuthLoading || isProfileLoading || !supportsSelectedTier}
                                        onClick={() => void handleContinueToPayment()}
                                        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                        {...getAnalyticsDebugAttributes('checkout__payment--start')}
                                    >
                                        {isSubmitting ? <SpinnerGap size={18} className="animate-spin" /> : <CreditCard size={18} weight="duotone" />}
                                        {t('checkout.continueToPayment', { ns: 'pricing' })}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </section>
            </main>
            <SiteFooter />
        </div>
    );
};
