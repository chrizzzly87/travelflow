import { afterEach, describe, expect, it, vi } from 'vitest';

import { AdminUserFacingError, toAdminErrorMessage, toBenchmarkApiErrorSentence } from '../../services/adminErrorMessages';

describe('services/adminErrorMessages', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('passes an authored user-facing error through unchanged', () => {
    expect(toAdminErrorMessage(new AdminUserFacingError('Version is required.'), 'Could not publish.')).toBe('Version is required.');
  });

  it('never shows raw database text, and logs it instead', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const raw = new Error('duplicate key value violates unique constraint "profiles_username_key"');

    expect(toAdminErrorMessage(raw, 'Could not save user.', 'admin-users')).toBe('Could not save user.');
    expect(log).toHaveBeenCalledWith('[admin-users] Could not save user.', raw);
  });

  it('maps permission, session and network failures to authored sentences', () => {
    expect(toAdminErrorMessage(new Error('Not allowed'), 'x')).toBe('Your account does not have permission for this action.');
    expect(toAdminErrorMessage(new Error('JWT expired'), 'x')).toBe('Your admin session has expired. Sign in again, then retry.');
    expect(toAdminErrorMessage(new TypeError('Failed to fetch'), 'x')).toBe('The request could not reach the server. Check your connection, then retry.');
  });

  it('keeps short sentences our SQL raises for people, as a sentence', () => {
    expect(toAdminErrorMessage(new Error('Unknown tier key'), 'x')).toBe('Unknown tier key.');
    expect(toAdminErrorMessage({ message: 'Trip not found' }, 'x')).toBe('Trip not found.');
  });

  it('keeps our services\' status lines but not status lines carrying a server body', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(toAdminErrorMessage(new Error('Nearby airports request failed with 500.'), 'x')).toBe('Nearby airports request failed with 500.');
    expect(toAdminErrorMessage(new Error('Destination profile request failed with 404'), 'x')).toBe('Destination profile request failed with 404.');
    expect(toAdminErrorMessage(new Error('Upstream request failed with 500: {"detail":"pg"}'), 'Fallback.')).toBe('Fallback.');
  });

  it('falls back for empty or non-error values', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(toAdminErrorMessage(undefined, 'Could not load trips.')).toBe('Could not load trips.');
    expect(toAdminErrorMessage(new AdminUserFacingError('  '), 'Could not load trips.')).toBe('Could not load trips.');
  });
});

describe('toBenchmarkApiErrorSentence', () => {
  it('drops the raw upstream body after the status and keeps the authored part', () => {
    expect(toBenchmarkApiErrorSentence('Failed to persist benchmark trip (500): {"code":"23505","details":"Key (id)=(x)"}', 500))
      .toBe('Failed to persist benchmark trip (500).');
    expect(toBenchmarkApiErrorSentence('Admin role required for benchmark endpoints.', 403))
      .toBe('Admin role required for benchmark endpoints.');
    expect(toBenchmarkApiErrorSentence(undefined, 502)).toBe('Benchmark API request failed (502).');
  });
});
