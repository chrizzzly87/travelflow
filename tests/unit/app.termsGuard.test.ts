// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { resolveTermsNoticeState, shouldRedirectToTermsAcceptance } from '../../App';

const baseOptions = {
  isAuthenticated: true,
  isAuthLoading: false,
  hasAccess: true,
  isAnonymous: false,
  isAdmin: false,
  termsAcceptanceRequired: true,
};

describe('App terms acceptance redirect guard', () => {
  it('redirects authenticated users on protected tool routes when acceptance is required', () => {
    expect(shouldRedirectToTermsAcceptance({
      ...baseOptions,
      pathname: '/create-trip',
    })).toBe(true);
  });

  it('does not redirect on exempt legal route paths', () => {
    expect(shouldRedirectToTermsAcceptance({
      ...baseOptions,
      pathname: '/de/terms',
    })).toBe(false);
  });

  it('does not redirect on non-tool marketing routes', () => {
    expect(shouldRedirectToTermsAcceptance({
      ...baseOptions,
      pathname: '/pricing',
    })).toBe(false);
  });

  it('does not redirect anonymous sessions', () => {
    expect(shouldRedirectToTermsAcceptance({
      ...baseOptions,
      isAnonymous: true,
      pathname: '/create-trip',
    })).toBe(false);
  });

  it('does not redirect admins away from admin workspace routes', () => {
    expect(shouldRedirectToTermsAcceptance({
      ...baseOptions,
      isAdmin: true,
      pathname: '/admin/users',
    })).toBe(false);
  });
});

describe('App terms notice state', () => {
  it('returns force when acceptance is required', () => {
    expect(resolveTermsNoticeState({
      isAuthenticated: true,
      isAuthLoading: false,
      hasAccess: true,
      isAnonymous: false,
      termsAcceptanceRequired: true,
      termsNoticeRequired: false,
    })).toBe('force');
  });

  it('returns inform when only a silent notice is required', () => {
    expect(resolveTermsNoticeState({
      isAuthenticated: true,
      isAuthLoading: false,
      hasAccess: true,
      isAnonymous: false,
      termsAcceptanceRequired: false,
      termsNoticeRequired: true,
    })).toBe('inform');
  });

  it('returns none for anonymous sessions', () => {
    expect(resolveTermsNoticeState({
      isAuthenticated: true,
      isAuthLoading: false,
      hasAccess: true,
      isAnonymous: true,
      termsAcceptanceRequired: true,
      termsNoticeRequired: true,
    })).toBe('none');
  });
});
