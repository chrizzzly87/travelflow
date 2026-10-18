// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveConsent } from '../../services/consentService';

beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
    document.getElementById('tf-umami-script')?.remove();
    delete window.umami;
    vi.stubEnv('VITE_UMAMI_SCRIPT_URL', 'https://analytics.example.test/script.js');
    vi.stubEnv('VITE_UMAMI_WEBSITE_ID', 'consent-test-site');
});
afterEach(() => { vi.unstubAllEnvs(); document.getElementById('tf-umami-script')?.remove(); delete window.umami; });

describe('analytics consent at dispatch time', () => {
    it('does not load analytics before optional consent', async () => {
        const { trackEvent, trackPageView } = await import('../../services/analyticsService');
        trackEvent('navigation__login');
        trackPageView('/');
        expect(document.getElementById('tf-umami-script')).toBeNull();
    });
    it.each(['event', 'pageview'])('drops a pending %s when consent is withdrawn while the script loads', async (kind) => {
        saveConsent('all');
        const { trackEvent, trackPageView } = await import('../../services/analyticsService');
        if (kind === 'event') trackEvent('navigation__login');
        else trackPageView('/');
        const script = document.getElementById('tf-umami-script');
        expect(script).not.toBeNull();
        saveConsent('essential');
        const track = vi.fn();
        window.umami = { track };
        script!.dispatchEvent(new Event('load'));
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(track).not.toHaveBeenCalled();
    });
});
