import React from 'react';
import { ArrowRight } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { Link } from '@/app/navigation';
import { cn } from '@/lib/utils';
import { Button, type ButtonProps } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Input, type InputProps } from '../ui/input';
import { Label } from '../ui/label';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';

export type AuthCredentialsMode = 'login' | 'register';
export type PasswordResetIntent = 'forgot_password' | 'set_password';

// The auth surfaces predate the shared Input and use a taller, rounder field
// with no shadow. These overrides keep that look on top of `Input`; the
// disabled overrides keep the field opaque while a request is pending.
const AUTH_INPUT_CLASS_NAME = 'mt-1 h-auto rounded-xl py-2.5 shadow-none focus:ring-2 focus:ring-accent-500 disabled:cursor-default disabled:opacity-100';
const AUTH_INPUT_USER_INVALID_CLASS_NAME = '[&:user-invalid]:border-rose-400 [&:user-invalid]:bg-rose-50 [&:user-invalid]:text-rose-900 [&:user-invalid]:focus:ring-rose-200';
const AUTH_FIELD_LABEL_CLASS_NAME = 'block text-xs font-semibold uppercase tracking-wide text-muted-foreground select-auto';
const AUTH_TEXT_ACTION_CLASS_NAME = 'font-semibold text-accent-700 hover:text-accent-800 disabled:cursor-not-allowed disabled:opacity-60 dark:text-accent-200 dark:hover:text-accent-200';
const AUTH_MESSAGE_BASE_CLASS_NAME = 'mt-4 rounded-xl border px-4 py-3 text-sm';
const AUTH_ERROR_MESSAGE_CLASS_NAME = `${AUTH_MESSAGE_BASE_CLASS_NAME} border-rose-200 bg-rose-50 text-rose-900 dark:bg-rose-400/12 dark:text-rose-200 dark:border-rose-400/30`;
const AUTH_INFO_MESSAGE_CLASS_NAME = `${AUTH_MESSAGE_BASE_CLASS_NAME} border-emerald-200 bg-emerald-50 text-emerald-900 dark:bg-emerald-400/12 dark:text-emerald-200 dark:border-emerald-400/30`;

export interface AuthInputProps extends InputProps {
    /** Tint the field rose once the browser reports it `:user-invalid`. */
    highlightUserInvalid?: boolean;
}

/** `Input` with the auth pages' field styling. */
export const AuthInput = React.forwardRef<HTMLInputElement, AuthInputProps>(
    ({ className, highlightUserInvalid = true, ...props }, ref) => (
        <Input
            ref={ref}
            className={cn(AUTH_INPUT_CLASS_NAME, highlightUserInvalid && AUTH_INPUT_USER_INVALID_CLASS_NAME, className)}
            {...props}
        />
    ),
);
AuthInput.displayName = 'AuthInput';

export type AuthSubmitButtonProps = Omit<ButtonProps, 'type' | 'icon' | 'variant' | 'size' | 'asChild'>;

/**
 * The full-width accent submit of the auth forms. `loading` swaps the arrow for
 * the shared spinner, disables the button and sets `aria-busy`.
 */
export const AuthSubmitButton = React.forwardRef<HTMLButtonElement, AuthSubmitButtonProps>(
    ({ className, ...props }, ref) => (
        <Button
            ref={ref}
            type="submit"
            icon={<ArrowRight size={16} />}
            className={cn(
                'h-auto w-full whitespace-normal rounded-xl bg-accent-600 px-4 py-3 has-[>svg]:px-4 font-semibold text-white transition-colors hover:bg-accent-700 disabled:pointer-events-auto disabled:cursor-not-allowed disabled:opacity-60',
                className,
            )}
            {...props}
        />
    ),
);
AuthSubmitButton.displayName = 'AuthSubmitButton';

export interface AuthStatusMessagesProps {
    errorMessage: string | null;
    infoMessage: string | null;
    /** Replaces the error with the "sign-in is unavailable, contact support" panel. */
    showAuthSupportMessage?: boolean;
    contactPath?: string;
    /** Analytics `source` for the contact-support link. */
    contactSource?: string;
}

