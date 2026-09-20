import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
    ArrowRight,
    SpinnerGap as Loader2,
    X,
} from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Checkbox } from '../ui/checkbox';
import { useAuth } from '../../hooks/useAuth';
import { buildLocalizedMarketingPath } from '../../config/routes';
import type { OAuthProviderId } from '../../services/authService';
import { acceptCurrentTerms, isSupabaseAuthNotConfiguredError } from '../../services/authService';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { buildPasswordResetRedirectUrl } from '../../services/authNavigationService';
import {
    isRememberLoginEnabled,
    setRememberLoginEnabled,
} from '../../services/authSessionPersistenceService';
import {
    clearPendingOAuthProvider,
    getLastUsedOAuthProvider,
    setPendingOAuthProvider,
    subscribeLastUsedOAuthProvider,
} from '../../services/authUiPreferencesService';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { getAuthRequestTimeoutMs, getAuthRestoreTimeoutMs } from '../../services/networkStatus';
import { normalizeAppLanguage } from '../../utils';
import { SocialProviderIcon } from './SocialProviderIcon';
import { SegmentedControl } from '../ui/segmented-control';

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
        buttonClassName: 'hover:border-[#ea4335]/40 hover:bg-[#fff7f7] dark:hover:bg-[#ea4335]/12 dark:hover:border-[#ea4335]/50',
    },
    {
        provider: 'facebook',
        labelKey: 'actions.oauthFacebook',
        buttonClassName: 'hover:border-[#1877f2]/40 hover:bg-[#f3f8ff] dark:hover:bg-[#1877f2]/14 dark:hover:border-[#1877f2]/50',
    },
];

