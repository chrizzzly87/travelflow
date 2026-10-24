import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useSearchParams } from '@/app/navigation';
import { MarketingLayout } from '../components/marketing/MarketingLayout';
import { useAuth } from '../hooks/useAuth';
import { buildLocalizedMarketingPath } from '../config/routes';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import {
    processAnonymousAssetClaimAfterAuth,
    resolveAnonymousAssetClaimErrorCode,
    runOpportunisticAnonymousAssetClaimCleanup,
} from '../services/anonymousAssetClaimService';
import {
    isQueuedTripGenerationClaimedByAnotherUserError,
    processQueuedTripGenerationAfterAuth,
    QueuedTripGenerationError,
    runOpportunisticTripQueueCleanup,
} from '../services/tripGenerationQueueService';
import { registerTripGenerationCompletionWatch } from '../services/tripGenerationCompletionWatchService';
import type { OAuthProviderId } from '../services/authService';
import {
    buildPasswordResetRedirectUrl,
    clearRememberedAuthReturnPath,
    getRememberedAuthReturnPath,
    rememberAuthReturnPath,
    resolveAccountLoginNextPath,
    resolvePreferredNextPath,
} from '../services/authNavigationService';
import { buildTripClaimConflictPath } from '../services/tripClaimNavigation';
import {
    isRememberLoginEnabled,
    setRememberLoginEnabled,
} from '../services/authSessionPersistenceService';
import {
    clearPendingOAuthProvider,
    getLastUsedOAuthProvider,
    setPendingOAuthProvider,
    subscribeLastUsedOAuthProvider,
} from '../services/authUiPreferencesService';
import { acceptCurrentTerms, isSupabaseAuthNotConfiguredError } from '../services/authService';
import { normalizeAppLanguage } from '../utils';
import { getOAuthButtons, SocialLoginButton } from '../components/auth/SocialLoginButton';
import {
    AuthCredentialsForm,
    AuthStatusMessages,
    type AuthCredentialsFormAnalytics,
} from '../components/auth/AuthCredentialsForm';

