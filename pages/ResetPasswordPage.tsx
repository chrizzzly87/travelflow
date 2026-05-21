import React, { useEffect, useMemo, useReducer } from 'react';
import { ArrowRight, SpinnerGap as Loader2 } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { MarketingLayout } from '../components/marketing/MarketingLayout';
import { useAuth } from '../hooks/useAuth';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import {
    getRememberedAuthReturnPath,
    rememberAuthReturnPath,
    resolvePreferredNextPath,
} from '../services/authNavigationService';

const MIN_PASSWORD_LENGTH = 8;

interface ResetPasswordFormState {
    password: string;
    confirmPassword: string;
    isSubmitting: boolean;
    errorMessage: string | null;
    infoMessage: string | null;
}

type ResetPasswordFormAction =
    | { type: 'patch'; state: Partial<ResetPasswordFormState> };

const INITIAL_RESET_PASSWORD_FORM_STATE: ResetPasswordFormState = {
    password: '',
    confirmPassword: '',
    isSubmitting: false,
    errorMessage: null,
    infoMessage: null,
};

const resetPasswordFormReducer = (
    state: ResetPasswordFormState,
    action: ResetPasswordFormAction
): ResetPasswordFormState => {
    switch (action.type) {
        case 'patch':
            return { ...state, ...action.state };
        default:
            return state;
    }
};

const readHashParams = (hash: string): URLSearchParams => {
    if (!hash) return new URLSearchParams();
    const trimmed = hash.startsWith('#') ? hash.slice(1) : hash;
    return new URLSearchParams(trimmed);
};

export const ResetPasswordPage: React.FC = () => {
    const { t } = useTranslation('auth');
    const navigate = useNavigate();
    const routeLocation = useLocation();
    const [searchParams] = useSearchParams();
    const { isLoading, isAuthenticated, isAnonymous, updatePassword } = useAuth();

    const [formState, dispatchFormState] = useReducer(
        resetPasswordFormReducer,
        INITIAL_RESET_PASSWORD_FORM_STATE
    );
    const { password, confirmPassword, isSubmitting, errorMessage, infoMessage } = formState;

    const hashParams = useMemo(() => readHashParams(routeLocation.hash), [routeLocation.hash]);
    const callbackError = (searchParams.get('error_description') || searchParams.get('error') || hashParams.get('error_description') || hashParams.get('error') || '').trim();

    const rememberedNextPath = useMemo(() => getRememberedAuthReturnPath(), []);
    const nextPath = resolvePreferredNextPath(searchParams.get('next'), rememberedNextPath, '/create-trip');

    const hasRecoveryContext = useMemo(() => {
        if (searchParams.get('code')) return true;
        const hashType = (hashParams.get('type') || '').toLowerCase();
        if (hashType === 'recovery') return true;
        return Boolean(hashParams.get('access_token'));
    }, [hashParams, searchParams]);

    useEffect(() => {
        trackEvent('auth__password_reset_page--view', {
            has_error: Boolean(callbackError),
            has_recovery_context: hasRecoveryContext,
        });
        rememberAuthReturnPath(nextPath);
    }, [callbackError, hasRecoveryContext, nextPath]);

    useEffect(() => {
        if (!callbackError) return;
        dispatchFormState({ type: 'patch', state: { errorMessage: t('errors.recovery_link_invalid') } });
    }, [callbackError, t]);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!password || password.length < MIN_PASSWORD_LENGTH) {
            dispatchFormState({
                type: 'patch',
                state: { errorMessage: t('errors.password_too_short'), infoMessage: null },
            });
            return;
        }
        if (password !== confirmPassword) {
            dispatchFormState({
                type: 'patch',
                state: { errorMessage: t('errors.password_mismatch'), infoMessage: null },
            });
            return;
        }
        if (!isAuthenticated || isAnonymous) {
            dispatchFormState({
                type: 'patch',
                state: { errorMessage: t('errors.recovery_session_missing'), infoMessage: null },
            });
            trackEvent('auth__password_update--blocked', {
                reason: 'missing_recovery_session',
            });
            return;
        }

        dispatchFormState({
            type: 'patch',
            state: { isSubmitting: true, errorMessage: null, infoMessage: null },
        });
        trackEvent('auth__password_update--submit');

        const response = await updatePassword(password);

        if (response.error) {
            dispatchFormState({
                type: 'patch',
                state: { errorMessage: t('errors.password_update_failed'), isSubmitting: false },
            });
            trackEvent('auth__password_update--failed');
            return;
        }

        dispatchFormState({
            type: 'patch',
            state: { infoMessage: t('states.passwordUpdated'), isSubmitting: false },
        });
        trackEvent('auth__password_update--success');

        window.setTimeout(() => {
            navigate(nextPath, { replace: true });
        }, 900);
    };

    return (
        <MarketingLayout>
            <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-[1fr_320px]">
                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
                    <p className="text-xs font-semibold uppercase tracking-wide text-accent-600">{t('reset.eyebrow')}</p>
                    <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">{t('reset.title')}</h1>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{t('reset.description')}</p>

                    {!isLoading && (!isAuthenticated || isAnonymous) && (
                        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                            {t('copy.resetLinkHint')}
                        </div>
                    )}

                    <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                        <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('labels.newPassword')}</span>
                            <input
                                type="password"
                                autoComplete="new-password"
                                value={password}
                                onChange={(event) => dispatchFormState({
                                    type: 'patch',
                                    state: { password: event.target.value },
                                })}
                                required
                                minLength={MIN_PASSWORD_LENGTH}
                                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-accent-500"
                            />
                        </label>

                        <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('labels.confirmPassword')}</span>
                            <input
                                type="password"
                                autoComplete="new-password"
                                value={confirmPassword}
                                onChange={(event) => dispatchFormState({
                                    type: 'patch',
                                    state: { confirmPassword: event.target.value },
                                })}
                                required
                                minLength={MIN_PASSWORD_LENGTH}
                                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-accent-500"
                            />
                        </label>

                        <button
                            type="submit"
                            disabled={isSubmitting || isLoading}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
                            {...getAnalyticsDebugAttributes('auth__password_update--submit')}
                        >
                            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                            {isSubmitting ? t('actions.submitting') : t('actions.saveNewPassword')}
                        </button>
                    </form>

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

                    <div className="mt-6">
                        <button
                            type="button"
                            onClick={() => navigate('/login')}
                            className="text-sm font-semibold text-accent-700 hover:text-accent-800"
                            {...getAnalyticsDebugAttributes('auth__password_reset--back_login')}
                        >
                            {t('actions.backToLogin')}
                        </button>
                    </div>
                </section>

                <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
                    <h2 className="text-base font-semibold text-slate-900">{t('benefits.title')}</h2>
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
