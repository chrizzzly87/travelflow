import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ArrowRight,
    SpinnerGap as Loader2,
    X,
} from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import type { OAuthProviderId } from '../../services/authService';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { buildPasswordResetRedirectUrl } from '../../services/authNavigationService';
import {
    clearPendingOAuthProvider,
    getLastUsedOAuthProvider,
    setPendingOAuthProvider,
} from '../../services/authUiPreferencesService';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { getAuthRequestTimeoutMs, getAuthRestoreTimeoutMs } from '../../services/networkStatus';
import { normalizeAppLanguage } from '../../utils';
import { SocialProviderIcon } from './SocialProviderIcon';

type AuthMode = 'login' | 'register';

type CloseReason = 'dismiss' | 'backdrop' | 'escape' | 'success';

interface AuthModalProps {
    isOpen: boolean;
    source: string;
    nextPath: string;
    reloadOnSuccess: boolean;
    onClose: (reason: CloseReason) => void;
}

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

type TimedRequestOutcome<T> = (
    | { status: 'success'; value: T }
    | { status: 'error'; error: unknown }
    | { status: 'timeout' }
);

export const AuthModal: React.FC<AuthModalProps> = ({
    isOpen,
    source,
    nextPath,
    reloadOnSuccess,
    onClose,
}) => {
    const { t, i18n } = useTranslation('auth');
    const navigate = useNavigate();
    const {
        isLoading,
        isAuthenticated,
        isAnonymous,
        loginWithPassword,
        registerWithPassword,
        loginWithOAuth,
        sendPasswordResetEmail,
    } = useAuth();
    const { isOnline, isSlowConnection } = useNetworkStatus({ probeWhileOffline: false });

    const [mode, setMode] = useState<AuthMode>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [infoMessage, setInfoMessage] = useState<string | null>(null);
    const [lastUsedProvider, setLastUsedProviderState] = useState<OAuthProviderId | null>(() => getLastUsedOAuthProvider());
    const [sessionRestoreState, setSessionRestoreState] = useState<'idle' | 'restoring' | 'restored'>('idle');
    const hasHandledSuccessRef = useRef(false);
    const hasInteractiveAttemptRef = useRef(false);
    const pendingRequestRef = useRef(0);
    const dialogRef = useRef<HTMLDivElement | null>(null);
    const closeButtonRef = useRef<HTMLButtonElement | null>(null);

    useFocusTrap({
        isActive: isOpen,
        containerRef: dialogRef,
        initialFocusRef: closeButtonRef,
    });

    const oauthButtons = useMemo(() => getOAuthButtons(i18n.language), [i18n.language]);
    const emailInputId = 'auth-modal-email';
    const secondaryInputId = 'auth-modal-secondary';

    const oauthRedirectTo = useMemo(() => {
        if (typeof window === 'undefined') return undefined;
        return window.location.href;
    }, []);
    const passwordResetRedirectTo = useMemo(
        () => buildPasswordResetRedirectUrl(nextPath),
        [nextPath]
    );

    const completeSuccessfulAuth = useCallback(
        (
            flow: 'interactive' | 'restored',
            options?: { skipReload?: boolean }
        ) => {
            if (hasHandledSuccessRef.current) return;
            hasHandledSuccessRef.current = true;
            trackEvent('auth__modal--success', { source, flow });
            onClose('success');

            const target = nextPath || (typeof window !== 'undefined'
                ? `${window.location.pathname}${window.location.search}${window.location.hash}`
                : '/create-trip');

            if (reloadOnSuccess && !options?.skipReload) {
                window.location.assign(target);
                return;
            }

            navigate(target, { replace: true });
        },
        [navigate, nextPath, onClose, reloadOnSuccess, source]
    );

    const runTimedRequest = useCallback(async <T,>(
        request: () => Promise<T>,
        timeoutMs: number
    ): Promise<TimedRequestOutcome<T>> => {
        let timeoutId = 0;
        const timeoutPromise = new Promise<TimedRequestOutcome<T>>((resolve) => {
            timeoutId = window.setTimeout(() => resolve({ status: 'timeout' }), timeoutMs);
        });
        const requestPromise = request()
            .then((value) => ({ status: 'success', value } as const))
            .catch((error: unknown) => ({ status: 'error', error } as const));
        const result = await Promise.race([requestPromise, timeoutPromise]);
        window.clearTimeout(timeoutId);
        return result;
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        trackEvent('auth__modal--open', { source });
    }, [isOpen, source]);

    useEffect(() => {
        if (!isOpen) {
            setIsSubmitting(false);
            setErrorMessage(null);
            setInfoMessage(null);
            setSessionRestoreState('idle');
            hasHandledSuccessRef.current = false;
            hasInteractiveAttemptRef.current = false;
            pendingRequestRef.current += 1;
            return;
        }

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [isOpen]);

    useEffect(() => {
        const handleStorageUpdate = () => {
            setLastUsedProviderState(getLastUsedOAuthProvider());
        };
        window.addEventListener('storage', handleStorageUpdate);
        return () => window.removeEventListener('storage', handleStorageUpdate);
    }, []);

    useEffect(() => {
        if (!isOpen || hasInteractiveAttemptRef.current) return;
        if (isLoading) {
            setSessionRestoreState('restoring');
            return;
        }
        if (isAuthenticated && !isAnonymous) {
            setSessionRestoreState('restored');
            return;
        }
        setSessionRestoreState('idle');
    }, [isAnonymous, isAuthenticated, isLoading, isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            if (sessionRestoreState === 'restoring') return;
            event.preventDefault();
            trackEvent('auth__modal--close', { source, reason: 'escape' });
            onClose('escape');
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose, sessionRestoreState, source]);

    useEffect(() => {
        if (!isOpen || isLoading || hasHandledSuccessRef.current) return;
        if (!isAuthenticated || isAnonymous) return;
        if (!hasInteractiveAttemptRef.current) {
            setSessionRestoreState('restored');
            return;
        }
        completeSuccessfulAuth('interactive');
    }, [completeSuccessfulAuth, isAnonymous, isAuthenticated, isLoading, isOpen]);

    useEffect(() => {
        if (!isOpen || sessionRestoreState !== 'restored' || hasHandledSuccessRef.current) return;
        const timer = window.setTimeout(() => {
            completeSuccessfulAuth('restored', { skipReload: true });
        }, 2000);
        return () => window.clearTimeout(timer);
    }, [completeSuccessfulAuth, isOpen, sessionRestoreState]);

    useEffect(() => {
        if (!isOpen) return;
        if (sessionRestoreState !== 'restoring') return;
        const timer = window.setTimeout(() => {
            if (sessionRestoreState !== 'restoring') return;
            setSessionRestoreState('idle');
            setErrorMessage(t(
                isOnline
                    ? (isSlowConnection ? 'errors.restore_timeout_slow_network' : 'errors.restore_timeout')
                    : 'errors.offline'
            ));
            setInfoMessage(null);
            trackEvent('auth__modal--restore_timeout', {
                source,
                is_online: isOnline,
                is_slow_network: isSlowConnection,
            });
        }, getAuthRestoreTimeoutMs(isSlowConnection));
        return () => window.clearTimeout(timer);
    }, [isOnline, isOpen, isSlowConnection, sessionRestoreState, source, t]);

    if (!isOpen) return null;
    const isRestoreBlocked = sessionRestoreState === 'restoring' || sessionRestoreState === 'restored';

    const handleModeChange = (nextMode: AuthMode) => {
        if (isRestoreBlocked) return;
        setMode(nextMode);
        setErrorMessage(null);
        setInfoMessage(null);
        trackEvent('auth__method--select', { method: nextMode, source: 'modal' });
    };

    const handlePasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (isSubmitting) return;
        if (isRestoreBlocked) return;
        if (!isOnline) {
            setErrorMessage(t('errors.offline'));
            setInfoMessage(null);
            return;
        }
        if (!email.trim() || !password.trim()) {
            setErrorMessage(t('errors.default'));
            return;
        }
        clearPendingOAuthProvider();

        const requestId = pendingRequestRef.current + 1;
        pendingRequestRef.current = requestId;
        hasInteractiveAttemptRef.current = true;
        setSessionRestoreState('idle');
        setIsSubmitting(true);
        setErrorMessage(null);
        setInfoMessage(isSlowConnection ? t('states.slowNetworkDetected') : null);
        const timeoutMs = getAuthRequestTimeoutMs(isSlowConnection);

        try {
            if (mode === 'login') {
                const outcome = await runTimedRequest(
                    () => loginWithPassword(email.trim(), password),
                    timeoutMs
                );
                if (pendingRequestRef.current !== requestId) return;
                if (outcome.status === 'timeout') {
                    setErrorMessage(t(isSlowConnection ? 'errors.request_timeout_slow_network' : 'errors.request_timeout'));
                    setInfoMessage(null);
                    return;
                }
                if (outcome.status === 'error') {
                    setErrorMessage(t('errors.default'));
                    setInfoMessage(null);
                    return;
                }
                if (outcome.value.error) {
                    const errorCode = normalizeErrorCode(outcome.value.error);
                    setErrorMessage(t(`errors.${errorCode}`, t('errors.default')));
                } else {
                    setInfoMessage(t('states.alreadyAuthenticated'));
                }
            } else {
                const outcome = await runTimedRequest(
                    () => registerWithPassword(email.trim(), password, { emailRedirectTo: oauthRedirectTo }),
                    timeoutMs
                );
                if (pendingRequestRef.current !== requestId) return;
                if (outcome.status === 'timeout') {
                    setErrorMessage(t(isSlowConnection ? 'errors.request_timeout_slow_network' : 'errors.request_timeout'));
                    setInfoMessage(null);
                    return;
                }
                if (outcome.status === 'error') {
                    setErrorMessage(t('errors.default'));
                    setInfoMessage(null);
                    return;
                }
                if (outcome.value.error) {
                    const errorCode = normalizeErrorCode(outcome.value.error);
                    setErrorMessage(t(`errors.${errorCode}`, t('errors.default')));
                } else if (!outcome.value.data.session) {
                    setInfoMessage(t('states.emailConfirmationSent'));
                } else {
                    setInfoMessage(t('states.alreadyAuthenticated'));
                }
            }
        } finally {
            if (pendingRequestRef.current === requestId) {
                setIsSubmitting(false);
            }
        }
    };

    const handleOAuthLogin = async (provider: OAuthProviderId) => {
        if (isRestoreBlocked) return;
        if (!isOnline) {
            setErrorMessage(t('errors.offline'));
            setInfoMessage(null);
            return;
        }
        const requestId = pendingRequestRef.current + 1;
        pendingRequestRef.current = requestId;
        hasInteractiveAttemptRef.current = true;
        setSessionRestoreState('idle');
        setIsSubmitting(true);
        setErrorMessage(null);
        setInfoMessage(isSlowConnection ? t('states.slowNetworkDetected') : null);
        setPendingOAuthProvider(provider);
        trackEvent('auth__method--select', { method: provider, source: 'modal' });
        const outcome = await runTimedRequest(
            () => loginWithOAuth(provider, oauthRedirectTo),
            getAuthRequestTimeoutMs(isSlowConnection)
        );
        if (pendingRequestRef.current !== requestId) return;
        if (outcome.status === 'timeout') {
            clearPendingOAuthProvider();
            setErrorMessage(t(isSlowConnection ? 'errors.request_timeout_slow_network' : 'errors.request_timeout'));
            setInfoMessage(null);
            setIsSubmitting(false);
            return;
        }
        if (outcome.status === 'error') {
            clearPendingOAuthProvider();
            setErrorMessage(t('errors.default'));
            setInfoMessage(null);
            setIsSubmitting(false);
            return;
        }
        if (outcome.value.error) {
            clearPendingOAuthProvider();
            const errorCode = normalizeErrorCode(outcome.value.error);
            setErrorMessage(t(`errors.${errorCode}`, t('errors.default')));
            setIsSubmitting(false);
            return;
        }
        setIsSubmitting(false);
        setInfoMessage(t('actions.submitting'));
    };

    const handlePasswordResetRequest = async (intent: 'forgot_password' | 'set_password') => {
        if (isRestoreBlocked) return;
        if (!isOnline) {
            setErrorMessage(t('errors.offline'));
            setInfoMessage(null);
            return;
        }
        const normalizedEmail = email.trim();
        if (!normalizedEmail) {
            setErrorMessage(t('errors.email_required_for_reset'));
            setInfoMessage(null);
            return;
        }

        const requestId = pendingRequestRef.current + 1;
        pendingRequestRef.current = requestId;
        setIsSubmitting(true);
        setErrorMessage(null);
        setInfoMessage(isSlowConnection ? t('states.slowNetworkDetected') : null);
        trackEvent('auth__password_reset--request', { source: 'modal', intent });

        const outcome = await runTimedRequest(
            () => sendPasswordResetEmail(normalizedEmail, { redirectTo: passwordResetRedirectTo, intent }),
            getAuthRequestTimeoutMs(isSlowConnection)
        );
        if (pendingRequestRef.current !== requestId) return;
        if (outcome.status === 'timeout') {
            setErrorMessage(t(isSlowConnection ? 'errors.request_timeout_slow_network' : 'errors.request_timeout'));
            setInfoMessage(null);
            setIsSubmitting(false);
            return;
        }
        if (outcome.status === 'error') {
            setErrorMessage(t('errors.password_reset_failed'));
            trackEvent('auth__password_reset--failed', { source: 'modal', intent });
            setIsSubmitting(false);
            return;
        }
        if (outcome.value.error) {
            setErrorMessage(t('errors.password_reset_failed'));
            trackEvent('auth__password_reset--failed', { source: 'modal', intent });
            setIsSubmitting(false);
            return;
        }

        setInfoMessage(t(intent === 'set_password' ? 'states.setPasswordSent' : 'states.passwordResetSent'));
        trackEvent('auth__password_reset--requested', { source: 'modal', intent });
        setIsSubmitting(false);
    };

    const handleFormKeyDown = (event: React.KeyboardEvent<HTMLFormElement>) => {
        if (event.key !== 'Enter') return;
        if (event.nativeEvent.isComposing) return;
        if (!(event.target instanceof HTMLInputElement)) return;
        event.preventDefault();
        event.currentTarget.requestSubmit();
    };

    return (
        <div className="fixed inset-0 z-[21000] flex items-center justify-center p-4 sm:p-6">
            <button
                type="button"
                className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]"
                onClick={() => {
                    if (sessionRestoreState === 'restoring') return;
                    trackEvent('auth__modal--close', { source, reason: 'backdrop' });
                    onClose('backdrop');
                }}
                aria-label="Close authentication modal"
            />
            <div
                ref={dialogRef}
                className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl"
                role="dialog"
                aria-modal="true"
                aria-label="Authentication modal"
            >
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
                    <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-accent-600">{t('hero.eyebrow')}</p>
                        <h2 className="mt-1 text-lg font-bold text-slate-900">{t('hero.title')}</h2>
                        <p className="mt-1 text-sm text-slate-600">{t('hero.description')}</p>
                    </div>
                    <button
                        ref={closeButtonRef}
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                        onClick={() => {
                            if (sessionRestoreState === 'restoring') return;
                            trackEvent('auth__modal--close', { source, reason: 'dismiss' });
                            onClose('dismiss');
                        }}
                        disabled={sessionRestoreState === 'restoring'}
                        aria-label="Close authentication modal"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="px-5 py-4">
                    {!isOnline && (
                        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" aria-live="polite">
                            <p className="font-semibold">{t('states.offlineNoticeTitle')}</p>
                            <p className="mt-1">{t('states.offlineNoticeBody')}</p>
                        </div>
                    )}
                    {sessionRestoreState === 'restoring' && (
                        <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900" aria-live="polite">
                            <span className="inline-flex items-center gap-2 font-semibold">
                                <Loader2 size={14} className="animate-spin" />
                                {t('states.restoringSession')}
                            </span>
                        </div>
                    )}
                    {sessionRestoreState === 'restored' && (
                        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" aria-live="polite">
                            <p className="font-semibold">{t('states.sessionRestored')}</p>
                        </div>
                    )}

                    {sessionRestoreState !== 'restored' && (
                        <>
                            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1">
                                <button
                                    type="button"
                                    onClick={() => handleModeChange('login')}
                                    disabled={isSubmitting || isRestoreBlocked}
                                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                                        mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    {t('tabs.login')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleModeChange('register')}
                                    disabled={isSubmitting || isRestoreBlocked}
                                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                                        mode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    {t('tabs.register')}
                                </button>
                            </div>

                            <form className="mt-5 space-y-4" onSubmit={handlePasswordSubmit} onKeyDown={handleFormKeyDown}>
                                <div className="block">
                                    <label
                                        htmlFor={emailInputId}
                                        className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
                                    >
                                        {t('labels.email')}
                                    </label>
                                    <input
                                        id={emailInputId}
                                        name="email"
                                        type="email"
                                        autoComplete="email"
                                        inputMode="email"
                                        autoCapitalize="none"
                                        autoCorrect="off"
                                        spellCheck={false}
                                        value={email}
                                        onChange={(event) => setEmail(event.target.value)}
                                        disabled={isSubmitting || isRestoreBlocked}
                                        required
                                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-accent-500"
                                    />
                                </div>
                                <div className="block">
                                    <label
                                        htmlFor={secondaryInputId}
                                        className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
                                    >
                                        {t('labels.password')}
                                    </label>
                                    <input
                                        id={secondaryInputId}
                                        name="password"
                                        type="password"
                                        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                                        value={password}
                                        onChange={(event) => setPassword(event.target.value)}
                                        disabled={isSubmitting || isRestoreBlocked}
                                        required
                                        minLength={8}
                                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-accent-500"
                                    />
                                </div>
                                {mode === 'login' && (
                                    <div className="space-y-2">
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                                            <button
                                                type="button"
                                                onClick={() => void handlePasswordResetRequest('forgot_password')}
                                                disabled={isSubmitting || isRestoreBlocked || !isOnline}
                                                className="font-semibold text-accent-700 hover:text-accent-800 disabled:cursor-not-allowed disabled:opacity-60"
                                                {...getAnalyticsDebugAttributes('auth__password_reset--request', { source: 'modal', intent: 'forgot_password' })}
                                            >
                                                {t('actions.forgotPassword')}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => void handlePasswordResetRequest('set_password')}
                                                disabled={isSubmitting || isRestoreBlocked || !isOnline}
                                                className="font-semibold text-accent-700 hover:text-accent-800 disabled:cursor-not-allowed disabled:opacity-60"
                                                {...getAnalyticsDebugAttributes('auth__password_reset--request', { source: 'modal', intent: 'set_password' })}
                                            >
                                                {t('actions.setPasswordSocial')}
                                            </button>
                                        </div>
                                        <p className="text-xs text-slate-500">{t('copy.passwordResetHint')}</p>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={isSubmitting || isRestoreBlocked || !isOnline}
                                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
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
                                            disabled={isSubmitting || isRestoreBlocked || !isOnline}
                                            className={`relative inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                                isLastUsed
                                                    ? 'border-slate-400 bg-white'
                                                    : 'border-slate-300 bg-white'
                                            } ${item.buttonClassName}`}
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
                        </>
                    )}

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
                </div>
            </div>
        </div>
    );
};