type AuthMode = 'login' | 'register';

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
const LOGIN_PAGE_FORM_ANALYTICS: AuthCredentialsFormAnalytics = {
    passwordResetSource: 'page',
    termsConsentSource: 'login_page',
    tagSubmit: true,
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
    const [isPostAuthProcessing, setIsPostAuthProcessing] = useState(false);
    const hasPostAuthAttemptedRef = useRef(false);
    const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [infoMessage, setInfoMessage] = useState<string | null>(null);
    const [showAuthSupportMessage, setShowAuthSupportMessage] = useState(false);
    const [rememberLogin, setRememberLogin] = useState<boolean>(() => isRememberLoginEnabled());
    const lastUsedProvider = useSyncExternalStore(
        subscribeLastUsedOAuthProvider,
        getLastUsedOAuthProvider,
        () => null
    );

    const oauthButtons = useMemo(() => getOAuthButtons(i18n.language), [i18n.language]);
    const authLocale = useMemo(() => normalizeAppLanguage(i18n.language), [i18n.language]);
    const termsPath = useMemo(() => buildLocalizedMarketingPath('terms', authLocale), [authLocale]);
    const privacyPath = useMemo(() => buildLocalizedMarketingPath('privacy', authLocale), [authLocale]);
    const contactPath = useMemo(() => buildLocalizedMarketingPath('contact', authLocale), [authLocale]);

    const claimRequestId = (searchParams.get('claim') || '').trim() || null;
    const assetClaimId = (searchParams.get('asset_claim') || '').trim() || null;
    const stateFrom = (location.state as { from?: string } | null)?.from || '';
    const rememberedNextPath = useMemo(() => getRememberedAuthReturnPath(), []);
    const nextPath = resolvePreferredNextPath(
        searchParams.get('next'),
        stateFrom,
        rememberedNextPath ? resolveAccountLoginNextPath({ pathname: rememberedNextPath }) : null,
        '/profile'
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
        trackEvent('auth__page--view', { has_claim: Boolean(claimRequestId), has_asset_claim: Boolean(assetClaimId) });
        void runOpportunisticAnonymousAssetClaimCleanup();
        void runOpportunisticTripQueueCleanup();
    }, [assetClaimId, claimRequestId]);

    useEffect(() => {
        rememberAuthReturnPath(nextPath);
    }, [nextPath]);

    useEffect(() => {
        const callbackError = searchParams.get('error_description') || searchParams.get('error');
        if (callbackError) {
            clearPendingOAuthProvider();
            trackEvent('auth__callback--error', { has_claim: Boolean(claimRequestId), has_asset_claim: Boolean(assetClaimId) });
            setErrorMessage(decodeURIComponent(callbackError));
            return;
        }
        const hasCallbackCode = Boolean(searchParams.get('code'));
        if (hasCallbackCode || (typeof window !== 'undefined' && window.location.hash.includes('access_token='))) {
            trackEvent('auth__callback--received', { has_claim: Boolean(claimRequestId), has_asset_claim: Boolean(assetClaimId) });
        }
    }, [searchParams, assetClaimId, claimRequestId]);

    const processPostAuthClaims = useCallback(async () => {
        if (!assetClaimId && !claimRequestId) return;
        if (hasPostAuthAttemptedRef.current) return;

        hasPostAuthAttemptedRef.current = true;
        setIsPostAuthProcessing(true);
        setErrorMessage(null);
        setInfoMessage(t('states.queuedProcessing'));

        try {
            if (assetClaimId) {
                try {
                    const claimResult = await processAnonymousAssetClaimAfterAuth(assetClaimId);
                    trackEvent('auth__asset_claim--fulfilled', {
                        claim_id: assetClaimId,
                        status: claimResult?.status ?? 'claimed',
                        transferred_trips: claimResult?.transferredTrips ?? 0,
                    });
                } catch (error) {
                    trackEvent('auth__asset_claim--failed', {
                        claim_id: assetClaimId,
                        error_code: resolveAnonymousAssetClaimErrorCode(error),
                    });
                }
            }

            if (claimRequestId) {
                const result = await processQueuedTripGenerationAfterAuth(claimRequestId);
                registerTripGenerationCompletionWatch(result.tripId, 'auth_queue_claim_login');
                trackEvent('auth__queue--fulfilled', { request_id: claimRequestId });
                setInfoMessage(t('states.queuedSuccess'));
                clearRememberedAuthReturnPath();
                navigate(`/trip/${result.tripId}`, { replace: true });
                return;
            }

            setInfoMessage(null);
            clearRememberedAuthReturnPath();
            navigate(nextPath, { replace: true });
        } catch (error) {
            if (isQueuedTripGenerationClaimedByAnotherUserError(error)) {
                clearRememberedAuthReturnPath();
                navigate(buildTripClaimConflictPath(nextPath), { replace: true });
                return;
            }

            const failedTripId = error instanceof QueuedTripGenerationError ? error.tripId : null;
            trackEvent('auth__queue--failed', {
                request_id: claimRequestId,
                has_trip_id: Boolean(failedTripId),
            });
            if (failedTripId) {
                clearRememberedAuthReturnPath();
                navigate(`/trip/${failedTripId}`, { replace: true });
                return;
            }
            setErrorMessage(t('errors.queue_claim_failed'));
        } finally {
            setIsPostAuthProcessing(false);
        }
    }, [assetClaimId, claimRequestId, navigate, nextPath, t]);

    useEffect(() => {
        if (isLoading) return;
        if (!isAuthenticated || isAnonymous) return;
        if (assetClaimId || claimRequestId) {
            void processPostAuthClaims();
            return;
        }
        clearRememberedAuthReturnPath();
        navigate(nextPath, { replace: true });
    }, [
        assetClaimId,
        claimRequestId,
        isAnonymous,
        isAuthenticated,
        isLoading,
        navigate,
        nextPath,
        processPostAuthClaims,
    ]);

    const handleModeChange = (nextMode: AuthMode) => {
        setMode(nextMode);
        setErrorMessage(null);
        setInfoMessage(null);
        setShowAuthSupportMessage(false);
        if (nextMode === 'login') {
            setHasAcceptedTerms(false);
        }
        trackEvent('auth__method--select', { method: nextMode });
    };

    const handlePasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (isSubmitting || isPostAuthProcessing) return;
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

        setIsSubmitting(true);
        setErrorMessage(null);
        setInfoMessage(null);
        setShowAuthSupportMessage(false);

        try {
            if (mode === 'login') {
                const response = await loginWithPassword(submittedEmail, submittedPassword);
                if (response.error) {
                    const errorCode = normalizeErrorCode(response.error);
                    setErrorMessage(t(`errors.${errorCode}`, t('errors.default')));
                } else {
                    setInfoMessage(null);
                }
                return;
            }

            const response = await registerWithPassword(
                submittedEmail,
                submittedPassword,
                { emailRedirectTo: oauthRedirectTo }
            );
            if (response.error) {
                const errorCode = normalizeErrorCode(response.error);
                setErrorMessage(t(`errors.${errorCode}`, t('errors.default')));
            } else {
                if (!('session' in response.data) || !response.data.session) {
                    setInfoMessage(t('states.emailConfirmationSent'));
                } else {
                    const acceptance = await acceptCurrentTerms({
                        locale: authLocale,
                        source: 'signup_login_page',
                    });
                    if (acceptance.error) {
                        setInfoMessage(t('states.termsAcceptancePending'));
                    } else {
                        setInfoMessage(null);
                    }
                }
            }
        } catch (error) {
            if (isSupabaseAuthNotConfiguredError(error)) {
                setShowAuthSupportMessage(true);
                setErrorMessage(null);
                setInfoMessage(null);
            } else {
                setErrorMessage(t('errors.default'));
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleOAuthLogin = async (provider: OAuthProviderId) => {
        setErrorMessage(null);
        setInfoMessage(null);
        setShowAuthSupportMessage(false);
        setRememberLoginEnabled(rememberLogin);
        setPendingOAuthProvider(provider);
        trackEvent('auth__method--select', { method: provider });
        try {
            const response = await loginWithOAuth(provider, oauthRedirectTo);
            if (response.error) {
                clearPendingOAuthProvider();
                const errorCode = normalizeErrorCode(response.error);
                setErrorMessage(t(`errors.${errorCode}`, t('errors.default')));
                return;
            }
            setInfoMessage(t('actions.submitting'));
        } catch (error) {
            clearPendingOAuthProvider();
            if (isSupabaseAuthNotConfiguredError(error)) {
                setShowAuthSupportMessage(true);
                setErrorMessage(null);
                setInfoMessage(null);
            } else {
                setErrorMessage(t('errors.default'));
            }
        }
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
        setShowAuthSupportMessage(false);
        trackEvent('auth__password_reset--request', { source: 'page', intent });
        try {
            const response = await sendPasswordResetEmail(normalizedEmail, {
                redirectTo: passwordResetRedirectTo,
                intent,
            });

            if (response.error) {
                setErrorMessage(t('errors.password_reset_failed'));
                trackEvent('auth__password_reset--failed', { source: 'page', intent });
            } else {
                setInfoMessage(t(intent === 'set_password' ? 'states.setPasswordSent' : 'states.passwordResetSent'));
                trackEvent('auth__password_reset--requested', { source: 'page', intent });
            }
        } catch (error) {
            if (isSupabaseAuthNotConfiguredError(error)) {
                setShowAuthSupportMessage(true);
                setErrorMessage(null);
                setInfoMessage(null);
            } else {
                setErrorMessage(t('errors.password_reset_failed'));
            }
        }
        setIsSubmitting(false);
    };

    const handleRememberLoginToggle = (checked: boolean) => {
        setRememberLogin(checked);
        setRememberLoginEnabled(checked);
        trackEvent('auth__remember_login--toggle', { remember_login: checked });
    };

    return (
        <MarketingLayout>
            <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_360px]">
                <section className="rounded-3xl border border-border bg-card p-6 shadow-sm md:p-8 dark:shadow-none">
                    <p className="text-xs font-semibold uppercase tracking-wide text-accent-600 dark:text-accent-300">{t('hero.eyebrow')}</p>
                    <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">{t('hero.title')}</h1>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{t('hero.description')}</p>
                    {claimRequestId && (
                        <div className="mt-4 rounded-2xl border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-900 dark:bg-accent-400/12 dark:text-accent-200 dark:border-accent-400/30">
                            {t('copy.queueHint')}
                        </div>
                    )}

                    <div className="mt-6 inline-flex rounded-xl border border-border bg-secondary p-1">
                        <button
                            type="button"
                            onClick={() => handleModeChange('login')}
                            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                                mode === 'login' ? 'bg-card text-foreground shadow-sm dark:shadow-none' : 'text-muted-foreground hover:text-foreground'
                            }`}
                            {...getAnalyticsDebugAttributes('auth__tab--login')}
                        >
                            {t('tabs.login')}
                        </button>
                        <button
                            type="button"
                            onClick={() => handleModeChange('register')}
                            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                                mode === 'register' ? 'bg-card text-foreground shadow-sm dark:shadow-none' : 'text-muted-foreground hover:text-foreground'
                            }`}
                            {...getAnalyticsDebugAttributes('auth__tab--register')}
                        >
                            {t('tabs.register')}
                        </button>
                    </div>

                    <AuthCredentialsForm
                        className="mt-6"
                        mode={mode}
                        idPrefix="login-page"
                        email={email}
                        onEmailChange={setEmail}
                        password={password}
                        onPasswordChange={setPassword}
                        rememberLogin={rememberLogin}
                        onRememberLoginChange={handleRememberLoginToggle}
                        hasAcceptedTerms={hasAcceptedTerms}
                        onAcceptedTermsChange={setHasAcceptedTerms}
                        onSubmit={handlePasswordSubmit}
                        onPasswordResetRequest={(intent) => void handlePasswordResetRequest(intent)}
                        termsPath={termsPath}
                        privacyPath={privacyPath}
                        isSubmitting={isSubmitting}
                        isPending={isSubmitting || isPostAuthProcessing}
                        rememberLoginDisabled={isSubmitting || isPostAuthProcessing}
                        passwordResetDisabled={isSubmitting || isPostAuthProcessing}
                        analytics={LOGIN_PAGE_FORM_ANALYTICS}
                    />

                    <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
                        <span className="h-px flex-1 bg-slate-200 dark:bg-secondary" />
                        {t('copy.oauthDivider')}
                        <span className="h-px flex-1 bg-slate-200 dark:bg-secondary" />
                    </div>

                    <div className="space-y-2">
                        {oauthButtons.map((item) => {
                            const isLastUsed = lastUsedProvider === item.provider;
                            return (
                                <SocialLoginButton
                                    key={item.provider}
                                    provider={item.provider}
                                    label={t(item.labelKey)}
                                    lastUsedLabel={t('copy.lastUsedTag')}
                                    isLastUsed={isLastUsed}
                                    disabled={isSubmitting || isPostAuthProcessing}
                                    onClick={() => void handleOAuthLogin(item.provider)}
                                />
                            );
                        })}
                    </div>

                    <div className="mt-5 text-sm text-muted-foreground">
                        {mode === 'login' ? (
                            <button
                                type="button"
                                onClick={() => handleModeChange('register')}
                                className="font-semibold text-accent-700 hover:text-accent-800 dark:text-accent-200 dark:hover:text-accent-200"
                            >
                                {t('copy.switchToRegister')}
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => handleModeChange('login')}
                                className="font-semibold text-accent-700 hover:text-accent-800 dark:text-accent-200 dark:hover:text-accent-200"
                            >
                                {t('copy.switchToLogin')}
                            </button>
                        )}
                    </div>

                    <AuthStatusMessages
                        errorMessage={errorMessage}
                        infoMessage={infoMessage}
                        showAuthSupportMessage={showAuthSupportMessage}
                        contactPath={contactPath}
                        contactSource="page"
                    />
                </section>

                <aside className="rounded-3xl border border-border bg-card p-6 shadow-sm md:p-8 dark:shadow-none">
                    <h2 className="text-base font-semibold text-foreground">{t('benefits.title')}</h2>
                    <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                        {(t('benefits.items', { returnObjects: true }) as string[]).map((item) => (
                            <li key={item} className="rounded-xl border border-border bg-secondary px-3 py-2">
                                {item}
                            </li>
                        ))}
                    </ul>
                </aside>
            </div>
        </MarketingLayout>
    );
};
