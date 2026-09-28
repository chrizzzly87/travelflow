// @vitest-environment jsdom
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { getOAuthButtons, SocialLoginButton } from '../../../components/auth/SocialLoginButton';

describe('components/auth/SocialLoginButton', () => {
  it('renders the shared social Button variant with a dark hover tint', () => {
    // The login page hand-rolled its own buttons with light-only hover tints, so
    // in dark mode "Continue with Google" hovered near-white with unreadable text.
    render(React.createElement(SocialLoginButton, {
      provider: 'google',
      label: 'Continue with Google',
      onClick: vi.fn(),
    }));

    const button = screen.getByRole('button', { name: 'Continue with Google' });
    expect(button).toHaveAttribute('data-slot', 'button');
    expect(button).toHaveAttribute('data-variant', 'social');
    expect(button).toHaveAttribute('data-provider', 'google');
    expect(button.className).toContain('dark:data-[provider=google]:hover:bg-[#ea4335]/12');
  });

  it('marks the last used provider with a badge', () => {
    render(React.createElement(SocialLoginButton, {
      provider: 'facebook',
      label: 'Continue with Facebook',
      lastUsedLabel: 'Last used',
      isLastUsed: true,
      onClick: vi.fn(),
    }));

    const button = screen.getByRole('button', { name: /Continue with Facebook/ });
    expect(button).toHaveAttribute('data-last-used', 'true');
    expect(button).toHaveTextContent('Last used');
  });

  it('lists Kakao first for Korean only', () => {
    expect(getOAuthButtons('ko').map((item) => item.provider)).toEqual(['kakao', 'google', 'facebook']);
    expect(getOAuthButtons('en').map((item) => item.provider)).toEqual(['google', 'facebook']);
  });

  it('is the only social button in the login page and the auth modal', () => {
    for (const file of ['pages/LoginPage.tsx', 'components/auth/AuthModal.tsx']) {
      const source = readFileSync(resolve(__dirname, '../../..', file), 'utf8');
      expect(source).toContain('<SocialLoginButton');
      expect(source).not.toContain('BASE_OAUTH_BUTTONS');
    }
  });
});
