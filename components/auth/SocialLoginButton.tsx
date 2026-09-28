import React from 'react';
import { Button } from '../ui/button';
import type { OAuthProviderId } from '../../services/authService';
import { getAnalyticsDebugAttributes } from '../../services/analyticsService';
import { normalizeAppLanguage } from '../../utils';
import { SocialProviderIcon } from './SocialProviderIcon';

export interface OAuthButtonConfig {
    provider: OAuthProviderId;
    labelKey: string;
}

const BASE_OAUTH_BUTTONS: OAuthButtonConfig[] = [
    { provider: 'google', labelKey: 'actions.oauthGoogle' },
    { provider: 'facebook', labelKey: 'actions.oauthFacebook' },
];

const KAKAO_OAUTH_BUTTON: OAuthButtonConfig = { provider: 'kakao', labelKey: 'actions.oauthKakao' };

// Korean visitors see Kakao first; everyone else gets Google and Facebook.
export const getOAuthButtons = (language: string): OAuthButtonConfig[] => {
    if (normalizeAppLanguage(language) === 'ko') {
        return [KAKAO_OAUTH_BUTTON, ...BASE_OAUTH_BUTTONS];
    }
    return BASE_OAUTH_BUTTONS;
};

interface SocialLoginButtonProps {
    provider: OAuthProviderId;
    label: string;
    lastUsedLabel?: string;
    isLastUsed?: boolean;
    disabled?: boolean;
    onClick: () => void;
}

/**
 * One social sign-in row, shared by the login page and the auth modal so both
 * render the same `social` Button variant (brand hover tints in both themes).
 */
export const SocialLoginButton: React.FC<SocialLoginButtonProps> = ({
    provider,
    label,
    lastUsedLabel,
    isLastUsed = false,
    disabled,
    onClick,
}) => (
    <Button
        type="button"
        variant="social"
        data-provider={provider}
        data-last-used={isLastUsed ? 'true' : undefined}
        onClick={onClick}
        disabled={disabled}
        className="h-auto w-full px-4 py-2.5 has-[>svg]:px-4"
        {...getAnalyticsDebugAttributes(`auth__oauth--${provider}`)}
    >
        <SocialProviderIcon provider={provider} size={18} />
        <span>{label}</span>
        {isLastUsed && lastUsedLabel && (
            <span className="pointer-events-none absolute -top-2 end-3 rounded-2xl border border-border bg-secondary px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground shadow-sm dark:shadow-none">
                {lastUsedLabel}
            </span>
        )}
    </Button>
);
