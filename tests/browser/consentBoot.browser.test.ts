// @vitest-environment jsdom
import boot from '../../src/document/consent-boot.js?raw';
import { describe, expect, it, vi } from 'vitest';
import { CONSENT_STORAGE_KEY, CONSENT_DOCUMENT_ATTRIBUTE } from '../../services/consentState';
const run = () => new Function(boot)();
describe('first-paint consent visibility', () => {
    it.each(['all', 'essential'])('hides an already answered banner before application JavaScript for %s', choice => {
        localStorage.setItem(CONSENT_STORAGE_KEY, choice);
        run();
        expect(document.documentElement.getAttribute(CONSENT_DOCUMENT_ATTRIBUTE)).toBe(choice);
    });
    it('leaves a new or malformed choice undecided from the first paint', () => {
        run();
        expect(document.documentElement.getAttribute(CONSENT_DOCUMENT_ATTRIBUTE)).toBe('unknown');
        localStorage.setItem(CONSENT_STORAGE_KEY, 'invalid'); run();
        expect(document.documentElement.getAttribute(CONSENT_DOCUMENT_ATTRIBUTE)).toBe('unknown');
    });
    it('keeps the undecided banner usable when the storage getter is blocked', () => {
        const getter = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
        try { expect(run).not.toThrow(); expect(document.documentElement.getAttribute(CONSENT_DOCUMENT_ATTRIBUTE)).toBe('unknown'); }
        finally { getter.mockRestore(); }
    });
});
