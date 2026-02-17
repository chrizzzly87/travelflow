import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, SpinnerGap as Loader2 } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { MarketingLayout } from '../components/marketing/MarketingLayout';
import { useAuth } from '../hooks/useAuth';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import { processQueuedTripGenerationAfterAuth, runOpportunisticTripQueueCleanup } from '../services/tripGenerationQueueService';
import type { OAuthProviderId } from '../services/authService';
import {
    buildPasswordResetRedirectUrl,
    clearRememberedAuthReturnPath,
    getRememberedAuthReturnPath,
    rememberAuthReturnPath,
    resolvePreferredNextPath,
} from '../services/authNavigationService';
import {
    clearPendingOAuthProvider,
    getLastUsedOAuthProvider,
    setPendingOAuthProvider,
} from '../services/authUiPreferencesService';
import { normalizeAppLanguage } from '../utils';
import { SocialProviderIcon } from '../components/auth/SocialProviderIcon';

type AuthMode = 'login' | 'register';

interface OAuthButtonConfig {
    provider: OAuthProviderId;
    labelKey: string;
    buttonClassName: string;
}

const BASE_OAUTH_BUTTONS: OAuthButtonConfig[] = [
    {
        provider: 'google',
        labelKey: 'actions.oauthGoogle',
        buttonClassName: 'hover:border-[#ea4335]/40 hover:bg-[#fff7f7]',
    },
    {
        provider: 'apple',
        labelKey: 'actions.oauthApple',
        buttonClassName: 'hover:border-slate-400 hover:bg-slate-50',
    },
    {
        provider: 'facebook',
        labelKey: 'actions.oauthFacebook',
        buttonClassName: 'hover:border-[#1877f2]/40 hover:bg-[#f3f8ff]',
    },
];

const KAKAO_OAUTH_BUTTON: OAuthButtonConfig = {
    provider: 'kakao',
    labelKey: 'actions.oauthKakao',
    buttonClassName: 'hover:border-[#FFE812]/60 hover:bg-[#fffde6]',
};

const getOAuthButtons = (language: string): OAuthButtonConfig[] => {
    if (normalizeAppLanguage(language) === 'ko') {
        return [KAKAO_OAUTH_BUTTON, ...BASE_OAUTH_BUTTONS];
    }
    return BASE_OAUTH_BUTTONS;
};

