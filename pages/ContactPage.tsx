import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    CheckCircle,
    EnvelopeSimple,
    GithubLogo,
    InstagramLogo,
    LinkedinLogo,
    WarningCircle,
    XLogo,
} from '@phosphor-icons/react';
import { MarketingLayout } from '../components/marketing/MarketingLayout';
import { FaqAccordionList } from '../components/marketing/FaqAccordionList';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { buildLocalizedMarketingPath, extractLocaleFromPath } from '../config/routes';
import { DEFAULT_LOCALE } from '../config/locales';
import { CONTACT_FAQ_EXCERPT_ITEMS, type FaqItemWithSection } from '../data/faqContent';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import { useAuth } from '../hooks/useAuth';
import { getCurrentAccessContext } from '../services/authService';
import { getLastVisitedPath } from '../services/navigationContextService';

const CONTACT_FORM_NAME = 'contact';
const MESSAGE_MAX_LENGTH = 5000;
const FALLBACK_EMAIL = 'contact@wizz.art';

const CONTACT_FORM_SUBMIT_EVENT = 'contact__form--submit';
const CONTACT_FORM_SUCCESS_EVENT = 'contact__form--success';
const CONTACT_FORM_FAILED_EVENT = 'contact__form--failed';
const CONTACT_FALLBACK_EMAIL_EVENT = 'contact__fallback--email';
const CONTACT_FAQ_ITEM_OPEN_EVENT = 'contact__faq_item--open';
const CONTACT_FAQ_ITEM_CLOSE_EVENT = 'contact__faq_item--close';
const CONTACT_FAQ_LINK_ITEM_EVENT = 'contact__faq_link--item';
const CONTACT_FAQ_LINK_FULL_PAGE_EVENT = 'contact__faq_link--full_page';
const CONTACT_SUB_REASON_NONE_VALUE = '__none__';
const CONTACT_SOURCE_MAX_LENGTH = 80;
const CONTACT_SOCIAL_CHANNELS = [
    { label: 'Instagram', Icon: InstagramLogo },
    { label: 'X', Icon: XLogo },
    { label: 'LinkedIn', Icon: LinkedinLogo },
    { label: 'GitHub', Icon: GithubLogo },
] as const;

const CONTACT_REASON_OPTIONS = [
    { value: 'bug_report', labelKey: 'contact.form.reasonOptions.bugReport' },
    { value: 'feature_request', labelKey: 'contact.form.reasonOptions.featureRequest' },
    { value: 'billing_account', labelKey: 'contact.form.reasonOptions.billingAccount' },
    { value: 'data_privacy', labelKey: 'contact.form.reasonOptions.dataPrivacy' },
    { value: 'partnership', labelKey: 'contact.form.reasonOptions.partnership' },
    { value: 'other', labelKey: 'contact.form.reasonOptions.other' },
] as const;