const KAKAO_OAUTH_BUTTON: OAuthButtonConfig = {
    provider: 'kakao',
    labelKey: 'actions.oauthKakao',
    buttonClassName: 'hover:border-[#FFE812]/60 hover:bg-[#fffde6] dark:hover:bg-[#FFE812]/12 dark:hover:border-[#FFE812]/50',
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

type SessionRestoreState = 'idle' | 'restoring' | 'restored';

interface AuthFeedbackState {
    isSubmitting: boolean;
    hasAcceptedTerms: boolean;
    errorMessage: string | null;
    infoMessage: string | null;
    showAuthSupportMessage: boolean;
    sessionRestoreState: SessionRestoreState;
}

const DEFAULT_AUTH_FEEDBACK_STATE: AuthFeedbackState = {
    isSubmitting: false,
    hasAcceptedTerms: false,
    errorMessage: null,
    infoMessage: null,
    showAuthSupportMessage: false,
    sessionRestoreState: 'idle',
};

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
    const [authFeedback, setAuthFeedback] = useState<AuthFeedbackState>(DEFAULT_AUTH_FEEDBACK_STATE);
    const {
        isSubmitting,
        hasAcceptedTerms,
        errorMessage,
        infoMessage,
        showAuthSupportMessage,
        sessionRestoreState,
    } = authFeedback;
    const [rememberLogin, setRememberLogin] = useState<boolean>(() => isRememberLoginEnabled());
    const lastUsedProvider = useSyncExternalStore(
        subscribeLastUsedOAuthProvider,
        getLastUsedOAuthProvider,
        () => null
    );
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
    const authLocale = useMemo(() => normalizeAppLanguage(i18n.language), [i18n.language]);
    const termsPath = useMemo(() => buildLocalizedMarketingPath('terms', authLocale), [authLocale]);
    const privacyPath = useMemo(() => buildLocalizedMarketingPath('privacy', authLocale), [authLocale]);
    const contactPath = useMemo(() => buildLocalizedMarketingPath('contact', authLocale), [authLocale]);
    const emailInputId = 'auth-modal-email';
    const secondaryInputId = 'auth-modal-secondary';
    const rememberLoginInputId = 'auth-modal-remember-login';
    const fieldClassName = 'mt-1 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-accent-500 [&:user-invalid]:border-rose-400 [&:user-invalid]:bg-rose-50 [&:user-invalid]:text-rose-900 [&:user-invalid]:focus:ring-rose-200 dark:border-border dark:bg-card dark:text-foreground';

    const updateAuthFeedback = useCallback((patch: Partial<AuthFeedbackState>) => {
        setAuthFeedback((current) => ({ ...current, ...patch }));
    }, []);

    const setIsSubmitting = useCallback((isSubmitting: boolean) => {
        updateAuthFeedback({ isSubmitting });
    }, [updateAuthFeedback]);

    const setHasAcceptedTerms = useCallback((hasAcceptedTerms: boolean) => {
        updateAuthFeedback({ hasAcceptedTerms });
    }, [updateAuthFeedback]);

    const setErrorMessage = useCallback((errorMessage: string | null) => {
        updateAuthFeedback({ errorMessage });
    }, [updateAuthFeedback]);

    const setInfoMessage = useCallback((infoMessage: string | null) => {
        updateAuthFeedback({ infoMessage });
    }, [updateAuthFeedback]);

    const setShowAuthSupportMessage = useCallback((showAuthSupportMessage: boolean) => {
        updateAuthFeedback({ showAuthSupportMessage });
    }, [updateAuthFeedback]);

    const setSessionRestoreState = useCallback((sessionRestoreState: SessionRestoreState) => {
        updateAuthFeedback({ sessionRestoreState });
    }, [updateAuthFeedback]);

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
            setAuthFeedback(DEFAULT_AUTH_FEEDBACK_STATE);
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
        if (!isOpen || hasInteractiveAttemptRef.current) return;
        const nextSessionRestoreState: SessionRestoreState = isLoading
            ? 'restoring'
            : isAuthenticated && !isAnonymous
                ? 'restored'
                : 'idle';
        setSessionRestoreState(nextSessionRestoreState);
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
            updateAuthFeedback({
                sessionRestoreState: 'idle',
                errorMessage: t(
                    isOnline
                        ? (isSlowConnection ? 'errors.restore_timeout_slow_network' : 'errors.restore_timeout')
                        : 'errors.offline'
                ),
                infoMessage: null,
            });
            trackEvent('auth__modal--restore_timeout', {
                source,
                is_online: isOnline,
                is_slow_network: isSlowConnection,
            });
        }, getAuthRestoreTimeoutMs(isSlowConnection));
        return () => window.clearTimeout(timer);
    }, [isOnline, isOpen, isSlowConnection, sessionRestoreState, source, t, updateAuthFeedback]);

    if (!isOpen) return null;
    const isRestoreBlocked = sessionRestoreState === 'restoring' || sessionRestoreState === 'restored';

    const handleModeChange = (nextMode: AuthMode) => {
        if (isRestoreBlocked) return;
        setMode(nextMode);
        updateAuthFeedback({
            errorMessage: null,
            infoMessage: null,
            showAuthSupportMessage: false,
        });
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
        const formData = new FormData(event.currentTarget);
        const submittedEmail = (formData.get('email')?.toString() || email).trim();
        const submittedPassword = formData.get('password')?.toString() || password;

        if (!submittedEmail || !submittedPassword.trim()) {
            setErrorMessage(t('errors.default'));
            return;
        }
        if (mode === 'register' && !hasAcceptedTerms) {
            setErrorMessage(t('errors.terms_required'));
            return;
        }
        if (submittedEmail !== email) setEmail(submittedEmail);
        if (submittedPassword !== password) setPassword(submittedPassword);
        setRememberLoginEnabled(rememberLogin);
        clearPendingOAuthProvider();

        const requestId = pendingRequestRef.current + 1;
        pendingRequestRef.current = requestId;
        hasInteractiveAttemptRef.current = true;
        setSessionRestoreState('idle');
        setIsSubmitting(true);
        setErrorMessage(null);
        setInfoMessage(isSlowConnection ? t('states.slowNetworkDetected') : null);
        setShowAuthSupportMessage(false);
        const timeoutMs = getAuthRequestTimeoutMs(isSlowConnection);

        try {
            if (mode === 'login') {
                const outcome = await runTimedRequest(
                    () => loginWithPassword(submittedEmail, submittedPassword),
                    timeoutMs
                );
                if (pendingRequestRef.current !== requestId) return;
                if (outcome.status === 'timeout') {
                    setErrorMessage(t(isSlowConnection ? 'errors.request_timeout_slow_network' : 'errors.request_timeout'));
                    setInfoMessage(null);
                    return;
                }
                if (outcome.status === 'error') {
                    if (isSupabaseAuthNotConfiguredError(outcome.error)) {
                        setShowAuthSupportMessage(true);
                        setErrorMessage(null);
                    } else {
                        setErrorMessage(t('errors.default'));
                    }
                    setInfoMessage(null);
                    return;
                }
                if (outcome.value.error) {
                    const errorCode = normalizeErrorCode(outcome.value.error);
                    setErrorMessage(t(`errors.${errorCode}`, t('errors.default')));
                } else {
                    setInfoMessage(null);
                }
            } else {
                const outcome = await runTimedRequest(
                    () => registerWithPassword(submittedEmail, submittedPassword, { emailRedirectTo: oauthRedirectTo }),
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
                    const acceptance = await acceptCurrentTerms({
                        locale: authLocale,
                        source: 'signup_auth_modal',
                    });
                    if (acceptance.error) {
                        setInfoMessage(t('states.termsAcceptancePending'));
                    } else {
                        setInfoMessage(null);
                    }
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
        setShowAuthSupportMessage(false);
        setRememberLoginEnabled(rememberLogin);
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
            if (isSupabaseAuthNotConfiguredError(outcome.error)) {
                setShowAuthSupportMessage(true);
                setErrorMessage(null);
            } else {
                setErrorMessage(t('errors.default'));
            }
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
        setShowAuthSupportMessage(false);
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
            if (isSupabaseAuthNotConfiguredError(outcome.error)) {
                setShowAuthSupportMessage(true);
                setErrorMessage(null);
            } else {
                setErrorMessage(t('errors.password_reset_failed'));
            }
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

    const handleRememberLoginToggle = (checked: boolean) => {
        setRememberLogin(checked);
        setRememberLoginEnabled(checked);
        trackEvent('auth__remember_login--toggle', { source: 'modal', remember_login: checked });
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
                className="relative z-10 flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col rounded-2xl border border-border bg-card shadow-2xl sm:max-h-[calc(100dvh-3rem)] dark:border-border dark:bg-card"
                role="dialog"
                aria-modal="true"
                aria-label="Authentication modal"
            >
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-3 sm:py-4 dark:border-border">
                    <div className="min-w-0">
                        <p className="hidden text-xs font-semibold uppercase tracking-wide text-accent-600 sm:block dark:text-accent-300">{t('hero.eyebrow')}</p>
                        <h2 className="text-base font-semibold text-foreground sm:mt-1 sm:text-lg dark:text-foreground">{t('hero.title')}</h2>
                        <p className="mt-1 hidden text-sm text-muted-foreground sm:block dark:text-muted-foreground">{t('hero.description')}</p>
                    </div>
                    <button
                        ref={closeButtonRef}
                        type="button"
                        className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary hover:text-foreground dark:border-border dark:text-muted-foreground dark:hover:bg-secondary dark:hover:text-foreground dark:text-foreground"
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

                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                    {!isOnline && (
                        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-400/12 dark:text-amber-200 dark:border-amber-400/30" aria-live="polite">
                            <p className="font-semibold">{t('states.offlineNoticeTitle')}</p>
                            <p className="mt-1">{t('states.offlineNoticeBody')}</p>
                        </div>
                    )}
                    {sessionRestoreState === 'restoring' && (
                        <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:bg-sky-400/12 dark:text-sky-200 dark:border-sky-400/30" aria-live="polite">
                            <span className="inline-flex items-center gap-2 font-semibold">
                                <Loader2 size={14} className="animate-spin" />
                                {t('states.restoringSession')}
                            </span>
                        </div>
                    )}
                    {sessionRestoreState === 'restored' && (
                        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:bg-emerald-400/12 dark:text-emerald-200 dark:border-emerald-400/30" aria-live="polite">
                            <p className="font-semibold">{t('states.sessionRestored')}</p>
                        </div>
                    )}

                    {sessionRestoreState !== 'restored' && (
                        <>
                            <SegmentedControl
                                name="tf-auth-mode"
                                label={t('tabs.login')}
                                size="md"
                                value={mode === 'register' ? 'register' : 'login'}
                                disabled={isSubmitting || isRestoreBlocked}
                                onChange={(next) => handleModeChange(next as 'login' | 'register')}
                                options={[
                                    { value: 'login', label: t('tabs.login') },
                                    { value: 'register', label: t('tabs.register') },
                                ]}
                            />

                            <form className="mt-5 space-y-4" onSubmit={handlePasswordSubmit} onKeyDown={handleFormKeyDown}>
                                <div className="block">
                                    <label
                                        htmlFor={emailInputId}
                                        className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:text-muted-foreground"
                                    >
                                        {t('labels.email')}
                                    </label>
                                    <input
                                        id={emailInputId}
	                                        name="email"
	                                        type="email"
	                                        aria-label={t('labels.email')}
	                                        autoComplete={mode === 'login' ? 'username' : 'email'}
                                        inputMode="email"
                                        autoCapitalize="none"
                                        autoCorrect="off"
                                        spellCheck={false}
                                        value={email}
                                        onChange={(event) => setEmail(event.target.value)}
                                        disabled={isSubmitting || isRestoreBlocked}
                                        required
                                        className={fieldClassName}
                                    />
                                </div>
                                <div className="block">
                                    <label
                                        htmlFor={secondaryInputId}
                                        className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:text-muted-foreground"
                                    >
                                        {t('labels.password')}
                                    </label>
                                    <input
                                        id={secondaryInputId}
	                                        name="password"
	                                        type="password"
	                                        aria-label={t('labels.password')}
	                                        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                                        value={password}
                                        onChange={(event) => setPassword(event.target.value)}
                                        disabled={isSubmitting || isRestoreBlocked}
                                        required
                                        minLength={8}
                                        className={fieldClassName}
                                    />
                                </div>
                                {mode === 'login' && (
                                    <div className="space-y-2">
                                        <label
                                            htmlFor={rememberLoginInputId}
                                            className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-foreground dark:text-foreground"
                                        >
                                            <Checkbox
                                                id={rememberLoginInputId}
                                                checked={rememberLogin}
                                                onCheckedChange={(checked) => handleRememberLoginToggle(checked === true)}
                                                disabled={isSubmitting || isRestoreBlocked}
                                                aria-label={t('labels.rememberLogin')}
                                                {...getAnalyticsDebugAttributes('auth__remember_login--toggle', { source: 'modal' })}
                                            />
                                            <span>{t('labels.rememberLogin')}</span>
                                        </label>
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                                            <button
                                                type="button"
                                                onClick={() => void handlePasswordResetRequest('forgot_password')}
                                                disabled={isSubmitting || isRestoreBlocked || !isOnline}
                                                className="font-semibold text-accent-700 hover:text-accent-800 disabled:cursor-not-allowed disabled:opacity-60 dark:text-accent-200 dark:hover:text-accent-200 dark:hover:text-accent-300"
                                                {...getAnalyticsDebugAttributes('auth__password_reset--request', { source: 'modal', intent: 'forgot_password' })}
                                            >
                                                {t('actions.forgotPassword')}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => void handlePasswordResetRequest('set_password')}
                                                disabled={isSubmitting || isRestoreBlocked || !isOnline}
                                                className="font-semibold text-accent-700 hover:text-accent-800 disabled:cursor-not-allowed disabled:opacity-60 dark:text-accent-200 dark:hover:text-accent-200 dark:hover:text-accent-300"
                                                {...getAnalyticsDebugAttributes('auth__password_reset--request', { source: 'modal', intent: 'set_password' })}
                                            >
                                                {t('actions.setPasswordSocial')}
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {mode === 'register' && (
                                    <label className="flex items-start gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-xs text-foreground dark:border-border dark:bg-secondary dark:text-foreground">
                                        <input
                                            type="checkbox"
                                            checked={hasAcceptedTerms}
                                            onChange={(event) => {
                                                setHasAcceptedTerms(event.target.checked);
                                                trackEvent(event.target.checked ? 'auth__terms_consent--accept' : 'auth__terms_consent--reject', { source: 'auth_modal' });
                                            }}
                                            className="mt-0.5 size-4 rounded border-border dark:border-border"
                                            {...getAnalyticsDebugAttributes('auth__terms_consent--accept', { source: 'auth_modal' })}
                                        />
                                        <span>
                                            {t('copy.termsConsentPrefix')}{' '}
                                            <Link className="font-semibold text-accent-700 hover:underline dark:text-accent-200" to={termsPath} target="_blank" rel="noreferrer">
                                                {t('copy.termsConsentTerms')}
                                            </Link>{' '}
                                            {t('copy.termsConsentJoiner')}{' '}
                                            <Link className="font-semibold text-accent-700 hover:underline dark:text-accent-200" to={privacyPath} target="_blank" rel="noreferrer">
                                                {t('copy.termsConsentPrivacy')}
                                            </Link>
                                            .
                                        </span>
                                    </label>
                                )}

                                <button
                                    type="submit"
                                    disabled={isSubmitting || isRestoreBlocked || !isOnline}
                                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-accent-400 dark:hover:bg-accent-500"
                                >
                                    {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                                    {isSubmitting ? t('actions.submitting') : mode === 'login' ? t('actions.submitLogin') : t('actions.submitRegister')}
                                </button>
                            </form>

                            <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground dark:text-muted-foreground">
                                <span className="h-px flex-1 bg-slate-200 dark:bg-secondary" />
                                {t('copy.oauthDivider')}
                                <span className="h-px flex-1 bg-slate-200 dark:bg-secondary" />
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
                                            className={`relative inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold text-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                                isLastUsed
                                                    ? 'border-slate-400 bg-card dark:border-border dark:bg-card'
                                                    : 'border-border bg-card dark:border-border dark:bg-card'
                                            } ${item.buttonClassName}`}
                                        >
                                            <SocialProviderIcon provider={item.provider} size={18} />
                                            <span>{t(item.labelKey)}</span>
                                            {isLastUsed && (
                                                <span className="pointer-events-none absolute -top-2 right-3 rounded-2xl border border-border bg-secondary px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground shadow-sm dark:border-border dark:bg-secondary dark:text-muted-foreground">
                                                    {t('copy.lastUsedTag')}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    )}

                    {showAuthSupportMessage ? (
                        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:bg-rose-400/12 dark:text-rose-200 dark:border-rose-400/30">
                            <p className="font-semibold">{t('errors.auth_unavailable_title')}</p>
                            <p className="mt-1">{t('errors.auth_unavailable_body')}</p>
                            <Link
                                to={contactPath}
                                target="_blank"
                                rel="noreferrer"
                                onClick={() => trackEvent('auth__config_error--contact', { source: 'modal' })}
                                className="mt-3 inline-flex font-semibold text-rose-900 underline underline-offset-4 dark:text-rose-200"
                                {...getAnalyticsDebugAttributes('auth__config_error--contact', { source: 'modal' })}
                            >
                                {t('actions.contactSupport')}
                            </Link>
                        </div>
                    ) : errorMessage ? (
                        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:bg-rose-400/12 dark:text-rose-200 dark:border-rose-400/30">
                            {errorMessage}
                        </div>
                    ) : null}
                    {infoMessage && (
                        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:bg-emerald-400/12 dark:text-emerald-200 dark:border-emerald-400/30">
                            {infoMessage}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