const normalizeErrorCode = (error: unknown): string => {
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

const buildLoginRedirectUrl = (claimRequestId: string | null, nextPath: string): string | undefined => {
    if (typeof window === 'undefined') return undefined;
    const redirectUrl = new URL('/login', window.location.origin);
    if (claimRequestId) redirectUrl.searchParams.set('claim', claimRequestId);
    if (nextPath) redirectUrl.searchParams.set('next', nextPath);
    return redirectUrl.toString();
};

export const LoginPage: React.FC = () => {
    const { t, i18n } = useTranslation('auth');
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const {
        isLoading,
        isAuthenticated,
        isAnonymous,
        loginWithPassword,
        registerWithPassword,
        loginWithOAuth,
        sendPasswordResetEmail,
    } = useAuth();

    const [mode, setMode] = useState<AuthMode>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isQueueProcessing, setIsQueueProcessing] = useState(false);
    const [hasQueueAttempted, setHasQueueAttempted] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [infoMessage, setInfoMessage] = useState<string | null>(null);
    const [lastUsedProvider, setLastUsedProvider] = useState<OAuthProviderId | null>(() => getLastUsedOAuthProvider());

    const oauthButtons = useMemo(() => getOAuthButtons(i18n.language), [i18n.language]);

    const claimRequestId = (searchParams.get('claim') || '').trim() || null;
    const stateFrom = (location.state as { from?: string } | null)?.from || '';
    const rememberedNextPath = useMemo(() => getRememberedAuthReturnPath(), []);
    const nextPath = resolvePreferredNextPath(
        searchParams.get('next'),
        stateFrom,
        rememberedNextPath,
        '/create-trip'
    );

    const oauthRedirectTo = useMemo(
        () => buildLoginRedirectUrl(claimRequestId, nextPath),
        [claimRequestId, nextPath]
    );
    const passwordResetRedirectTo = useMemo(
        () => buildPasswordResetRedirectUrl(nextPath),
        [nextPath]
    );

    useEffect(() => {
        trackEvent('auth__page--view', { has_claim: Boolean(claimRequestId) });
        void runOpportunisticTripQueueCleanup();
    }, [claimRequestId]);

    useEffect(() => {
        rememberAuthReturnPath(nextPath);
    }, [nextPath]);

    useEffect(() => {
        const handleStorageUpdate = () => {
            setLastUsedProvider(getLastUsedOAuthProvider());
        };
        window.addEventListener('storage', handleStorageUpdate);
        return () => window.removeEventListener('storage', handleStorageUpdate);
    }, []);

    useEffect(() => {
        const callbackError = searchParams.get('error_description') || searchParams.get('error');
        if (callbackError) {
            clearPendingOAuthProvider();
            trackEvent('auth__callback--error', { has_claim: Boolean(claimRequestId) });
            setErrorMessage(decodeURIComponent(callbackError));
            return;
        }
        const hasCallbackCode = Boolean(searchParams.get('code'));
        if (hasCallbackCode || (typeof window !== 'undefined' && window.location.hash.includes('access_token='))) {
            trackEvent('auth__callback--received', { has_claim: Boolean(claimRequestId) });
        }
    }, [searchParams, claimRequestId]);

    const processQueuedRequest = useCallback(async () => {
        if (!claimRequestId) return;
        if (hasQueueAttempted) return;

        setHasQueueAttempted(true);
        setIsQueueProcessing(true);
        setErrorMessage(null);
        setInfoMessage(t('states.queuedProcessing'));

        try {
            const result = await processQueuedTripGenerationAfterAuth(claimRequestId);
            trackEvent('auth__queue--fulfilled', { request_id: claimRequestId });
            setInfoMessage(t('states.queuedSuccess'));
            clearRememberedAuthReturnPath();
            navigate(`/trip/${result.tripId}`, { replace: true });
        } catch (error) {
            trackEvent('auth__queue--failed', { request_id: claimRequestId });
            setErrorMessage(t('errors.queue_claim_failed'));
        } finally {
            setIsQueueProcessing(false);
        }
    }, [claimRequestId, hasQueueAttempted, navigate, t]);

    useEffect(() => {
        if (isLoading) return;
        if (!isAuthenticated || isAnonymous) return;
        if (claimRequestId) {
            void processQueuedRequest();
            return;
        }
        clearRememberedAuthReturnPath();
        navigate(nextPath, { replace: true });
    }, [
        claimRequestId,
        isAnonymous,
        isAuthenticated,
        isLoading,
        navigate,
        nextPath,
        processQueuedRequest,
    ]);

    const handleModeChange = (nextMode: AuthMode) => {
        setMode(nextMode);
        setErrorMessage(null);
        setInfoMessage(null);
        trackEvent('auth__method--select', { method: nextMode });
    };

    const handlePasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!email.trim() || !password.trim()) {
            setErrorMessage(t('errors.default'));
            return;
        }
        clearPendingOAuthProvider();

        setIsSubmitting(true);
        setErrorMessage(null);
        setInfoMessage(null);

        if (mode === 'login') {
            const response = await loginWithPassword(email.trim(), password);
            if (response.error) {
                const errorCode = normalizeErrorCode(response.error);
                setErrorMessage(t(`errors.${errorCode}`, t('errors.default')));
            } else {
                setInfoMessage(t('states.alreadyAuthenticated'));
            }
            setIsSubmitting(false);
            return;
        }

        const response = await registerWithPassword(
            email.trim(),
            password,
            { emailRedirectTo: oauthRedirectTo }
        );
        if (response.error) {
            const errorCode = normalizeErrorCode(response.error);
            setErrorMessage(t(`errors.${errorCode}`, t('errors.default')));
        } else if (!response.data.session) {
            setInfoMessage(t('states.emailConfirmationSent'));
        } else {
            setInfoMessage(t('states.alreadyAuthenticated'));
        }
        setIsSubmitting(false);
    };

    const handleOAuthLogin = async (provider: OAuthProviderId) => {
        setErrorMessage(null);
        setInfoMessage(null);
        setPendingOAuthProvider(provider);
        trackEvent('auth__method--select', { method: provider });
        const response = await loginWithOAuth(provider, oauthRedirectTo);
        if (response.error) {
            clearPendingOAuthProvider();
            const errorCode = normalizeErrorCode(response.error);
            setErrorMessage(t(`errors.${errorCode}`, t('errors.default')));
            return;
        }
        setInfoMessage(t('actions.submitting'));
    };

    const handlePasswordResetRequest = async (intent: 'forgot_password' | 'set_password') => {
        const normalizedEmail = email.trim();
        if (!normalizedEmail) {
            setErrorMessage(t('errors.email_required_for_reset'));
            setInfoMessage(null);
            return;
        }

        setIsSubmitting(true);
        setErrorMessage(null);
        setInfoMessage(null);
        trackEvent('auth__password_reset--request', { source: 'page', intent });

        const response = await sendPasswordResetEmail(normalizedEmail, {
            redirectTo: passwordResetRedirectTo,
            intent,
        });

        if (response.error) {
            setErrorMessage(t('errors.password_reset_failed'));
            trackEvent('auth__password_reset--failed', { source: 'page', intent });
            setIsSubmitting(false);
            return;
        }

        setInfoMessage(t(intent === 'set_password' ? 'states.setPasswordSent' : 'states.passwordResetSent'));
        trackEvent('auth__password_reset--requested', { source: 'page', intent });
        setIsSubmitting(false);
    };

    return (
        <MarketingLayout>
            <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_360px]">
                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
                    <p className="text-xs font-semibold uppercase tracking-wide text-accent-600">{t('hero.eyebrow')}</p>
                    <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">{t('hero.title')}</h1>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{t('hero.description')}</p>
                    {claimRequestId && (
                        <div className="mt-4 rounded-2xl border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-900">
                            {t('copy.queueHint')}
                        </div>
                    )}

                    <div className="mt-6 inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1">
                        <button
                            type="button"
                            onClick={() => handleModeChange('login')}
                            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                                mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                            }`}
                            {...getAnalyticsDebugAttributes('auth__tab--login')}
                        >
                            {t('tabs.login')}
                        </button>
                        <button
                            type="button"
                            onClick={() => handleModeChange('register')}
                            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                                mode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                            }`}
                            {...getAnalyticsDebugAttributes('auth__tab--register')}
                        >
                            {t('tabs.register')}
                        </button>
                    </div>

                    <form className="mt-6 space-y-4" onSubmit={handlePasswordSubmit}>
                        <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('labels.email')}</span>
                            <input
                                type="email"
                                autoComplete="email"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                required
                                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-accent-500"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('labels.password')}</span>
                            <input
                                type="password"
                                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                required
                                minLength={8}
                                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-accent-500"
                            />
                        </label>
                        {mode === 'login' && (
                            <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                                    <button
                                        type="button"
                                        onClick={() => void handlePasswordResetRequest('forgot_password')}
                                        disabled={isSubmitting || isQueueProcessing}
                                        className="font-semibold text-accent-700 hover:text-accent-800 disabled:cursor-not-allowed disabled:opacity-60"
                                        {...getAnalyticsDebugAttributes('auth__password_reset--request', { source: 'page', intent: 'forgot_password' })}
                                    >
                                        {t('actions.forgotPassword')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void handlePasswordResetRequest('set_password')}
                                        disabled={isSubmitting || isQueueProcessing}
                                        className="font-semibold text-accent-700 hover:text-accent-800 disabled:cursor-not-allowed disabled:opacity-60"
                                        {...getAnalyticsDebugAttributes('auth__password_reset--request', { source: 'page', intent: 'set_password' })}
                                    >
                                        {t('actions.setPasswordSocial')}
                                    </button>
                                </div>
                                <p className="text-xs text-slate-500">{t('copy.passwordResetHint')}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isSubmitting || isQueueProcessing}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
                            {...getAnalyticsDebugAttributes(`auth__password--${mode}`)}
                        >
                            {(isSubmitting || isQueueProcessing) ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                            {isSubmitting ? t('actions.submitting') : mode === 'login' ? t('actions.submitLogin') : t('actions.submitRegister')}
                        </button>
                    </form>

                    <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wide text-slate-400">
                        <span className="h-px flex-1 bg-slate-200" />
                        {t('copy.oauthDivider')}
                        <span className="h-px flex-1 bg-slate-200" />
                    </div>

                    <div className="space-y-2">
                        {oauthButtons.map((item) => {
                            const isLastUsed = lastUsedProvider === item.provider;
                            return (
                                <button
                                    key={item.provider}
                                    type="button"
                                    onClick={() => void handleOAuthLogin(item.provider)}
                                    disabled={isSubmitting || isQueueProcessing}
                                    className={`relative inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                        isLastUsed
                                            ? 'border-slate-400 bg-white'
                                            : 'border-slate-300 bg-white'
                                    } ${item.buttonClassName}`}
                                    {...getAnalyticsDebugAttributes(`auth__oauth--${item.provider}`)}
                                >
                                    <SocialProviderIcon provider={item.provider} size={18} />
                                    <span>{t(item.labelKey)}</span>
                                    {isLastUsed && (
                                        <span className="pointer-events-none absolute -top-2 right-3 rounded-2xl border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 shadow-sm">
                                            {t('copy.lastUsedTag')}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div className="mt-5 text-sm text-slate-600">
                        {mode === 'login' ? (
                            <button
                                type="button"
                                onClick={() => handleModeChange('register')}
                                className="font-semibold text-accent-700 hover:text-accent-800"
                            >
                                {t('copy.switchToRegister')}
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => handleModeChange('login')}
                                className="font-semibold text-accent-700 hover:text-accent-800"
                            >
                                {t('copy.switchToLogin')}
                            </button>
                        )}
                    </div>

                    {errorMessage && (
                        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                            {errorMessage}
                        </div>
                    )}
                    {infoMessage && (
                        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                            {infoMessage}
                        </div>
                    )}
                </section>

                <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
                    <h2 className="text-base font-bold text-slate-900">{t('benefits.title')}</h2>
                    <ul className="mt-4 space-y-3 text-sm text-slate-600">
                        {(t('benefits.items', { returnObjects: true }) as string[]).map((item) => (
                            <li key={item} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                                {item}
                            </li>
                        ))}
                    </ul>
                </aside>
            </div>
        </MarketingLayout>
    );
};