type ContactReason = (typeof CONTACT_REASON_OPTIONS)[number]['value'];
const CONTACT_SUB_REASON_OPTIONS = {
    bug_report: [
        { value: 'page_not_loading_working', labelKey: 'contact.form.subReasonOptions.bugReport.pageNotLoadingWorking' },
        { value: 'translation_wrong_misleading', labelKey: 'contact.form.subReasonOptions.bugReport.translationWrongMisleading' },
        { value: 'action_not_working', labelKey: 'contact.form.subReasonOptions.bugReport.actionNotWorking' },
        { value: 'layout_visual_issue', labelKey: 'contact.form.subReasonOptions.bugReport.layoutVisualIssue' },
        { value: 'map_routing_issue', labelKey: 'contact.form.subReasonOptions.bugReport.mapRoutingIssue' },
        { value: 'performance_issue', labelKey: 'contact.form.subReasonOptions.bugReport.performanceIssue' },
    ],
    feature_request: [
        { value: 'new_feature', labelKey: 'contact.form.subReasonOptions.featureRequest.newFeature' },
        { value: 'improve_feature', labelKey: 'contact.form.subReasonOptions.featureRequest.improveFeature' },
        { value: 'workflow_automation', labelKey: 'contact.form.subReasonOptions.featureRequest.workflowAutomation' },
        { value: 'mobile_experience', labelKey: 'contact.form.subReasonOptions.featureRequest.mobileExperience' },
        { value: 'accessibility', labelKey: 'contact.form.subReasonOptions.featureRequest.accessibility' },
    ],
    billing_account: [
        { value: 'subscription_change', labelKey: 'contact.form.subReasonOptions.billingAccount.subscriptionChange' },
        { value: 'invoice_receipt', labelKey: 'contact.form.subReasonOptions.billingAccount.invoiceReceipt' },
        { value: 'payment_failed', labelKey: 'contact.form.subReasonOptions.billingAccount.paymentFailed' },
        { value: 'refund_question', labelKey: 'contact.form.subReasonOptions.billingAccount.refundQuestion' },
        { value: 'account_access', labelKey: 'contact.form.subReasonOptions.billingAccount.accountAccess' },
    ],
    data_privacy: [
        { value: 'data_export', labelKey: 'contact.form.subReasonOptions.dataPrivacy.dataExport' },
        { value: 'data_deletion', labelKey: 'contact.form.subReasonOptions.dataPrivacy.dataDeletion' },
        { value: 'consent_cookies', labelKey: 'contact.form.subReasonOptions.dataPrivacy.consentCookies' },
        { value: 'legal_question', labelKey: 'contact.form.subReasonOptions.dataPrivacy.legalQuestion' },
        { value: 'security_concern', labelKey: 'contact.form.subReasonOptions.dataPrivacy.securityConcern' },
    ],
    partnership: [
        { value: 'affiliate_influencer', labelKey: 'contact.form.subReasonOptions.partnership.affiliateInfluencer' },
        { value: 'brand_campaign', labelKey: 'contact.form.subReasonOptions.partnership.brandCampaign' },
        { value: 'media_press', labelKey: 'contact.form.subReasonOptions.partnership.mediaPress' },
        { value: 'integration_partner', labelKey: 'contact.form.subReasonOptions.partnership.integrationPartner' },
        { value: 'education_nonprofit', labelKey: 'contact.form.subReasonOptions.partnership.educationNonProfit' },
    ],
    other: [
        { value: 'general_feedback', labelKey: 'contact.form.subReasonOptions.other.generalFeedback' },
        { value: 'product_question', labelKey: 'contact.form.subReasonOptions.other.productQuestion' },
        { value: 'career_opportunity', labelKey: 'contact.form.subReasonOptions.other.careerOpportunity' },
        { value: 'responsible_disclosure', labelKey: 'contact.form.subReasonOptions.other.responsibleDisclosure' },
        { value: 'something_else', labelKey: 'contact.form.subReasonOptions.other.somethingElse' },
    ],
} as const satisfies Record<ContactReason, ReadonlyArray<{ value: string; labelKey: string }>>;
type ContactSubReason = {
    [Reason in ContactReason]: (typeof CONTACT_SUB_REASON_OPTIONS)[Reason][number]['value']
}[ContactReason];

type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error';
type ContactErrorType = 'validation' | 'quota_or_limit' | 'http_error' | 'network_error' | null;

interface ContactFormState {
    reason: '' | ContactReason;
    subReason: '' | ContactSubReason;
    name: string;
    email: string;
    message: string;
    botField: string;
}

interface ResolvedAccessContext {
    userId: string | null;
    tierKey: string | null;
    email: string | null;
}

interface ContactRouteState {
    reason?: string;
    subReason?: string;
    source?: string;
}

interface PrefilledContactContext {
    reason: '' | ContactReason;
    subReason: '' | ContactSubReason;
    source: string | null;
}

const isValidReason = (value: string): value is ContactReason => (
    CONTACT_REASON_OPTIONS.some((entry) => entry.value === value)
);
const isValidSubReasonForReason = (reason: ContactReason, value: string): value is ContactSubReason => (
    CONTACT_SUB_REASON_OPTIONS[reason].some((entry) => entry.value === value)
);
const isValidContactSource = (value: string): boolean => (
    /^[a-z0-9_:-]{1,80}$/i.test(value)
);