/** The error / support / info panels under an auth form. */
export const AuthStatusMessages: React.FC<AuthStatusMessagesProps> = ({
    errorMessage,
    infoMessage,
    showAuthSupportMessage = false,
    contactPath,
    contactSource,
}) => {
    const { t } = useTranslation('auth');
    return (
        <>
            {showAuthSupportMessage && contactPath ? (
                <div className={AUTH_ERROR_MESSAGE_CLASS_NAME}>
                    <p className="font-semibold">{t('errors.auth_unavailable_title')}</p>
                    <p className="mt-1">{t('errors.auth_unavailable_body')}</p>
                    <Link
                        to={contactPath}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => trackEvent('auth__config_error--contact', { source: contactSource })}
                        className="mt-3 inline-flex font-semibold text-rose-900 underline underline-offset-4 dark:text-rose-200"
                        {...getAnalyticsDebugAttributes('auth__config_error--contact', { source: contactSource })}
                    >
                        {t('actions.contactSupport')}
                    </Link>
                </div>
            ) : errorMessage ? (
                <div className={AUTH_ERROR_MESSAGE_CLASS_NAME}>
                    {errorMessage}
                </div>
            ) : null}
            {infoMessage && (
                <div className={AUTH_INFO_MESSAGE_CLASS_NAME}>
                    {infoMessage}
                </div>
            )}
        </>
    );
};

export interface AuthCredentialsFormAnalytics {
    /** Payload for the remember-login checkbox's debug attributes. */
    rememberLoginPayload?: Record<string, unknown>;
    /** `source` on the forgot/set-password debug attributes. */
    passwordResetSource: string;
    /** `source` on the terms consent event and its debug attributes. */
    termsConsentSource: string;
    /** Tag the submit button with `auth__password--{mode}` debug attributes. */
    tagSubmit?: boolean;
}

export interface AuthCredentialsFormProps {
    mode: AuthCredentialsMode;
    /** Prefix for the field ids: `{prefix}-email`, `{prefix}-secondary`, `{prefix}-remember-login`. */
    idPrefix: string;
    className?: string;
    email: string;
    onEmailChange: (value: string) => void;
    password: string;
    onPasswordChange: (value: string) => void;
    rememberLogin: boolean;
    onRememberLoginChange: (checked: boolean) => void;
    hasAcceptedTerms: boolean;
    onAcceptedTermsChange: (checked: boolean) => void;
    onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
    onPasswordResetRequest: (intent: PasswordResetIntent) => void;
    termsPath: string;
    privacyPath: string;
    /** Swaps the submit label for "Submitting…". */
    isSubmitting: boolean;
    /** Spinner + disabled + aria-busy on submit. Defaults to `isSubmitting`. */
    isPending?: boolean;
    /** Disables the email and password fields. */
    fieldsDisabled?: boolean;
    rememberLoginDisabled?: boolean;
    passwordResetDisabled?: boolean;
    /** Disables submit on top of `isPending`. */
    submitDisabled?: boolean;
    submitClassName?: string;
    analytics: AuthCredentialsFormAnalytics;
}

/**
 * The email/password form shared by the login page and the auth modal. It
 * renders fields and wires events; the caller owns the state, validation and
 * every auth request.
 */
