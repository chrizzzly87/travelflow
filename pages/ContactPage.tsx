import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CheckCircle, EnvelopeSimple, WarningCircle } from '@phosphor-icons/react';
import { MarketingLayout } from '../components/marketing/MarketingLayout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { buildLocalizedMarketingPath, extractLocaleFromPath } from '../config/routes';
import { DEFAULT_LOCALE } from '../config/locales';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import { useAuth } from '../hooks/useAuth';
import { getCurrentAccessContext } from '../services/authService';
import { getCurrentUserProfile } from '../services/profileService';

const CONTACT_FORM_NAME = 'contact';
const MESSAGE_MAX_LENGTH = 5000;
const FALLBACK_EMAIL = 'contact@wizz.art';

const CONTACT_FORM_SUBMIT_EVENT = 'contact__form--submit';
const CONTACT_FORM_SUCCESS_EVENT = 'contact__form--success';
const CONTACT_FORM_FAILED_EVENT = 'contact__form--failed';
const CONTACT_FALLBACK_EMAIL_EVENT = 'contact__fallback--email';

const CONTACT_REASON_OPTIONS = [
    { value: 'bug_report', labelKey: 'contact.form.reasonOptions.bugReport' },
    { value: 'feature_request', labelKey: 'contact.form.reasonOptions.featureRequest' },
    { value: 'billing_account', labelKey: 'contact.form.reasonOptions.billingAccount' },
    { value: 'data_privacy', labelKey: 'contact.form.reasonOptions.dataPrivacy' },
    { value: 'partnership', labelKey: 'contact.form.reasonOptions.partnership' },
    { value: 'other', labelKey: 'contact.form.reasonOptions.other' },
] as const;

type ContactReason = (typeof CONTACT_REASON_OPTIONS)[number]['value'];

type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error';
type ContactErrorType = 'validation' | 'quota_or_limit' | 'http_error' | 'network_error' | null;

interface ContactFormState {
    reason: '' | ContactReason;
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

const isValidReason = (value: string): value is ContactReason => (
    CONTACT_REASON_OPTIONS.some((entry) => entry.value === value)
);

const isLikelyQuotaStatus = (status: number): boolean => [402, 403, 409, 429, 503].includes(status);

export const ContactPage: React.FC = () => {
    const { t } = useTranslation('common');
    const location = useLocation();
    const locale = extractLocaleFromPath(location.pathname) ?? DEFAULT_LOCALE;
    const { access } = useAuth();

    const [formState, setFormState] = useState<ContactFormState>({
        reason: '',
        name: '',
        email: '',
        message: '',
        botField: '',
    });
    const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
    const [submitHttpStatus, setSubmitHttpStatus] = useState<number | null>(null);
    const [errorType, setErrorType] = useState<ContactErrorType>(null);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [resolvedAccess, setResolvedAccess] = useState<ResolvedAccessContext>({
        userId: null,
        tierKey: null,
        email: null,
    });

    const nameTouchedRef = useRef(false);
    const emailTouchedRef = useRef(false);

    const currentPath = `${location.pathname}${location.search}`;
    const appVersion = useMemo(() => {
        const rawVersion = (import.meta.env.VITE_APP_VERSION || '').trim();
        return rawVersion.length ? rawVersion : null;
    }, []);

    const authenticatedAccess = access && !access.isAnonymous && access.userId ? access : null;
    const effectiveUserId = authenticatedAccess?.userId ?? resolvedAccess.userId;
    const effectiveTierKey = authenticatedAccess?.tierKey ?? resolvedAccess.tierKey;
    const hasUser = Boolean(effectiveUserId);

    useEffect(() => {
        if (!authenticatedAccess?.email) return;
        setFormState((current) => {
            if (emailTouchedRef.current || current.email.trim().length > 0) return current;
            return { ...current, email: authenticatedAccess.email || '' };
        });
    }, [authenticatedAccess?.email]);

    useEffect(() => {
        let active = true;

        void Promise.all([
            getCurrentAccessContext().catch(() => null),
            getCurrentUserProfile().catch(() => null),
        ]).then(([accessContext, profile]) => {
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
        });

        return () => {
            active = false;
        };
    }, []);

    const handleReasonChange = (value: string) => {
        setSubmitStatus('idle');
        setValidationError(null);
        setErrorType(null);
        setSubmitHttpStatus(null);
        setFormState((current) => ({
            ...current,
            reason: isValidReason(value) ? value : '',
        }));
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
            locale,
            has_user: hasUser,
        });

