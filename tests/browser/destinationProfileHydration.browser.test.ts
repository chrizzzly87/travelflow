// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDestinationCountryProfile } from '../../hooks/useDestinationCountryProfile';

/**
 * Regression cover for the destination guide hydration mismatch.
 *
 * During prerendering the /api/* edge routes are unreachable, so the profile
 * fetch used to settle into the error state and bake that markup into the
 * static HTML. The browser hydrated from the loading state instead, the trees
 * disagreed in node count, and React mis-associated every section below the
 * profile block - the events heading ended up inside the dark call-to-action
 * panel and the cities/airports sections swapped layout classes.
 */
describe('useDestinationCountryProfile during prerendering', () => {
  afterEach(() => {
    delete (window as unknown as { __TF_PRERENDER_EAGER__?: boolean }).__TF_PRERENDER_EAGER__;
    vi.restoreAllMocks();
  });

  it('stays in the loading state and issues no request while prerendering', async () => {
    (window as unknown as { __TF_PRERENDER_EAGER__?: boolean }).__TF_PRERENDER_EAGER__ = true;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const { result } = renderHook(() => useDestinationCountryProfile('china'));

    await waitFor(() => expect(result.current.isLoading).toBe(true));
    expect(result.current.hasError).toBe(false);
    expect(result.current.result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('performs the lookup normally when not prerendering', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{}', { status: 500 }),
    );

    renderHook(() => useDestinationCountryProfile('china'));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
  });
});