const resolvePrefilledContactContext = (state: unknown): PrefilledContactContext => {
    if (!state || typeof state !== 'object') {
        return {
            reason: '',
            subReason: '',
            source: null,
        };
    }

    const candidate = state as ContactRouteState;
    const sourceRaw = typeof candidate.source === 'string'
        ? candidate.source.trim().slice(0, CONTACT_SOURCE_MAX_LENGTH)
        : '';
    const source = isValidContactSource(sourceRaw) ? sourceRaw : null;

    const reasonRaw = typeof candidate.reason === 'string' ? candidate.reason : '';
    if (!isValidReason(reasonRaw)) {
        return {
            reason: '',
            subReason: '',
            source,
        };
    }

    const subReasonRaw = typeof candidate.subReason === 'string' ? candidate.subReason : '';
    const subReason = isValidSubReasonForReason(reasonRaw, subReasonRaw) ? subReasonRaw : '';

    return {
        reason: reasonRaw,
        subReason,
        source,
    };
};

const isLikelyQuotaStatus = (status: number): boolean => [402, 403, 409, 429, 503].includes(status);

export const ContactPage: React.FC = () => {
    const { t } = useTranslation('common');
    const location = useLocation();
    const locale = extractLocaleFromPath(location.pathname) ?? DEFAULT_LOCALE;
    const { access, profile } = useAuth();
    const prefilledContactContext = useMemo(() => resolvePrefilledContactContext(location.state), [location.state]);

    const [formState, setFormState] = useState<ContactFormState>({
        reason: prefilledContactContext.reason,
        subReason: prefilledContactContext.subReason,
        name: '',
        email: '',
        message: '',
        botField: '',
    });
    const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
    const [submitHttpStatus, setSubmitHttpStatus] = useState<number | null>(null);
    const [errorType, setErrorType] = useState<ContactErrorType>(null);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [isSubReasonSelectOpen, setIsSubReasonSelectOpen] = useState(false);
    const [openContactFaqItemIds, setOpenContactFaqItemIds] = useState<string[]>(() => {
        const firstItemId = CONTACT_FAQ_EXCERPT_ITEMS[0]?.id;
        return firstItemId ? [firstItemId] : [];
    });
    const [resolvedAccess, setResolvedAccess] = useState<ResolvedAccessContext>({
        userId: null,
        tierKey: null,
        email: null,
    });

    const nameTouchedRef = useRef(false);
    const emailTouchedRef = useRef(false);

    const currentPath = `${location.pathname}${location.search}`;
    const lastVisitedPath = useMemo(() => getLastVisitedPath(currentPath), [currentPath]);
    const appVersion = useMemo(() => {
        const rawVersion = (import.meta.env.VITE_APP_VERSION || '').trim();
        return rawVersion.length ? rawVersion : null;
    }, []);

    const authenticatedAccess = access && !access.isAnonymous && access.userId ? access : null;
    const effectiveUserId = authenticatedAccess?.userId ?? resolvedAccess.userId;
    const effectiveTierKey = authenticatedAccess?.tierKey ?? resolvedAccess.tierKey;
    const hasUser = Boolean(effectiveUserId);
    const contactSource = prefilledContactContext.source;
    const faqPath = buildLocalizedMarketingPath('faq', locale);
    const subReasonOptions = useMemo(
        () => (isValidReason(formState.reason) ? CONTACT_SUB_REASON_OPTIONS[formState.reason] : []),
        [formState.reason]
    );
    const selectedSubReason = useMemo(() => {
        if (!isValidReason(formState.reason)) return '';
        if (!formState.subReason) return '';
        return isValidSubReasonForReason(formState.reason, formState.subReason) ? formState.subReason : '';
    }, [formState.reason, formState.subReason]);

    useEffect(() => {
        if (!authenticatedAccess?.email) return;
        setFormState((current) => {
            if (emailTouchedRef.current || current.email.trim().length > 0) return current;
            return { ...current, email: authenticatedAccess.email || '' };
        });
    }, [authenticatedAccess?.email]);

    useEffect(() => {
        let active = true;

        void getCurrentAccessContext()
            .catch(() => null)
            .then((accessContext) => {
            if (!active) return;

            if (accessContext && accessContext.userId && !accessContext.isAnonymous) {
                setResolvedAccess({
                    userId: accessContext.userId,
                    tierKey: accessContext.tierKey,
                    email: accessContext.email,
                });

                if (accessContext.email) {
                    setFormState((current) => {
                        if (emailTouchedRef.current || current.email.trim().length > 0) return current;
                        return { ...current, email: accessContext.email || '' };
                    });
                }
            }

            });

        const derivedProfileName = (
            profile?.displayName
            || [profile?.firstName || '', profile?.lastName || ''].filter(Boolean).join(' ').trim()
        ).trim();
        if (derivedProfileName.length > 0) {
            setFormState((current) => {
                if (nameTouchedRef.current || current.name.trim().length > 0) return current;
                return { ...current, name: derivedProfileName };
            });
        }

        return () => {
            active = false;
        };
    }, [profile?.displayName, profile?.firstName, profile?.lastName]);

    const handleReasonChange = (value: string) => {
        setSubmitStatus('idle');
        setValidationError(null);
        setErrorType(null);
        setSubmitHttpStatus(null);
        const nextReason = isValidReason(value) ? value : '';
        setIsSubReasonSelectOpen(Boolean(nextReason) && nextReason !== formState.reason);
        setFormState((current) => ({
            ...current,
            reason: nextReason,
            subReason: nextReason && current.subReason && isValidSubReasonForReason(nextReason, current.subReason)
                ? current.subReason
                : '',
        }));
    };

    const handleSubReasonChange = (value: string) => {
        setSubmitStatus('idle');
        setValidationError(null);
        setErrorType(null);
        setSubmitHttpStatus(null);
        setIsSubReasonSelectOpen(false);
        setFormState((current) => {
            if (!isValidReason(current.reason)) {
                return {
                    ...current,
                    subReason: '',
                };
            }
            if (value === CONTACT_SUB_REASON_NONE_VALUE) {
                return {
                    ...current,
                    subReason: '',
                };
            }
            return {
                ...current,
                subReason: isValidSubReasonForReason(current.reason, value) ? value : '',
            };
        });
    };

    const handleContactFaqItemToggle = (item: FaqItemWithSection, nextOpen: boolean) => {
        setOpenContactFaqItemIds((current) => {
            if (nextOpen) return [item.id];
            return current.filter((entry) => entry !== item.id);
        });

        trackEvent(nextOpen ? CONTACT_FAQ_ITEM_OPEN_EVENT : CONTACT_FAQ_ITEM_CLOSE_EVENT, {
            item_id: item.id,
            section_id: item.sectionId,
            source: 'contact_page',
        });
    };

    const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        nameTouchedRef.current = true;
        setSubmitStatus('idle');
        setValidationError(null);
        setErrorType(null);
        setSubmitHttpStatus(null);
        setFormState((current) => ({ ...current, name: event.target.value }));
    };

    const handleEmailChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        emailTouchedRef.current = true;
        setSubmitStatus('idle');
        setValidationError(null);
        setErrorType(null);
        setSubmitHttpStatus(null);
        setFormState((current) => ({ ...current, email: event.target.value }));
    };

    const handleMessageChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setSubmitStatus('idle');
        setValidationError(null);
        setErrorType(null);
        setSubmitHttpStatus(null);
        setFormState((current) => ({ ...current, message: event.target.value }));
    };

    const validateForm = (): string | null => {
        if (!isValidReason(formState.reason)) {
            return t('contact.form.validationReason');
        }

        const trimmedEmail = formState.email.trim();
        const trimmedMessage = formState.message.trim();

        if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
            return t('contact.form.validationEmail');
        }

        if (!trimmedMessage) {
            return t('contact.form.validationMessage');
        }

        if (trimmedMessage.length > MESSAGE_MAX_LENGTH) {
            return t('contact.form.validationMessageLength', { max: MESSAGE_MAX_LENGTH });
        }

        return null;
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (submitStatus === 'submitting') return;

        setValidationError(null);
        setSubmitHttpStatus(null);
        setErrorType(null);

        const nextValidationError = validateForm();
        if (nextValidationError) {
            setSubmitStatus('error');
            setErrorType('validation');
            setValidationError(nextValidationError);
            return;
        }

        const reason = formState.reason as ContactReason;

        trackEvent(CONTACT_FORM_SUBMIT_EVENT, {
            reason,
            sub_reason: selectedSubReason || null,
            locale,
            has_user: hasUser,
            source: contactSource,
        });

        setSubmitStatus('submitting');

        const payload = new URLSearchParams();
        payload.set('form-name', CONTACT_FORM_NAME);
        payload.set('reason', reason);
        payload.set('subReason', selectedSubReason);
        payload.set('name', formState.name.trim());
        payload.set('email', formState.email.trim());
        payload.set('message', formState.message.trim());
        payload.set('bot-field', formState.botField);
        payload.set('currentPath', currentPath);
        payload.set('lastVisitedPath', lastVisitedPath || '');
        payload.set('locale', locale);
        if (contactSource) payload.set('contactSource', contactSource);
        if (effectiveUserId) payload.set('userId', effectiveUserId);
        if (effectiveTierKey) payload.set('plan', effectiveTierKey);
        if (appVersion) payload.set('appVersion', appVersion);

        try {
            const response = await fetch('/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: payload.toString(),
            });

            if (response.ok) {
                setSubmitStatus('success');
                setFormState((current) => ({
                    ...current,
                    message: '',
                    botField: '',
                }));
                trackEvent(CONTACT_FORM_SUCCESS_EVENT, {
                    reason,
                    sub_reason: selectedSubReason || null,
                    locale,
                    has_user: hasUser,
                    status: response.status,
                    source: contactSource,
                });
                return;
            }

            const nextErrorType: ContactErrorType = isLikelyQuotaStatus(response.status)
                ? 'quota_or_limit'
                : 'http_error';

            setSubmitStatus('error');
            setErrorType(nextErrorType);
            setSubmitHttpStatus(response.status);

            trackEvent(CONTACT_FORM_FAILED_EVENT, {
                reason,
                sub_reason: selectedSubReason || null,
                locale,
                has_user: hasUser,
                status: response.status,
                error_type: nextErrorType,
                source: contactSource,
            });
        } catch {
            setSubmitStatus('error');
            setErrorType('network_error');
            setSubmitHttpStatus(null);

            trackEvent(CONTACT_FORM_FAILED_EVENT, {
                reason,
                sub_reason: selectedSubReason || null,
                locale,
                has_user: hasUser,
                status: null,
                error_type: 'network_error',
                source: contactSource,
            });
        }
    };

    const fallbackEmailHref = `mailto:${FALLBACK_EMAIL}`;

    return (
        <MarketingLayout>
            <section className="grid gap-10 lg:grid-cols-[minmax(0,1fr),minmax(0,640px)] lg:gap-14">
                <div className="max-w-2xl">
                    <h1 className="text-4xl font-black tracking-tight text-slate-900 md:text-5xl">
                        {t('contact.title')}
                    </h1>
                    <p className="mt-5 max-w-xl text-sm leading-7 text-slate-600 md:text-base">
                        {t('contact.description')}
                    </p>

                    <div className="mt-8 space-y-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            {t('contact.emailLabel')}
                        </p>
                        <a
                            href={`mailto:${t('contact.emailValue')}`}
                            className="inline-flex items-center gap-2 text-base font-semibold text-accent-700 transition-colors hover:text-accent-800"
                        >
                            <EnvelopeSimple size={18} weight="duotone" />
                            {t('contact.emailValue')}
                        </a>
                        <p className="text-sm leading-6 text-slate-600">{t('contact.responseNote')}</p>
                    </div>

                    <div className="mt-8">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            {t('contact.form.reasonLabel')}
                        </p>
                        <ul className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                            {CONTACT_REASON_OPTIONS.map((entry) => (
                                <li key={entry.value} className="inline-flex items-center gap-2">
                                    <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-slate-400" />
                                    {t(entry.labelKey)}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="mt-8">
                        <p className="text-sm leading-6 text-slate-600">{t('contact.form.privacyNote')}</p>
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                            {CONTACT_SOCIAL_CHANNELS.map(({ label, Icon }) => (
                                <button
                                    key={label}
                                    type="button"
                                    disabled
                                    aria-label={label}
                                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-200"
                                >
                                    <Icon size={18} weight="duotone" />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        {t('contact.form.title')}
                    </p>

                    <form
                        className="mt-5 space-y-5"
                        name={CONTACT_FORM_NAME}
                        method="POST"
                        data-netlify="true"
                        data-netlify-honeypot="bot-field"
                        onSubmit={handleSubmit}
                    >
                        <input type="hidden" name="form-name" value={CONTACT_FORM_NAME} />
                        <input type="hidden" name="reason" value={formState.reason} />
                        <input type="hidden" name="subReason" value={selectedSubReason} />
                        <input type="hidden" name="currentPath" value={currentPath} />
                        <input type="hidden" name="lastVisitedPath" value={lastVisitedPath || ''} />
                        <input type="hidden" name="locale" value={locale} />
                        {contactSource && <input type="hidden" name="contactSource" value={contactSource} />}
                        {effectiveUserId && <input type="hidden" name="userId" value={effectiveUserId} />}
                        {effectiveTierKey && <input type="hidden" name="plan" value={effectiveTierKey} />}
                        {appVersion && <input type="hidden" name="appVersion" value={appVersion} />}

                        <p className="hidden" aria-hidden="true">
                            <label>
                                Do not fill this field if you are human:
                                <input
                                    name="bot-field"
                                    value={formState.botField}
                                    onChange={(event) => setFormState((current) => ({ ...current, botField: event.target.value }))}
                                />
                            </label>
                        </p>

                        <div className="max-w-xl space-y-3">
                            <label htmlFor="contact-reason-trigger" className="text-sm font-semibold text-slate-800">
                                {t('contact.form.reasonLabel')}
                                <span aria-hidden="true" className="ml-1 text-rose-600">*</span>
                            </label>
                            <Select
                                name="contact-reason"
                                value={formState.reason || undefined}
                                onValueChange={handleReasonChange}
                            >
                                <SelectTrigger
                                    id="contact-reason-trigger"
                                    aria-required="true"
                                    className="h-11 w-full rounded-lg border-slate-300 text-sm focus:border-accent-400 focus:ring-accent-200"
                                >
                                    <SelectValue placeholder={t('contact.form.reasonPlaceholder')} />
                                </SelectTrigger>
                                <SelectContent>
                                    {CONTACT_REASON_OPTIONS.map((entry) => (
                                        <SelectItem key={entry.value} value={entry.value}>
                                            {t(entry.labelKey)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {isValidReason(formState.reason) && (
                            <div className="max-w-xl space-y-3">
                                <label htmlFor="contact-subreason-trigger" className="text-sm font-semibold text-slate-800">
                                    {t('contact.form.subReasonLabel')}
                                </label>
                                <Select
                                    name="contact-subreason"
                                    value={selectedSubReason || undefined}
                                    open={isSubReasonSelectOpen}
                                    onOpenChange={setIsSubReasonSelectOpen}
                                    onValueChange={handleSubReasonChange}
                                >
                                    <SelectTrigger id="contact-subreason-trigger" className="h-11 w-full rounded-lg border-slate-300 text-sm focus:border-accent-400 focus:ring-accent-200">
                                        <SelectValue placeholder={t('contact.form.subReasonPlaceholder')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={CONTACT_SUB_REASON_NONE_VALUE}>
                                            {t('contact.form.subReasonEmptyOption')}
                                        </SelectItem>
                                        {subReasonOptions.map((entry) => (
                                            <SelectItem key={entry.value} value={entry.value}>
                                                {t(entry.labelKey)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="grid max-w-xl gap-4 md:grid-cols-2">
                            <div className="space-y-3">
                                <label htmlFor="contact-name" className="text-sm font-semibold text-slate-800">
                                    {t('contact.form.nameLabel')}
                                </label>
                                <input
                                    id="contact-name"
                                    name="name"
                                    type="text"
                                    value={formState.name}
                                    onChange={handleNameChange}
                                    autoComplete="name"
                                    placeholder={t('contact.form.namePlaceholder')}
                                    className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 shadow-sm outline-none transition-colors focus:border-accent-400 focus:ring-2 focus:ring-accent-200"
                                />
                            </div>

                            <div className="space-y-3">
                                <label htmlFor="contact-email" className="text-sm font-semibold text-slate-800">
                                    {t('contact.form.emailLabel')}
                                    <span aria-hidden="true" className="ml-1 text-rose-600">*</span>
                                </label>
                                <input
                                    id="contact-email"
                                    name="email"
                                    type="email"
                                    value={formState.email}
                                    onChange={handleEmailChange}
                                    autoComplete="email"
                                    required
                                    placeholder={t('contact.form.emailPlaceholder')}
                                    className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 shadow-sm outline-none transition-colors focus:border-accent-400 focus:ring-2 focus:ring-accent-200"
                                />
                            </div>
                        </div>

                        <div className="max-w-xl space-y-3">
                            <label htmlFor="contact-message" className="text-sm font-semibold text-slate-800">
                                {t('contact.form.messageLabel')}
                                <span aria-hidden="true" className="ml-1 text-rose-600">*</span>
                            </label>
                            <textarea
                                id="contact-message"
                                name="message"
                                value={formState.message}
                                onChange={handleMessageChange}
                                required
                                maxLength={MESSAGE_MAX_LENGTH}
                                rows={6}
                                placeholder={t('contact.form.messagePlaceholder')}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition-colors focus:border-accent-400 focus:ring-2 focus:ring-accent-200"
                            />
                            <div className="flex items-center justify-between text-xs text-slate-500">
                                <span>{t('contact.form.messageLimitHint', { max: MESSAGE_MAX_LENGTH })}</span>
                                <span>{formState.message.length}/{MESSAGE_MAX_LENGTH}</span>
                            </div>
                        </div>

                        {submitStatus === 'success' && (
                            <div className="max-w-xl rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                                <div className="flex items-start gap-2">
                                    <CheckCircle size={18} weight="duotone" className="mt-0.5 shrink-0 text-emerald-700" />
                                    <div>
                                        <p className="font-semibold">{t('contact.form.successTitle')}</p>
                                        <p className="mt-1 text-emerald-800">{t('contact.form.successBody')}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {submitStatus === 'error' && (
                            <div className="max-w-xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                <div className="flex items-start gap-2">
                                    <WarningCircle size={18} weight="duotone" className="mt-0.5 shrink-0 text-amber-700" />
                                    <div>
                                        <p className="font-semibold">{validationError || t('contact.form.errorTitle')}</p>
                                        {!validationError && <p className="mt-1 text-amber-800">{t('contact.form.errorBody')}</p>}
                                        {!validationError && (
                                            <div className="mt-3 rounded-lg border border-amber-300/80 bg-white/80 p-3">
                                                <p className="font-semibold text-amber-900">{t('contact.form.fallbackTitle')}</p>
                                                <p className="mt-1 text-amber-800">{t('contact.form.fallbackBody')}</p>
                                                <a
                                                    href={fallbackEmailHref}
                                                    onClick={() => trackEvent(CONTACT_FALLBACK_EMAIL_EVENT, {
                                                        reason: isValidReason(formState.reason) ? formState.reason : null,
                                                        sub_reason: selectedSubReason || null,
                                                        locale,
                                                        has_user: hasUser,
                                                        status: submitHttpStatus,
                                                        error_type: errorType,
                                                        source: contactSource,
                                                    })}
                                                    className="mt-2 inline-flex items-center gap-2 font-semibold text-amber-800 underline decoration-amber-500/70 underline-offset-2 hover:text-amber-900"
                                                    {...getAnalyticsDebugAttributes(CONTACT_FALLBACK_EMAIL_EVENT, {
                                                        reason: isValidReason(formState.reason) ? formState.reason : null,
                                                        sub_reason: selectedSubReason || null,
                                                        locale,
                                                        has_user: hasUser,
                                                        status: submitHttpStatus,
                                                        error_type: errorType,
                                                        source: contactSource,
                                                    })}
                                                >
                                                    <EnvelopeSimple size={16} weight="duotone" />
                                                    {t('contact.form.fallbackCta')}
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={submitStatus === 'submitting'}
                            className="inline-flex h-10 items-center justify-center rounded-lg bg-accent-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-70"
                            {...getAnalyticsDebugAttributes(CONTACT_FORM_SUBMIT_EVENT, {
                                reason: isValidReason(formState.reason) ? formState.reason : null,
                                sub_reason: selectedSubReason || null,
                                locale,
                                has_user: hasUser,
                                source: contactSource,
                            })}
                        >
                            {submitStatus === 'submitting' ? t('contact.form.submitting') : t('contact.form.submit')}
                        </button>
                        <p className="text-xs text-slate-500">{t('contact.form.requiredFieldsNote')}</p>
                    </form>
                </div>
            </section>

            <section className="mt-14 border-t border-slate-200 pt-10 md:mt-16 md:pt-12">
                <h2 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
                    Frequently asked questions
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                    Here are quick answers to common contact and support topics.
                </p>

                <div className="mt-5">
                    <FaqAccordionList
                        items={CONTACT_FAQ_EXCERPT_ITEMS}
                        openItemIds={openContactFaqItemIds}
                        onToggle={handleContactFaqItemToggle}
                        variant="plain"
                        compact
                        getItemButtonProps={(item) =>
                            getAnalyticsDebugAttributes(CONTACT_FAQ_ITEM_OPEN_EVENT, {
                                item_id: item.id,
                                section_id: item.sectionId,
                                source: 'contact_page',
                            })
                        }
                        renderPanelFooter={(item) => (
                            <Link
                                to={`${faqPath}#${item.id}`}
                                onClick={() => trackEvent(CONTACT_FAQ_LINK_ITEM_EVENT, {
                                    item_id: item.id,
                                    section_id: item.sectionId,
                                    source: 'contact_page',
                                })}
                                className="inline-flex text-xs font-semibold text-accent-700 underline decoration-accent-400/70 underline-offset-2 hover:text-accent-800"
                                {...getAnalyticsDebugAttributes(CONTACT_FAQ_LINK_ITEM_EVENT, {
                                    item_id: item.id,
                                    section_id: item.sectionId,
                                    source: 'contact_page',
                                })}
                            >
                                Read full answer in FAQ
                            </Link>
                        )}
                    />
                </div>

                <Link
                    to={faqPath}
                    onClick={() => trackEvent(CONTACT_FAQ_LINK_FULL_PAGE_EVENT, {
                        source: 'contact_page',
                    })}
                    className="mt-5 inline-flex items-center rounded-lg bg-white px-3 py-2 text-sm font-semibold text-accent-700 shadow-sm ring-1 ring-slate-200 transition-colors hover:bg-slate-100"
                    {...getAnalyticsDebugAttributes(CONTACT_FAQ_LINK_FULL_PAGE_EVENT, {
                        source: 'contact_page',
                    })}
                >
                    Browse all FAQs
                </Link>
            </section>
        </MarketingLayout>
    );
};