        setSubmitStatus('submitting');

        const payload = new URLSearchParams();
        payload.set('form-name', CONTACT_FORM_NAME);
        payload.set('reason', reason);
        payload.set('name', formState.name.trim());
        payload.set('email', formState.email.trim());
        payload.set('message', formState.message.trim());
        payload.set('bot-field', formState.botField);
        payload.set('currentPath', currentPath);
        payload.set('locale', locale);
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
                    locale,
                    has_user: hasUser,
                    status: response.status,
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
                locale,
                has_user: hasUser,
                status: response.status,
                error_type: nextErrorType,
            });
        } catch {
            setSubmitStatus('error');
            setErrorType('network_error');
            setSubmitHttpStatus(null);

            trackEvent(CONTACT_FORM_FAILED_EVENT, {
                reason,
                locale,
                has_user: hasUser,
                status: null,
                error_type: 'network_error',
            });
        }
    };

    const fallbackEmailHref = `mailto:${FALLBACK_EMAIL}`;

    return (
        <MarketingLayout>
            <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                <h1 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
                    {t('contact.title')}
                </h1>
                <p className="mt-4 text-sm leading-6 text-slate-600">
                    {t('contact.description')}
                </p>

                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <p className="font-semibold text-slate-900">{t('contact.emailLabel')}</p>
                    <a
                        href={`mailto:${t('contact.emailValue')}`}
                        className="mt-2 inline-flex items-center gap-2 font-semibold text-accent-700 hover:text-accent-800"
                    >
                        <EnvelopeSimple size={16} weight="duotone" />
                        {t('contact.emailValue')}
                    </a>
                    <p className="mt-3 text-slate-500">{t('contact.responseNote')}</p>
                </div>

                <form
                    className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-5"
                    name={CONTACT_FORM_NAME}
                    method="POST"
                    data-netlify="true"
                    data-netlify-honeypot="bot-field"
                    onSubmit={handleSubmit}
                >
                    <input type="hidden" name="form-name" value={CONTACT_FORM_NAME} />
                    <input type="hidden" name="reason" value={formState.reason} />
                    <input type="hidden" name="currentPath" value={currentPath} />
                    <input type="hidden" name="locale" value={locale} />
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

                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('contact.form.title')}</p>
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="contact-reason-trigger" className="text-sm font-semibold text-slate-800">
                            {t('contact.form.reasonLabel')}
                        </label>
                        <Select value={formState.reason || undefined} onValueChange={handleReasonChange}>
                            <SelectTrigger id="contact-reason-trigger" className="h-10 w-full rounded-lg border-slate-300 text-sm focus:border-accent-400 focus:ring-accent-200">
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

                    <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
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
                                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 shadow-sm outline-none transition-colors focus:border-accent-400 focus:ring-2 focus:ring-accent-200"
                            />
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="contact-email" className="text-sm font-semibold text-slate-800">
                                {t('contact.form.emailLabel')}
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
                                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 shadow-sm outline-none transition-colors focus:border-accent-400 focus:ring-2 focus:ring-accent-200"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="contact-message" className="text-sm font-semibold text-slate-800">
                            {t('contact.form.messageLabel')}
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

                    <p className="text-xs text-slate-500">{t('contact.form.privacyNote')}</p>

                    {submitStatus === 'success' && (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
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
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
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
                                                    locale,
                                                    has_user: hasUser,
                                                    status: submitHttpStatus,
                                                    error_type: errorType,
                                                })}
                                                className="mt-2 inline-flex items-center gap-2 font-semibold text-amber-800 underline decoration-amber-500/70 underline-offset-2 hover:text-amber-900"
                                                {...getAnalyticsDebugAttributes(CONTACT_FALLBACK_EMAIL_EVENT, {
                                                    reason: isValidReason(formState.reason) ? formState.reason : null,
                                                    locale,
                                                    has_user: hasUser,
                                                    status: submitHttpStatus,
                                                    error_type: errorType,
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
                            locale,
                            has_user: hasUser,
                        })}
                    >
                        {submitStatus === 'submitting' ? t('contact.form.submitting') : t('contact.form.submit')}
                    </button>
                </form>

                <Link
                    to={buildLocalizedMarketingPath('home', locale)}
                    className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 transition-colors hover:text-accent-700"
                >
                    <ArrowLeft size={14} weight="bold" />
                    {t('contact.backHome')}
                </Link>
            </section>
        </MarketingLayout>
    );
};