export const AuthCredentialsForm: React.FC<AuthCredentialsFormProps> = ({
    mode,
    idPrefix,
    className,
    email,
    onEmailChange,
    password,
    onPasswordChange,
    rememberLogin,
    onRememberLoginChange,
    hasAcceptedTerms,
    onAcceptedTermsChange,
    onSubmit,
    onPasswordResetRequest,
    termsPath,
    privacyPath,
    isSubmitting,
    isPending = isSubmitting,
    fieldsDisabled,
    rememberLoginDisabled,
    passwordResetDisabled,
    submitDisabled,
    submitClassName,
    analytics,
}) => {
    const { t } = useTranslation('auth');
    const emailInputId = `${idPrefix}-email`;
    const passwordInputId = `${idPrefix}-secondary`;
    const rememberLoginInputId = `${idPrefix}-remember-login`;

    // Enter in any field submits through requestSubmit so native validation runs.
    const handleFormKeyDown = (event: React.KeyboardEvent<HTMLFormElement>) => {
        if (event.key !== 'Enter') return;
        if (event.nativeEvent.isComposing) return;
        if (!(event.target instanceof HTMLInputElement)) return;
        event.preventDefault();
        event.currentTarget.requestSubmit();
    };

    return (
        <form className={cn('space-y-4', className)} onSubmit={onSubmit} onKeyDown={handleFormKeyDown}>
            <div className="block">
                <Label htmlFor={emailInputId} className={AUTH_FIELD_LABEL_CLASS_NAME}>
                    {t('labels.email')}
                </Label>
                <AuthInput
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
                    onChange={(event) => onEmailChange(event.target.value)}
                    disabled={fieldsDisabled}
                    required
                />
            </div>
            <div className="block">
                <Label htmlFor={passwordInputId} className={AUTH_FIELD_LABEL_CLASS_NAME}>
                    {t('labels.password')}
                </Label>
                <AuthInput
                    id={passwordInputId}
                    name="password"
                    type="password"
                    aria-label={t('labels.password')}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(event) => onPasswordChange(event.target.value)}
                    disabled={fieldsDisabled}
                    required
                    minLength={8}
                />
            </div>
            {mode === 'login' && (
                <div className="space-y-2">
                    <Label
                        htmlFor={rememberLoginInputId}
                        className="inline-flex cursor-pointer text-sm font-semibold select-auto"
                    >
                        <Checkbox
                            id={rememberLoginInputId}
                            checked={rememberLogin}
                            onCheckedChange={(checked) => onRememberLoginChange(checked === true)}
                            disabled={rememberLoginDisabled}
                            aria-label={t('labels.rememberLogin')}
                            {...getAnalyticsDebugAttributes('auth__remember_login--toggle', analytics.rememberLoginPayload)}
                        />
                        <span>{t('labels.rememberLogin')}</span>
                    </Label>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                        <button
                            type="button"
                            onClick={() => onPasswordResetRequest('forgot_password')}
                            disabled={passwordResetDisabled}
                            className={AUTH_TEXT_ACTION_CLASS_NAME}
                            {...getAnalyticsDebugAttributes('auth__password_reset--request', { source: analytics.passwordResetSource, intent: 'forgot_password' })}
                        >
                            {t('actions.forgotPassword')}
                        </button>
                        <button
                            type="button"
                            onClick={() => onPasswordResetRequest('set_password')}
                            disabled={passwordResetDisabled}
                            className={AUTH_TEXT_ACTION_CLASS_NAME}
                            {...getAnalyticsDebugAttributes('auth__password_reset--request', { source: analytics.passwordResetSource, intent: 'set_password' })}
                        >
                            {t('actions.setPasswordSocial')}
                        </button>
                    </div>
                </div>
            )}
            {mode === 'register' && (
                <label className="flex items-start gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-xs text-foreground">
                    <input
                        type="checkbox"
                        checked={hasAcceptedTerms}
                        onChange={(event) => {
                            onAcceptedTermsChange(event.target.checked);
                            trackEvent(event.target.checked ? 'auth__terms_consent--accept' : 'auth__terms_consent--reject', { source: analytics.termsConsentSource });
                        }}
                        className="mt-0.5 size-4 rounded border-border"
                        {...getAnalyticsDebugAttributes('auth__terms_consent--accept', { source: analytics.termsConsentSource })}
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

            <AuthSubmitButton
                loading={isPending}
                disabled={submitDisabled}
                className={submitClassName}
                {...(analytics.tagSubmit ? getAnalyticsDebugAttributes(`auth__password--${mode}`) : {})}
            >
                {isSubmitting ? t('actions.submitting') : mode === 'login' ? t('actions.submitLogin') : t('actions.submitRegister')}
            </AuthSubmitButton>
        </form>
    );
};
