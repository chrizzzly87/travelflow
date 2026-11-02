// @vitest-environment jsdom
import { renderWithRouter as render } from '@/tests/helpers/renderWithRouter';
import React, { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from '@/tests/helpers/routerHarness';

const mocks = vi.hoisted(() => ({
    trackEvent: vi.fn(),
    onSubmit: vi.fn(),
    onPasswordResetRequest: vi.fn(),
    onRememberLoginChange: vi.fn(),
}));

vi.mock('../../services/analyticsService', () => ({
    trackEvent: mocks.trackEvent,
    getAnalyticsDebugAttributes: (eventName: string) => ({ 'data-tf-event': eventName }),
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { language: 'en', resolvedLanguage: 'en' },
    }),
}));

// The real Radix checkbox measures itself; jsdom has no ResizeObserver.
if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
    } as unknown as typeof ResizeObserver;
}

import {
    AuthCredentialsForm,
    type AuthCredentialsMode,
} from '../../components/auth/AuthCredentialsForm';

interface HarnessProps {
    initialMode?: AuthCredentialsMode;
    isSubmitting?: boolean;
    isPending?: boolean;
}

const Harness: React.FC<HarnessProps> = ({ initialMode = 'login', isSubmitting = false, isPending }) => {
    const [mode, setMode] = useState<AuthCredentialsMode>(initialMode);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberLogin, setRememberLogin] = useState(true);
    const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
    return (
        <>
            <button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>switch-mode</button>
            <AuthCredentialsForm
                mode={mode}
                idPrefix="test-form"
                email={email}
                onEmailChange={setEmail}
                password={password}
                onPasswordChange={setPassword}
                rememberLogin={rememberLogin}
                onRememberLoginChange={(checked) => {
                    setRememberLogin(checked);
                    mocks.onRememberLoginChange(checked);
                }}
                hasAcceptedTerms={hasAcceptedTerms}
                onAcceptedTermsChange={setHasAcceptedTerms}
                onSubmit={(event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget);
                    mocks.onSubmit({ email: data.get('email'), password: data.get('password'), mode });
                }}
                onPasswordResetRequest={mocks.onPasswordResetRequest}
                termsPath="/terms"
                privacyPath="/privacy"
                isSubmitting={isSubmitting}
                isPending={isPending}
                analytics={{ passwordResetSource: 'test', termsConsentSource: 'test_form', tagSubmit: true }}
            />
        </>
    );
};

const renderForm = async (props: HarnessProps = {}) => await render(
    <MemoryRouter initialEntries={['/']}>
        <Harness {...props} />
    </MemoryRouter>,
);

describe('components/auth/AuthCredentialsForm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('submits the typed credentials on Enter with the login field attributes', async () => {
        const user = userEvent.setup();
        await renderForm();

        const emailInput = screen.getByLabelText('labels.email');
        const passwordInput = screen.getByLabelText('labels.password');
        expect(emailInput).toHaveAttribute('id', 'test-form-email');
        expect(emailInput).toHaveAttribute('name', 'email');
        expect(emailInput).toHaveAttribute('type', 'email');
        expect(emailInput).toHaveAttribute('autocomplete', 'username');
        expect(passwordInput).toHaveAttribute('id', 'test-form-secondary');
        expect(passwordInput).toHaveAttribute('autocomplete', 'current-password');
        expect(passwordInput).toHaveAttribute('minlength', '8');

        await user.type(emailInput, 'traveler@example.com');
        await user.type(passwordInput, 'password123{enter}');

        await waitFor(() => {
            expect(mocks.onSubmit).toHaveBeenCalledWith({
                email: 'traveler@example.com',
                password: 'password123',
                mode: 'login',
            });
        });
        expect(screen.getByRole('button', { name: 'actions.submitLogin' })).toHaveAttribute('data-tf-event', 'auth__password--login');
    });

    it('shows a busy, disabled submit while pending', async () => {
        await renderForm({ isSubmitting: true });
        const submit = screen.getByRole('button', { name: 'actions.submitting' });
        expect(submit).toBeDisabled();
        expect(submit).toHaveAttribute('aria-busy', 'true');
        expect(submit.querySelector('svg.animate-spin')).not.toBeNull();
    });

    it('keeps the submit label while pending without submitting', async () => {
        await renderForm({ isPending: true });
        const submit = screen.getByRole('button', { name: 'actions.submitLogin' });
        expect(submit).toBeDisabled();
        expect(submit).toHaveAttribute('aria-busy', 'true');
    });

    it('toggles remember login and requests password resets', async () => {
        const user = userEvent.setup();
        await renderForm();

        const remember = screen.getByRole('checkbox', { name: 'labels.rememberLogin' });
        expect(remember).toHaveAttribute('id', 'test-form-remember-login');
        expect(remember).toHaveAttribute('data-state', 'checked');
        await user.click(remember);
        expect(mocks.onRememberLoginChange).toHaveBeenLastCalledWith(false);
        expect(remember).toHaveAttribute('data-state', 'unchecked');
        await user.click(screen.getByText('labels.rememberLogin'));
        expect(mocks.onRememberLoginChange).toHaveBeenLastCalledWith(true);
        expect(mocks.onRememberLoginChange).toHaveBeenCalledTimes(2);

        await user.click(screen.getByRole('button', { name: 'actions.forgotPassword' }));
        expect(mocks.onPasswordResetRequest).toHaveBeenLastCalledWith('forgot_password');
        await user.click(screen.getByRole('button', { name: 'actions.setPasswordSocial' }));
        expect(mocks.onPasswordResetRequest).toHaveBeenLastCalledWith('set_password');
    });

    it('swaps remember login for the terms consent in register mode', async () => {
        const user = userEvent.setup();
        await renderForm();

        await user.click(screen.getByRole('button', { name: 'switch-mode' }));

        expect(screen.queryByRole('checkbox', { name: 'labels.rememberLogin' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'actions.forgotPassword' })).not.toBeInTheDocument();
        expect(screen.getByLabelText('labels.email')).toHaveAttribute('autocomplete', 'email');
        expect(screen.getByLabelText('labels.password')).toHaveAttribute('autocomplete', 'new-password');
        const submit = screen.getByRole('button', { name: 'actions.submitRegister' });
        expect(submit).toHaveAttribute('data-tf-event', 'auth__password--register');

        await user.click(screen.getByRole('checkbox'));
        expect(screen.getByRole('checkbox')).toBeChecked();
        expect(mocks.trackEvent).toHaveBeenLastCalledWith('auth__terms_consent--accept', { source: 'test_form' });
        await user.click(screen.getByRole('checkbox'));
        expect(mocks.trackEvent).toHaveBeenLastCalledWith('auth__terms_consent--reject', { source: 'test_form' });

        await user.click(screen.getByRole('button', { name: 'switch-mode' }));
        expect(screen.getByRole('button', { name: 'actions.submitLogin' })).toBeInTheDocument();
    });
});
